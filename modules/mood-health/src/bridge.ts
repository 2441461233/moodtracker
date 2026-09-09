import {
  HEALTH_ASSOCIATIONS,
  MAX_QUERY_DAYS,
  MAX_QUERY_LIMIT,
  MAX_LOCAL_ENTRY_ID_LENGTH,
  MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
  type AuthorizationResult,
  type MoodHealthAvailability,
  type NativeMoodHealthModule,
  type ObservationStatus,
  type SaveStateOfMindInput,
  type StateOfMindChangeEvent,
  type StateOfMindSample,
  type WriteAuthorization,
} from './types';

export class MoodHealthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MoodHealthError';
  }
}

function invalid(message: string): never {
  throw new MoodHealthError('ERR_MOOD_HEALTH_INVALID_INPUT', message);
}

function normalizedReadSample(sample: StateOfMindSample): StateOfMindSample {
  // The native source identity and its explicit ownership flag must agree. A
  // foreign sample can never nominate a local journal entry for deduplication.
  const isFromThisApp =
    sample.isFromThisApp === true && sample.sourceBundleId === MOOD_HEALTH_APP_BUNDLE_IDENTIFIER;
  const record: StateOfMindSample = {
    uuid: sample.uuid,
    timestamp: sample.timestamp,
    kind: sample.kind,
    valence: sample.valence,
    labels: [...sample.labels],
    associations: [...sample.associations],
    sourceName: sample.sourceName,
    sourceBundleId: sample.sourceBundleId,
    isFromThisApp,
  };
  if (
    isFromThisApp &&
    typeof sample.localEntryId === 'string' &&
    sample.localEntryId.length > 0 &&
    sample.localEntryId.length <= MAX_LOCAL_ENTRY_ID_LENGTH &&
    sample.localEntryId.trim().length > 0 &&
    !/[\p{Cc}\p{Cf}]/u.test(sample.localEntryId)
  )
    record.localEntryId = sample.localEntryId;
  // An invalid optional ID is not trusted, but the original health observation
  // remains visible. Legacy binaries that omit the field keep working as well.
  return record;
}

/** Pure adapter: safe fallbacks can be tested without a HealthKit store. */
export function createMoodHealthBridge(native: NativeMoodHealthModule | null, platform: string) {
  function getAvailability(): MoodHealthAvailability {
    if (platform !== 'ios') return { available: false, reason: 'unsupported_platform' };
    if (!native) return { available: false, reason: 'native_module_missing' };
    return native.getAvailability();
  }

  function getWriteAuthorization(): WriteAuthorization {
    return getAvailability().available && native ? native.getWriteAuthorization() : 'notDetermined';
  }

  function requireAvailable(): NativeMoodHealthModule {
    const availability = getAvailability();
    if (!availability.available || !native) {
      throw new MoodHealthError(
        'ERR_MOOD_HEALTH_UNAVAILABLE',
        'Apple 健康情绪记录需要已集成原生模块的 iOS 18 或更新版本应用。',
      );
    }
    return native;
  }

  function getObservationStatus(): ObservationStatus {
    if (!getAvailability().available || !native) {
      return {
        enabled: false,
        observing: false,
        backgroundDelivery: 'unavailable',
        revision: 0,
        errorCode: 'ERR_MOOD_HEALTH_UNAVAILABLE',
      };
    }
    return native.getObservationStatus();
  }

  async function startObservingStateOfMind(): Promise<ObservationStatus> {
    return requireAvailable().startObservingStateOfMind();
  }

  async function stopObservingStateOfMind(): Promise<ObservationStatus> {
    return requireAvailable().stopObservingStateOfMind();
  }

  function addStateOfMindChangeListener(listener: (event: StateOfMindChangeEvent) => void) {
    if (typeof listener !== 'function') invalid('请提供有效的健康情绪变更监听器。');
    return requireAvailable().addListener('onStateOfMindChange', (event) => {
      if (
        !event ||
        !['changed', 'foreground', 'error'].includes(event.reason) ||
        !Number.isSafeInteger(event.revision) ||
        event.revision < 0
      )
        return;
      // Notifications are invalidations, never a second route for health samples.
      const safeEvent: StateOfMindChangeEvent = { reason: event.reason, revision: event.revision };
      if (
        typeof event.errorCode === 'string' &&
        /^ERR_MOOD_HEALTH_[A-Z_]{1,80}$/.test(event.errorCode)
      )
        safeEvent.errorCode = event.errorCode;
      listener(safeEvent);
    });
  }

  async function requestAuthorization(read: boolean, write: boolean): Promise<AuthorizationResult> {
    if (typeof read !== 'boolean' || typeof write !== 'boolean')
      invalid('请明确指定健康数据的读取和写入请求。');
    if (!getAvailability().available || !native || (!read && !write)) {
      return { requestCompleted: false, writeAuthorization: getWriteAuthorization() };
    }
    return native.requestAuthorization(read, write);
  }

  async function queryStateOfMind(
    startMs: number,
    endMs: number,
    limit: number,
  ): Promise<StateOfMindSample[]> {
    const module = requireAvailable();
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      startMs < 0 ||
      endMs > 8.64e15 ||
      endMs <= startMs
    ) {
      invalid('读取范围必须是有效的开始与结束时间。');
    }
    if (endMs - startMs > MAX_QUERY_DAYS * 86_400_000) invalid('每次最多读取 366 天的情绪记录。');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_QUERY_LIMIT)
      invalid('每次读取数量必须为 1 至 5000 的整数。');
    const samples = await module.queryStateOfMind(startMs, endMs, limit);
    return samples.map(normalizedReadSample);
  }

  async function saveStateOfMind(input: SaveStateOfMindInput): Promise<{ uuid: string }> {
    const module = requireAvailable();
    if (!input || typeof input !== 'object') invalid('请提供有效的情绪记录。');
    if (
      typeof input.syncIdentifier !== 'string' ||
      !input.syncIdentifier.startsWith('moodtracker:') ||
      input.syncIdentifier.length <= 12 ||
      input.syncIdentifier.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(input.syncIdentifier)
    ) {
      invalid('记录的同步标识不正确。');
    }
    if (!Number.isSafeInteger(input.syncVersion) || input.syncVersion < 1)
      invalid('记录版本必须为正的安全整数。');
    if (!Number.isFinite(input.timestamp) || input.timestamp < 0 || input.timestamp > Date.now())
      invalid('记录时间必须是已经发生的有效时间。');
    if (!Number.isFinite(input.valence) || input.valence < -1 || input.valence > 1)
      invalid('情绪愉悦度必须在 -1 至 1 之间。');
    if (input.kind !== 'momentaryEmotion') invalid('此接口仅保存用户主动记录的瞬时情绪。');
    if (
      !Array.isArray(input.associations) ||
      input.associations.length > HEALTH_ASSOCIATIONS.length ||
      input.associations.some((value) => !HEALTH_ASSOCIATIONS.includes(value))
    ) {
      invalid('包含不支持的健康关联类型。');
    }
    // Build an allowlisted payload. Extra properties (including notes) never cross the bridge.
    return module.saveStateOfMind({
      syncIdentifier: input.syncIdentifier,
      syncVersion: input.syncVersion,
      timestamp: input.timestamp,
      valence: input.valence,
      kind: input.kind,
      associations: [...new Set(input.associations)],
    });
  }

  return {
    getAvailability,
    getWriteAuthorization,
    requestAuthorization,
    getObservationStatus,
    startObservingStateOfMind,
    stopObservingStateOfMind,
    addStateOfMindChangeListener,
    queryStateOfMind,
    saveStateOfMind,
  };
}
