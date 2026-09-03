import type {
  AuthorizationResult,
  MoodHealthAvailability,
  StateOfMindSample,
  WriteAuthorization,
} from '../../modules/mood-health/src/types';
import { selectEntriesForHealth, toSafeHealthError, type HealthExportResult } from './core';
import type { MoodEntry } from '../types';

export const AUTO_SYNC_DAYS = 365;
export const AUTO_SYNC_READ_LIMIT = 5000;
const DAY = 86_400_000;

type Observation = {
  enabled: boolean;
  observing: boolean;
  backgroundDelivery: 'disabled' | 'enabled' | 'unavailable';
  errorCode?: string;
};
export interface AutoSyncNative {
  getAvailability(): MoodHealthAvailability;
  getObservationStatus(): Observation;
  getWriteAuthorization(): WriteAuthorization;
  requestAuthorization(read: boolean, write: boolean): Promise<AuthorizationResult>;
  startObservingStateOfMind(): Promise<Observation>;
  stopObservingStateOfMind(): Promise<Observation>;
  queryStateOfMind(start: number, end: number, limit: number): Promise<StateOfMindSample[]>;
}
export interface AutoSyncSnapshot {
  availability: MoodHealthAvailability;
  enabled: boolean;
  loading: boolean;
  busy: boolean;
  status: 'off' | 'idle' | 'syncing' | 'attention' | 'paused';
  backgroundDelivery: Observation['backgroundDelivery'];
  error: string | null;
  writeAuthorization: WriteAuthorization;
  lastReadAt: number | null;
  lastWriteAt: number | null;
  records: StateOfMindSample[];
  hasRead: boolean;
  readTruncated: boolean;
}

export function initialAutoSyncSnapshot(availability: MoodHealthAvailability): AutoSyncSnapshot {
  return {
    availability,
    enabled: false,
    loading: true,
    busy: false,
    status: 'off',
    backgroundDelivery: 'disabled',
    error: null,
    writeAuthorization: 'notDetermined',
    lastReadAt: null,
    lastWriteAt: null,
    records: [],
    hasRead: false,
    readTruncated: false,
  };
}

/** App-wide, event-driven synchronization. Never requests authorization on a timer,
 * stores incoming health samples, deletes samples, or rewrites journal entries. */
