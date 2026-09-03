import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHealthAutoSync,
  type AutoSyncNative,
  type AutoSyncSnapshot,
} from '../src/health/auto-sync';
import { createHealthExporter, type HealthSampleInput } from '../src/health/core';
import type { MoodEntry } from '../src/types';
import type { StateOfMindSample } from '../modules/mood-health/src/types';

const NOW = Date.UTC(2026, 8, 3, 10);
const local = (emotionId: MoodEntry['emotionId'] = 'good'): MoodEntry => ({
  id: 'local-one',
  timestamp: NOW - 1000,
  emotionId,
  note: 'PRIVATE NOTE',
});
const incoming: StateOfMindSample = {
  uuid: 'health-uuid',
  timestamp: NOW - 500,
  valence: 0.2,
  kind: 'dailyMood',
  labels: [],
  associations: [],
  sourceName: 'Watch',
  sourceBundleId: 'apple.watch',
  isFromThisApp: false,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture({ enabled = false, available = true, retries = [] as number[] } = {}) {
  const counters = { authorization: 0, reads: 0, starts: 0, stops: 0 };
  let stored: string | null = null;
  let time = NOW;
  const saves: HealthSampleInput[] = [];
  const histories: AutoSyncSnapshot[] = [];
  const observation: ReturnType<AutoSyncNative['getObservationStatus']> = {
    enabled,
    observing: enabled,
    backgroundDelivery: enabled ? ('enabled' as const) : ('disabled' as const),
  };
  let write: 'authorized' | 'denied' | 'notDetermined' = 'authorized';
  let onSave: (sample: HealthSampleInput) => Promise<{ uuid: string }> = async () => ({
    uuid: 'saved-uuid',
  });
  let onRead: () => Promise<StateOfMindSample[]> = async () => [incoming];
  let onStart = () => {};
  let onAuth: () => Promise<{
    requestCompleted: boolean;
    writeAuthorization: typeof write;
  }> = async () => ({ requestCompleted: true, writeAuthorization: write });
  const native: AutoSyncNative = {
    getAvailability: () => ({
      available,
      reason: available ? 'available' : 'unsupported_platform',
    }),
    getObservationStatus: () => ({ ...observation }),
    getWriteAuthorization: () => write,
    requestAuthorization: async (read, sharing) => {
      assert.equal(read, true);
      assert.equal(sharing, true);
      counters.authorization++;
      return onAuth();
    },
    startObservingStateOfMind: async () => {
      counters.starts++;
      observation.enabled = true;
      observation.observing = true;
      observation.backgroundDelivery = 'enabled';
      onStart();
      return { ...observation };
    },
    stopObservingStateOfMind: async () => {
      counters.stops++;
      observation.enabled = false;
      observation.observing = false;
      observation.backgroundDelivery = 'disabled';
      return { ...observation };
    },
    queryStateOfMind: async (start, end, limit) => {
      assert.equal(end - start, 365 * 86400000);
      assert.equal(limit, 5000);
      counters.reads++;
      return onRead();
    },
  };
  const exporter = createHealthExporter(
    {
      getItem: async () => stored,
      setItem: async (_key, value) => {
        stored = value;
      },
    },
    async (sample) => {
      saves.push(sample);
      return onSave(sample);
    },
    () => time,
  );
  const sync = createHealthAutoSync({
    native,
    exportEntries: exporter.exportEntries,
    onChange: (state) => histories.push(state),
    clock: () => time,
    retryDelays: retries,
  });
  return {
    sync,
    counters,
    saves,
    histories,
    observation,
    getStored: () => stored,
    advance: () => {
      time += 1000;
    },
    setWrite: (value: typeof write) => {
      write = value;
    },
    onSave: (fn: typeof onSave) => {
      onSave = fn;
    },
    onRead: (fn: typeof onRead) => {
      onRead = fn;
    },
    onStart: (fn: typeof onStart) => {
      onStart = fn;
    },
    onAuth: (fn: typeof onAuth) => {
      onAuth = fn;
    },
    async start() {
      sync.updateEntries([local()], true);
      await sync.initialize();
      await sync.enable();
      await sync.waitForIdle();
    },
  };
}

test('default-off and unavailable environments never authorize, query, or write', async () => {
  for (const available of [true, false]) {
    const f = fixture({ available });
    f.sync.updateEntries([local()], true);
    await f.sync.initialize();
    f.sync.healthChanged();
    f.sync.setActive(true);
    await f.sync.waitForIdle();
    assert.deepEqual(f.counters, { authorization: 0, reads: 0, starts: 0, stops: 0 });
    assert.equal(f.saves.length, 0);
    f.sync.dispose();
  }
});

test('one explicit authorization enables initial backfill then automatic edits and foreground reads', async () => {
  const f = fixture();
  await f.start();
  assert.equal(f.saves.length, 1);
  assert.equal(f.sync.getSnapshot().status, 'idle');
  assert.equal(f.sync.getSnapshot().hasRead, true);
  f.sync.updateEntries([local('sad')], true);
  await f.sync.waitForIdle();
  assert.equal(f.saves.length, 2);
  assert.equal(f.saves[1].valence, -1);
  assert.ok(f.saves[1].syncVersion > f.saves[0].syncVersion);
  f.sync.setActive(false);
  assert.equal(f.sync.getSnapshot().records.length, 0);
  f.sync.setActive(true);
  await f.sync.waitForIdle();
  assert.equal(f.counters.authorization, 1);
  assert.equal(f.saves.length, 2);
  assert.ok(f.counters.reads >= 3);
  f.sync.dispose();
});

test('persisted native opt-in resumes on launch without another permission sheet', async () => {
  const f = fixture({ enabled: true });
  f.sync.updateEntries([local()], true);
  await f.sync.initialize();
  await f.sync.waitForIdle();
  assert.equal(f.counters.authorization, 0);
  assert.equal(f.saves.length, 1);
  assert.equal(f.sync.getSnapshot().enabled, true);
  f.sync.dispose();
});

test('journal must finish loading successfully before any synchronization', async () => {
  const f = fixture({ enabled: true });
  f.sync.updateEntries([local()], false);
  await f.sync.initialize();
  await f.sync.waitForIdle();
  assert.equal(f.saves.length, 0);
  assert.equal(f.counters.reads, 0);
  f.sync.updateEntries([local()], true);
  await f.sync.waitForIdle();
  assert.equal(f.saves.length, 1);
  f.sync.dispose();
});

test('notes never enter native payload/ledger and note-only edits do not enqueue another write', async () => {
  const f = fixture();
  await f.start();
  const beforeReads = f.counters.reads;
  f.sync.updateEntries([{ ...local(), note: 'ANOTHER PRIVATE NOTE' }], true);
  await f.sync.waitForIdle();
  assert.equal(f.saves.length, 1);
  assert.equal(f.counters.reads, beforeReads);
  assert.doesNotMatch(JSON.stringify(f.saves) + f.getStored(), /PRIVATE|note|health-uuid|Watch/);
  f.sync.dispose();
});

test('incoming daily moods are a separate read-only view and never exported as journal entries', async () => {
  const f = fixture();
  await f.start();
  assert.equal(f.sync.getSnapshot().records[0].kind, 'dailyMood');
  assert.equal(f.saves[0].syncIdentifier, 'moodtracker:local-one');
  assert.equal(f.saves.length, 1);
  f.onRead(async () => []);
  f.sync.healthChanged();
  await f.sync.waitForIdle();
  assert.deepEqual(f.sync.getSnapshot().records, []);
  assert.equal(f.sync.getSnapshot().hasRead, true);
  assert.equal(f.saves.length, 1);
  f.sync.dispose();
});

test('own HealthKit notifications settle without a read-write feedback loop', async () => {
  const f = fixture();
  f.onSave(async () => {
    f.sync.healthChanged();
    return { uuid: 'saved' };
  });
  await f.start();
  assert.equal(f.saves.length, 1);
  assert.ok(f.counters.reads <= 2);
  f.sync.dispose();
});

test('latest edits supersede a pending batch without sending intermediate stale snapshots', async () => {
  const f = fixture();
  const entered = deferred<void>();
  const finish = deferred<{ uuid: string }>();
  f.onSave(async () => {
    if (f.saves.length === 1) {
      entered.resolve();
      return finish.promise;
    }
    return { uuid: 'newer' };
  });
  f.sync.updateEntries([local()], true);
  await f.sync.initialize();
  await f.sync.enable();
  await entered.promise;
  f.sync.updateEntries([local('joyful')], true);
  f.sync.updateEntries([local('sad')], true);
  finish.resolve({ uuid: 'older' });
  await f.sync.waitForIdle();
  assert.deepEqual(
    f.saves.map((sample) => sample.valence),
    [0.5, -1],
  );
  assert.equal(f.sync.getSnapshot().status, 'idle');
  f.sync.dispose();
});

test('disabling during authorization prevents a late completion from starting observation', async () => {
  const f = fixture();
  const auth = deferred<{ requestCompleted: boolean; writeAuthorization: 'authorized' }>();
  f.onAuth(() => auth.promise);
  await f.sync.initialize();
  const enabling = f.sync.enable();
  await f.sync.disable();
  auth.resolve({ requestCompleted: true, writeAuthorization: 'authorized' });
  await enabling;
  assert.equal(f.counters.starts, 0);
  assert.equal(f.sync.getSnapshot().enabled, false);
  assert.equal(f.counters.reads, 0);
  f.sync.dispose();
});

test('a late query cannot resurrect health data after backgrounding or disabling', async () => {
  for (const disabled of [false, true]) {
    const f = fixture();
    const entered = deferred<void>();
    const query = deferred<StateOfMindSample[]>();
    f.onRead(() => {
      entered.resolve();
      return query.promise;
    });
    f.sync.updateEntries([local()], true);
    await f.sync.initialize();
    await f.sync.enable();
    await entered.promise;
    if (disabled) await f.sync.disable();
    else f.sync.setActive(false);
    query.resolve([incoming]);
    await f.sync.waitForIdle();
    assert.deepEqual(f.sync.getSnapshot().records, []);
    assert.equal(f.sync.getSnapshot().hasRead, false);
    assert.equal(f.sync.getSnapshot().status, disabled ? 'off' : 'paused');
    f.sync.dispose();
  }
});

test('denied writing preserves reading and never produces another authorization request', async () => {
  const f = fixture();
  f.setWrite('denied');
  await f.start();
  assert.equal(f.saves.length, 0);
  assert.equal(f.sync.getSnapshot().records.length, 1);
  assert.equal(f.sync.getSnapshot().status, 'attention');
  f.sync.retry();
  await f.sync.waitForIdle();
  assert.equal(f.counters.authorization, 1);
  f.sync.dispose();
});

test('failed reads clear old visible samples and report only a safe actionable error', async () => {
  const f = fixture();
  await f.start();
  f.onRead(async () => {
    throw { code: 'ERR_MOOD_HEALTH_PROTECTED_DATA_UNAVAILABLE', message: 'PRIVATE HEALTH SAMPLE' };
  });
  f.sync.healthChanged();
  await f.sync.waitForIdle();
  const state = f.sync.getSnapshot();
  assert.deepEqual(state.records, []);
  assert.equal(state.hasRead, false);
  assert.equal(state.status, 'attention');
  assert.match(state.error!, /解锁/);
  assert.doesNotMatch(state.error!, /PRIVATE/);
  f.sync.dispose();
});

test('transient write failure retries automatically with the same identifier/version', async () => {
  const f = fixture({ retries: [1] });
  f.onSave(async () => {
    if (f.saves.length === 1) throw { code: 'ERR_MOOD_HEALTH_SAVE' };
    return { uuid: 'eventually-saved' };
  });
  await f.start();
  await new Promise((done) => setTimeout(done, 15));
  await f.sync.waitForIdle();
  assert.equal(f.saves.length, 2);
  assert.deepEqual(f.saves[0], f.saves[1]);
  assert.equal(f.sync.getSnapshot().status, 'idle');
  f.sync.dispose();
});

test('retry count is bounded and disabling prevents scheduled attempts', async () => {
  const f = fixture({ retries: [1, 1] });
  f.onSave(async () => {
    throw { code: 'ERR_MOOD_HEALTH_SAVE' };
  });
  await f.start();
  await new Promise((done) => setTimeout(done, 20));
  await f.sync.waitForIdle();
  assert.equal(f.saves.length, 3);
  await f.sync.disable();
  await new Promise((done) => setTimeout(done, 5));
  assert.equal(f.saves.length, 3);
  assert.equal(f.sync.getSnapshot().status, 'off');
  f.sync.dispose();
});

test('rapid double-enable opens only one authorization request and still connects', async () => {
  const f = fixture();
  const auth = deferred<{ requestCompleted: boolean; writeAuthorization: 'authorized' }>();
  f.onAuth(() => auth.promise);
  f.sync.updateEntries([local()], true);
  await f.sync.initialize();
  const first = f.sync.enable();
  const second = f.sync.enable();
  auth.resolve({ requestCompleted: true, writeAuthorization: 'authorized' });
  await Promise.all([first, second]);
  await f.sync.waitForIdle();
  assert.equal(f.counters.authorization, 1);
  assert.equal(f.sync.getSnapshot().enabled, true);
  assert.equal(f.saves.length, 1);
  f.sync.dispose();
});

test('observer interruption remains actionable, does not block writes, and retry restores without authorization', async () => {
  const f = fixture();
  await f.start();
  f.observation.observing = false;
  f.sync.healthChanged();
  await f.sync.waitForIdle();
  assert.equal(f.sync.getSnapshot().status, 'attention');
  f.sync.updateEntries([local('sad')], true);
  await f.sync.waitForIdle();
  assert.equal(f.saves.length, 2);
  f.sync.retry();
  await f.sync.waitForIdle();
  assert.equal(f.counters.starts, 2);
  assert.equal(f.counters.authorization, 1);
  assert.equal(f.sync.getSnapshot().status, 'idle');
  f.sync.dispose();
});

test('read notifications and skipped exports do not fabricate a new last-write timestamp', async () => {
  const f = fixture();
  await f.start();
  const actualWrite = f.sync.getSnapshot().lastWriteAt;
  f.advance();
  f.sync.healthChanged();
  await f.sync.waitForIdle();
  assert.equal(f.sync.getSnapshot().lastWriteAt, actualWrite);
  assert.notEqual(f.sync.getSnapshot().lastReadAt, actualWrite);
  f.sync.dispose();
});

test('journal failure cancels a query, clears health data, and never leaves a stuck syncing state', async () => {
  const f = fixture();
  const entered = deferred<void>();
  const query = deferred<StateOfMindSample[]>();
  f.onRead(() => {
    entered.resolve();
    return query.promise;
  });
  f.sync.updateEntries([local()], true);
  await f.sync.initialize();
  await f.sync.enable();
  await entered.promise;
  f.sync.updateEntries([local()], false);
  query.resolve([incoming]);
  await f.sync.waitForIdle();
  assert.equal(f.sync.getSnapshot().busy, false);
  assert.equal(f.sync.getSnapshot().status, 'paused');
  assert.equal(f.sync.getSnapshot().records.length, 0);
  f.sync.dispose();
});

test('asynchronous observer failures cannot reset and exceed the recovery retry budget', async () => {
  const f = fixture({ retries: [1, 1, 1] });
  const timers: ReturnType<typeof setTimeout>[] = [];
  f.onStart(() => {
    timers.push(
      setTimeout(() => {
        f.observation.observing = false;
        f.observation.errorCode = 'ERR_MOOD_HEALTH_OBSERVER';
        f.sync.healthChanged();
      }, 2),
    );
  });
  await f.start();
  await new Promise((done) => setTimeout(done, 45));
  await f.sync.waitForIdle();
  assert.equal(f.counters.starts, 4);
  assert.equal(f.sync.getSnapshot().status, 'attention');
  assert.equal(f.counters.authorization, 1);
  f.sync.dispose();
  timers.forEach(clearTimeout);
});
