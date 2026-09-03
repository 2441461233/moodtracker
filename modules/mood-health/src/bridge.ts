import {
  HEALTH_ASSOCIATIONS,
  MAX_QUERY_DAYS,
  MAX_QUERY_LIMIT,
  type AuthorizationResult,
  type MoodHealthAvailability,
  type NativeMoodHealthModule,
  type SaveStateOfMindInput,
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
    return module.queryStateOfMind(startMs, endMs, limit);
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
    queryStateOfMind,
    saveStateOfMind,
  };
}