export function createHealthAutoSync(options: {
  native: AutoSyncNative;
  exportEntries: (
    entries: MoodEntry[],
    options?: { signal?: AbortSignal },
  ) => Promise<HealthExportResult>;
  onChange: (snapshot: AutoSyncSnapshot) => void;
  clock?: () => number;
  active?: boolean;
  retryDelays?: readonly number[];
}) {
  const { native } = options;
  const clock = options.clock ?? Date.now;
  let active = options.active ?? true;
  let disposed = false;
  let initialized = false;
  let ready = false;
  let observing = false;
  let observationErrorCode: string | undefined;
  let observerRetries = 0;
  let accessRequested = false;
  let restoring: Promise<void> | null = null;
  let configuring = false;
  let controlToken = 0;
  let epoch = 0;
  let running: Promise<void> | null = null;
  let pending = false;
  let controller: AbortController | null = null;
  let latest: MoodEntry[] = [];
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const retryDelays = options.retryDelays ?? [5_000, 15_000, 45_000];
  let snapshot = initialAutoSyncSnapshot(native.getAvailability());

  function publish(changes: Partial<AutoSyncSnapshot>) {
    if (disposed) return;
    snapshot = { ...snapshot, ...changes };
    options.onChange({ ...snapshot, records: [...snapshot.records] });
  }
  function clearRead() {
    publish({ records: [], hasRead: false, readTruncated: false, lastReadAt: null });
  }
  function invalidate() {
    epoch++;
    controller?.abort();
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }
  function canRun() {
    return (
      !disposed &&
      initialized &&
      ready &&
      active &&
      snapshot.enabled &&
      accessRequested &&
      !configuring &&
      !restoring
    );
  }
  function applyObservation(value: Observation) {
    observing = value.observing;
    observationErrorCode = value.errorCode;
    publish({
      enabled: value.enabled,
      backgroundDelivery: value.backgroundDelivery,
      error: value.errorCode ? toSafeHealthError({ code: value.errorCode }).message : null,
    });
    if (value.enabled && !value.observing) {
      clearRead();
      publish({
        status: 'attention',
        error: toSafeHealthError({ code: value.errorCode ?? 'ERR_MOOD_HEALTH_OBSERVER' }).message,
      });
    }
  }

  function restoreObservation(automatic = false) {
    if (restoring || disposed || !active || !snapshot.enabled || configuring) return;
    if (automatic) {
      if (observerRetries >= retryDelays.length) return;
      observerRetries++;
    }
    const token = controlToken;
    restoring = native
      .startObservingStateOfMind()
      .then((value) => {
        if (disposed || token !== controlToken) return;
        accessRequested = true;
        applyObservation(value);
      })
      .catch((failure: unknown) => {
        if (token === controlToken)
          publish({ status: 'attention', error: toSafeHealthError(failure).message });
      })
      .finally(() => {
        restoring = null;
        trigger();
      });
  }

  async function drain() {
    // Repeated events are coalesced into the most recent persisted journal, not a
    // queue of stale entry snapshots. Own HealthKit writes may emit another event;
    // the exporter ledger makes that extra pass read-only, preventing a loop.
    while (pending && canRun()) {
      pending = false;
      const generation = epoch;
      const abort = new AbortController();
      controller = abort;
      const valid = () => canRun() && generation === epoch && !abort.signal.aborted;
      const writeAuthorization = native.getWriteAuthorization();
      let error: string | null = null;
      let retryable = false;
      const mayRetry = (code: string | undefined) =>
        !!code &&
        [
          'ERR_MOOD_HEALTH_QUERY',
          'ERR_MOOD_HEALTH_SAVE',
          'ERR_MOOD_HEALTH_SAVE_UNVERIFIED',
          'ERR_MOOD_HEALTH_PROTECTED_DATA_UNAVAILABLE',
          'ERR_MOOD_HEALTH_OBSERVER',
        ].includes(code);
      publish({ busy: true, status: 'syncing', error: null, writeAuthorization });
      try {
        if (writeAuthorization === 'authorized') {
          const selected = selectEntriesForHealth(latest, AUTO_SYNC_DAYS, clock());
          const result = await options.exportEntries(selected, { signal: abort.signal });
          if (!valid()) continue;
          if (result.failed > 0) {
            error =
              result.firstErrorMessage ??
              toSafeHealthError({ code: result.firstErrorCode }).message;
            retryable = mayRetry(result.firstErrorCode);
          } else if (result.saved > 0) {
            publish({ lastWriteAt: clock() });
          }
        } else {
          error =
            '自动写入已暂停：请在健康 App 的权限设置中允许“心情日记”写入心境。读取不会因此被关闭。';
        }
      } catch (failure) {
        const safe = toSafeHealthError(failure);
        error = safe.message;
        retryable = mayRetry(safe.code);
      }
      if (!valid()) continue;
      try {
        const end = clock();
        const records = await native.queryStateOfMind(
          Math.max(0, end - AUTO_SYNC_DAYS * DAY),
          end,
          AUTO_SYNC_READ_LIMIT,
        );
        if (!valid()) continue;
        publish({
          records,
          hasRead: true,
          lastReadAt: end,
          readTruncated: records.length >= AUTO_SYNC_READ_LIMIT,
        });
      } catch (failure) {
        if (!valid()) continue;
        // Don't present an older successful read as today's fresh data after a
        // permission/protected-data failure. Read denial may instead return [].
        clearRead();
        const safe = toSafeHealthError(failure);
        error = error ?? safe.message;
        retryable = retryable || mayRetry(safe.code);
      }
      if (!valid()) continue;
      if (snapshot.backgroundDelivery === 'unavailable' && !error) {
        error = '前台自动同步已开启，但后台通知暂不可用；回到 App 会自动补齐，无需手动同步。';
      }
      const observerNeedsRecovery =
        !observing || observationErrorCode === 'ERR_MOOD_HEALTH_OBSERVER';
      if (observerNeedsRecovery) {
        error =
          error ??
          toSafeHealthError({ code: observationErrorCode ?? 'ERR_MOOD_HEALTH_OBSERVER' }).message;
        retryable = true;
      }
      publish({ busy: false, status: error ? 'attention' : 'idle', error });
      if (!error) retryAttempt = 0;
      const attempt = observerNeedsRecovery ? observerRetries : retryAttempt;
      if (error && retryable && attempt < retryDelays.length && !retryTimer && !pending) {
        if (!observerNeedsRecovery) retryAttempt++;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (!observing || observationErrorCode === 'ERR_MOOD_HEALTH_OBSERVER')
            restoreObservation(true);
          else trigger();
        }, retryDelays[attempt]);
      }
    }
  }

  function trigger() {
    pending = true;
    if (running || !canRun()) return;
    running = Promise.resolve()
      .then(drain)
      .catch((failure: unknown) => {
        publish({ busy: false, status: 'attention', error: toSafeHealthError(failure).message });
      })
      .finally(() => {
        running = null;
        controller = null;
        if (pending && canRun()) trigger();
      });
  }

  return {
    getSnapshot: () => ({ ...snapshot, records: [...snapshot.records] }),
    async initialize() {
      if (initialized || disposed) return;
      initialized = true;
      const token = controlToken;
      if (!snapshot.availability.available) {
        publish({ loading: false });
        return;
      }
      try {
        const saved = native.getObservationStatus();
        if (saved.enabled) {
          publish({ enabled: true });
          const restored = await native.startObservingStateOfMind();
          if (disposed || token !== controlToken) return;
          accessRequested = true;
          applyObservation(restored);
        }
      } catch (failure) {
        if (token === controlToken)
          publish({ error: toSafeHealthError(failure).message, status: 'attention' });
      } finally {
        if (token === controlToken) {
          publish({ loading: false });
          trigger();
        }
      }
    },
    updateEntries(entries: MoodEntry[], journalReady: boolean) {
      const wasReady = ready;
      ready = journalReady;
      // Keep only outgoing fields. Notes never enter the sync queue.
      const next = entries.map(({ id, emotionId, categoryId, activityIds, timestamp }) => ({
        id,
        emotionId,
        categoryId,
        activityIds: activityIds ? [...activityIds] : undefined,
        timestamp,
      }));
      if (JSON.stringify(next) === JSON.stringify(latest) && wasReady === ready) return;
      invalidate();
      retryAttempt = 0;
      latest = next;
      if (!ready) {
        clearRead();
        publish({ busy: false, status: snapshot.enabled ? 'paused' : 'off' });
      }
      trigger();
    },
    setActive(value: boolean) {
      active = value;
      if (!value) {
        invalidate();
        clearRead();
        publish({ busy: configuring, status: snapshot.enabled ? 'paused' : 'off' });
      } else {
        retryAttempt = 0;
        observerRetries = 0;
        if (snapshot.availability.available)
          publish({ writeAuthorization: native.getWriteAuthorization() });
        if (snapshot.enabled) {
          applyObservation(native.getObservationStatus());
          restoreObservation();
        }
        trigger();
      }
    },
    async enable() {
      if (disposed || configuring || !snapshot.availability.available) return;
      const token = ++controlToken;
      observerRetries = 0;
      invalidate();
      configuring = true;
      publish({ busy: true, error: null });
      try {
        // This method is called only from the explicit, one-time enable/repair UI.
        const result = await native.requestAuthorization(true, true);
        if (disposed || token !== controlToken) return;
        if (!result.requestCompleted) throw { code: 'ERR_MOOD_HEALTH_AUTHORIZATION_REQUIRED' };
        accessRequested = true;
        const observation = await native.startObservingStateOfMind();
        if (disposed || token !== controlToken) return;
        applyObservation(observation);
        publish({ writeAuthorization: result.writeAuthorization });
      } catch (failure) {
        if (token === controlToken)
          publish({ error: toSafeHealthError(failure).message, status: 'attention' });
      } finally {
        if (token === controlToken) {
          configuring = false;
          publish({ busy: false, loading: false });
          trigger();
        }
      }
    },
    async disable() {
      const token = ++controlToken;
      invalidate();
      configuring = false;
      observing = false;
      accessRequested = false;
      pending = false;
      publish({
        enabled: false,
        busy: false,
        status: 'off',
        error: null,
        lastWriteAt: null,
        backgroundDelivery: 'disabled',
      });
      clearRead();
      try {
        await native.stopObservingStateOfMind();
      } catch (failure) {
        if (token === controlToken) publish({ error: toSafeHealthError(failure).message });
      }
    },
    healthChanged() {
      if (!snapshot.enabled || disposed) return;
      const observation = native.getObservationStatus();
      applyObservation(observation);
      trigger();
    },
    retry() {
      retryAttempt = 0;
      observerRetries = 0;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      if (!observing || observationErrorCode === 'ERR_MOOD_HEALTH_OBSERVER') restoreObservation();
      else trigger();
    },
    async waitForIdle() {
      while (running || restoring) await (running ?? restoring);
    },
    dispose() {
      disposed = true;
      controlToken++;
      invalidate();
      latest = [];
      snapshot.records = [];
      // Native observation remains registered after an opted-in app shuts down.
      // Its callbacks never persist samples; foreground startup always re-queries.
    },
  };
}
