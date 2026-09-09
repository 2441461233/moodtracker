import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createHealthExporter as createExporterWithClock,
  HEALTH_EXPORT_RANGES,
  HEALTH_EXPORT_STORAGE_KEY,
  selectEntriesForHealth,
  toHealthSample,
  toSafeHealthError,
  type HealthSampleInput,
  type HealthSyncStorage,
} from '../src/health/core';
import type { MoodEntry } from '../src/types';

// These tests use in-memory storage and a fake save callback only. They do not
// request HealthKit permission, read real health data or exercise the native SDK.
const NOW = Date.UTC(2026, 0, 1, 12);
const DAY = 24 * 60 * 60 * 1000;
const UNKNOWN_FAILURE = {
  firstErrorCode: 'ERR_MOOD_HEALTH_UNKNOWN',
  firstErrorMessage: 'Apple 健康操作暂未完成。请解锁设备后重试；本地记录已保留。',
};
const createHealthExporter = (
  storage: HealthSyncStorage,
  save: (sample: HealthSampleInput) => Promise<{ uuid: string }>,
) => createExporterWithClock(storage, save, () => NOW);
function entry(id = 'one', overrides: Partial<MoodEntry> = {}): MoodEntry {
  return { id, emotionId: 'good', timestamp: Date.UTC(2025, 0, 1, 12), ...overrides };
}
class MemoryStorage implements HealthSyncStorage {
  raw: string | null;
  writes: string[] = [];
  reads = 0;
  failRead = false;
  failWriteAt = 0;
  attempts = 0;
  constructor(raw: string | null = null) {
    this.raw = raw;
  }
  async getItem(key: string) {
    assert.equal(key, HEALTH_EXPORT_STORAGE_KEY);
    this.reads++;
    if (this.failRead) throw new Error('read failed');
    return this.raw;
  }
  async setItem(key: string, value: string) {
    assert.equal(key, HEALTH_EXPORT_STORAGE_KEY);
    this.attempts++;
    if (this.attempts === this.failWriteAt) throw new Error('disk full');
    this.raw = value;
    this.writes.push(value);
  }
}
function recorder() {
  const calls: HealthSampleInput[] = [];
  return {
    calls,
    save: async (sample: HealthSampleInput) => {
      calls.push({ ...sample, associations: [...sample.associations] });
      return { uuid: `fake-${calls.length}` };
    },
  };
}
function records(
  storage: MemoryStorage,
): Record<string, { version: number; fingerprint: string; acknowledged: boolean }> {
  return JSON.parse(storage.raw!).records;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('explicit Apple State of Mind mapping', () => {
  test('maps exactly the five journal levels, without notes or emotional labels', () => {
    const values = { joyful: 1, good: 0.5, neutral: 0, anxious: -0.5, sad: -1 } as const;
    for (const [emotionId, valence] of Object.entries(values)) {
      const sample = toHealthSample(
        entry('sample', { emotionId: emotionId as MoodEntry['emotionId'], note: 'private note' }),
        3,
        NOW,
      );
      assert.deepEqual(sample, {
        syncIdentifier: 'moodtracker:sample',
        syncVersion: 3,
        timestamp: entry().timestamp,
        valence,
        kind: 'momentaryEmotion',
        associations: [],
      });
    }
  });
  test('maps only direct activity equivalents, sorted and deduplicated', () => {
    const original = entry('tags', {
      activityIds: [
        'work',
        'exercise',
        'friends',
        'family',
        'partner',
        'study',
        'hobby',
        'travel',
        'health',
        'sleep',
        'meditation',
        'chores',
        'reading',
        'shopping',
        'food',
        'work',
      ],
    });
    const before = JSON.stringify(original);
    assert.deepEqual(toHealthSample(original, 1, NOW).associations, [
      'education',
      'family',
      'fitness',
      'friends',
      'health',
      'hobbies',
      'partner',
      'travel',
      'work',
    ]);
    assert.equal(JSON.stringify(original), before);
  });
  test('uses legacy categories only when no explicit activity list exists', () => {
    assert.deepEqual(toHealthSample(entry('legacy', { categoryId: 'work' }), 1, NOW).associations, [
      'work',
    ]);
    assert.deepEqual(
      toHealthSample(entry('legacy', { categoryId: 'relationship' }), 1, NOW).associations,
      ['partner'],
    );
    assert.deepEqual(
      toHealthSample(entry('legacy', { categoryId: 'life' }), 1, NOW).associations,
      [],
    );
    assert.deepEqual(
      toHealthSample(entry('explicit', { categoryId: 'work', activityIds: [] }), 1, NOW)
        .associations,
      [],
    );
  });
  test('rejects invalid samples, unsupported moods, versions and clock values', () => {
    const invalid: unknown[] = [
      null,
      {},
      [],
      entry('', {}),
      entry('x'.repeat(161)),
      entry('bad', { emotionId: 'unknown' as never }),
      entry('bad', { timestamp: NaN }),
      entry('bad', { timestamp: Infinity }),
      entry('bad', { timestamp: -1 }),
      entry('bad', { timestamp: 8.64e15 + 1 }),
      entry('bad', { timestamp: '1' as never }),
      entry('bad', { timestamp: NOW + 1 }),
      entry('bad', { activityIds: ['unknown'] }),
      entry('bad', { note: 5 as never }),
    ];
    for (const item of invalid) assert.throws(() => toHealthSample(item as MoodEntry, 1, NOW));
    for (const version of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() => toHealthSample(entry(), version, NOW));
    for (const now of [-1, NaN, Infinity, 8.64e15 + 1])
      assert.throws(() => toHealthSample(entry(), 1, now));
    assert.equal(toHealthSample(entry('epoch', { timestamp: 0 }), 1, NOW).timestamp, 0);
    assert.equal(toHealthSample(entry('now', { timestamp: NOW }), 1, NOW).timestamp, NOW);
  });
});

describe('bounded manual export selection', () => {
  test('offers only 30, 90 and 365 days and includes exact time boundaries', () => {
    assert.deepEqual(HEALTH_EXPORT_RANGES, [30, 90, 365]);
    for (const days of HEALTH_EXPORT_RANGES) {
      const start = NOW - days * DAY;
      const incoming = [
        entry('now', { timestamp: NOW }),
        entry('future', { timestamp: NOW + 1 }),
        entry('before', { timestamp: start - 1 }),
        entry('start', { timestamp: start }),
        entry('middle', { timestamp: start + 1 }),
      ];
      const before = JSON.stringify(incoming);
      assert.deepEqual(
        selectEntriesForHealth(incoming, days, NOW).map((item) => item.id),
        ['start', 'middle', 'now'],
      );
      assert.equal(JSON.stringify(incoming), before);
    }
  });
  test('returns independent entry and activity copies with deterministic tie order', () => {
    const original = [
      entry('b', { timestamp: NOW, activityIds: ['work'] }),
      entry('a', { timestamp: NOW }),
    ];
    const selected = selectEntriesForHealth(original, 30, NOW);
    assert.deepEqual(
      selected.map((item) => item.id),
      ['a', 'b'],
    );
    selected[1].activityIds!.push('sleep');
    selected[1].note = 'new';
    assert.deepEqual(original[0].activityIds, ['work']);
    assert.equal(original[0].note, undefined);
  });
  test('rejects malformed collections and invalid range values even for empty data', () => {
    for (const days of [0, -1, 1, 31, 366, Infinity, NaN, '30'])
      assert.throws(() => selectEntriesForHealth([], days as never, NOW));
    for (const now of [-1, NaN, Infinity, 8.64e15 + 1])
      assert.throws(() => selectEntriesForHealth([], 30, now));
    assert.throws(() => selectEntriesForHealth([entry('duplicate'), entry('duplicate')], 30, NOW));
    assert.throws(() =>
      selectEntriesForHealth([entry('unknown', { emotionId: 'unknown' as never })], 30, NOW),
    );
    assert.throws(() => selectEntriesForHealth(null as never, 30, NOW));
    assert.throws(() =>
      selectEntriesForHealth(
        Array.from({ length: 10001 }, (_, index) => entry(String(index))),
        30,
        NOW,
      ),
    );
  });
  test('empty selection causes no writes or native calls', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    assert.deepEqual(selectEntriesForHealth([], 30, NOW), []);
    assert.deepEqual(await createHealthExporter(storage, native.save).exportEntries([]), {
      saved: 0,
      skipped: 0,
      failed: 0,
    });
    assert.equal(storage.raw, null);
    assert.equal(storage.writes.length, 0);
    assert.equal(native.calls.length, 0);
  });
});

describe('durable and idempotent HealthKit export coordination', () => {
  test('reserves a stable identifier and version before save, then acknowledges it', async () => {
    const storage = new MemoryStorage();
    const exported = entry('first', { note: 'private diary text', activityIds: ['work'] });
    const native = recorder();
    const exporter = createHealthExporter(storage, async (sample) => {
      assert.equal(storage.writes.length, 1);
      assert.equal(records(storage)[sample.syncIdentifier].version, sample.syncVersion);
      assert.equal(records(storage)[sample.syncIdentifier].acknowledged, false);
      return native.save(sample);
    });
    assert.deepEqual(await exporter.exportEntries([exported]), { saved: 1, skipped: 0, failed: 0 });
    assert.equal(native.calls[0].syncIdentifier, 'moodtracker:first');
    assert.equal(native.calls[0].syncVersion, NOW);
    assert.equal(records(storage)['moodtracker:first'].acknowledged, true);
    assert.equal(storage.writes.length, 2);
    for (const raw of storage.writes) {
      assert.ok(!raw.includes('private diary text'));
      assert.ok(!raw.includes('fake-'));
      assert.ok(!raw.includes('note'));
    }
  });
  test('repeated and note-only edits skip unchanged acknowledged payloads', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    const original = entry('same', { activityIds: ['work', 'sleep', 'family'] });
    await exporter.exportEntries([original]);
    assert.deepEqual(await exporter.exportEntries([original]), { saved: 0, skipped: 1, failed: 0 });
    assert.deepEqual(
      await exporter.exportEntries([
        {
          ...original,
          note: 'edited privately',
          updatedAt: NOW,
          activityIds: ['family', 'work', 'work', 'reading'],
        },
      ]),
      { saved: 0, skipped: 1, failed: 0 },
    );
    assert.equal(native.calls.length, 1);
    assert.equal(storage.writes.length, 2);
  });
  test('modified payloads increase versions monotonically, including reversions', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    const original = entry('changing');
    await exporter.exportEntries([original]);
    await exporter.exportEntries([{ ...original, emotionId: 'sad' }]);
    await exporter.exportEntries([{ ...original, timestamp: original.timestamp + 1 }]);
    await exporter.exportEntries([{ ...original, activityIds: ['work'] }]);
    await exporter.exportEntries([original]);
    assert.deepEqual(
      native.calls.map((sample) => sample.syncVersion),
      [NOW, NOW + 1, NOW + 2, NOW + 3, NOW + 4],
    );
    assert.equal(records(storage)['moodtracker:changing'].version, NOW + 4);
  });
  test('retains history for absent entries and after an exporter is recreated', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    await createHealthExporter(storage, native.save).exportEntries([
      entry('old'),
      entry('retained'),
    ]);
    const exporter = createHealthExporter(storage, native.save);
    await exporter.exportEntries([entry('new')]);
    assert.deepEqual(Object.keys(records(storage)).sort(), [
      'moodtracker:new',
      'moodtracker:old',
      'moodtracker:retained',
    ]);
    assert.deepEqual(await exporter.exportEntries([entry('old')]), {
      saved: 0,
      skipped: 1,
      failed: 0,
    });
    await exporter.exportEntries([entry('old', { emotionId: 'sad' })]);
    assert.equal(native.calls.at(-1)!.syncVersion, NOW + 1);
  });
  test('a failed native save retries the identical identifier and pending version', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    let fail = true;
    const exporter = createHealthExporter(storage, async (sample) => {
      await native.save(sample);
      if (fail) throw new Error('permission denied');
      return { uuid: 'fake-retry' };
    });
    assert.deepEqual(await exporter.exportEntries([entry()]), {
      saved: 0,
      skipped: 0,
      failed: 1,
      ...UNKNOWN_FAILURE,
    });
    assert.equal(records(storage)['moodtracker:one'].acknowledged, false);
    fail = false;
    assert.deepEqual(await exporter.exportEntries([entry()]), { saved: 1, skipped: 0, failed: 0 });
    assert.deepEqual(native.calls[0], native.calls[1]);
    assert.equal(storage.writes.length, 2, 'pending retry needs only an acknowledgement write');
  });
  test('editing a failed or uncertain pending payload reserves a higher version', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const exporter = createHealthExporter(storage, async (sample) => {
      await native.save(sample);
      throw new Error('uncertain native outcome');
    });
    await exporter.exportEntries([entry()]);
    await exporter.exportEntries([entry('one', { emotionId: 'sad' })]);
    await exporter.exportEntries([entry()]);
    assert.deepEqual(
      native.calls.map((sample) => sample.syncVersion),
      [NOW, NOW + 1, NOW + 2],
    );
    assert.equal(records(storage)['moodtracker:one'].acknowledged, false);
  });
  test('reports partial native failures and retries only unacknowledged entries', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    let fail = true;
    const exporter = createHealthExporter(storage, async (sample) => {
      const response = await native.save(sample);
      if (fail && sample.syncIdentifier === 'moodtracker:failed')
        throw new Error('temporary native error');
      return response;
    });
    const batch = [entry('first'), entry('failed'), entry('last')];
    assert.deepEqual(await exporter.exportEntries(batch), {
      saved: 2,
      skipped: 0,
      failed: 1,
      ...UNKNOWN_FAILURE,
    });
    assert.equal(native.calls.length, 3);
    fail = false;
    assert.deepEqual(await exporter.exportEntries(batch), { saved: 1, skipped: 2, failed: 0 });
    assert.equal(native.calls.length, 4);
    assert.equal(native.calls.at(-1)!.syncIdentifier, 'moodtracker:failed');
    assert.equal(native.calls.at(-1)!.syncVersion, NOW);
  });
  test('empty or malformed native confirmations stay pending instead of claiming success', async () => {
    for (const response of [undefined, null, {}, { uuid: '' }, { uuid: ' ' }, { uuid: 1 }]) {
      const storage = new MemoryStorage();
      const exporter = createHealthExporter(storage, async () => response as never);
      assert.deepEqual(await exporter.exportEntries([entry()]), {
        saved: 0,
        skipped: 0,
        failed: 1,
        ...UNKNOWN_FAILURE,
      });
      assert.equal(records(storage)['moodtracker:one'].acknowledged, false);
    }
  });
  test('concurrent batch requests serialize and do not reserve the same version twice', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const started = deferred();
    const release = deferred();
    let active = 0;
    let maxActive = 0;
    const exporter = createHealthExporter(storage, async (sample) => {
      active++;
      maxActive = Math.max(active, maxActive);
      if (native.calls.length === 0) {
        started.resolve();
        await release.promise;
      }
      const response = await native.save(sample);
      active--;
      return response;
    });
    const first = exporter.exportEntries([entry()]);
    await started.promise;
    const same = exporter.exportEntries([entry()]);
    const changed = exporter.exportEntries([entry('one', { emotionId: 'sad' })]);
    assert.equal(storage.reads, 1);
    release.resolve();
    assert.deepEqual(await Promise.all([first, same, changed]), [
      { saved: 1, skipped: 0, failed: 0 },
      { saved: 0, skipped: 1, failed: 0 },
      { saved: 1, skipped: 0, failed: 0 },
    ]);
    assert.equal(maxActive, 1);
    assert.deepEqual(
      native.calls.map((sample) => sample.syncVersion),
      [NOW, NOW + 1],
    );
  });
  test('snapshots caller input immediately and isolates it from callback mutations', async () => {
    const storage = new MemoryStorage();
    const incoming = entry('snapshot', { activityIds: ['work'] });
    const exporter = createHealthExporter(storage, async (sample) => {
      assert.equal(sample.valence, 0.5);
      assert.deepEqual(sample.associations, ['work']);
      sample.associations.push('family');
      sample.valence = -1;
      return { uuid: 'fake-mutating-callback' };
    });
    const pending = exporter.exportEntries([incoming]);
    incoming.emotionId = 'sad';
    incoming.activityIds!.push('family');
    incoming.note = 'not queued';
    await pending;
    const stored = JSON.parse(records(storage)['moodtracker:snapshot'].fingerprint);
    assert.equal(stored.valence, 0.5);
    assert.deepEqual(stored.associations, ['work']);
    assert.ok(!storage.raw!.includes('not queued'));
  });
  test('the maximum journal-sized export uses two durable writes, not one per sample', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const exporter = createHealthExporter(storage, async (sample) => {
      assert.equal(storage.writes.length, 1, 'all pending versions precede all native writes');
      return native.save(sample);
    });
    const batch = Array.from({ length: 10000 }, (_, index) => entry(String(index)));
    assert.deepEqual(await exporter.exportEntries(batch), { saved: 10000, skipped: 0, failed: 0 });
    assert.equal(native.calls.length, 10000);
    assert.equal(storage.writes.length, 2);
    assert.equal(Object.keys(records(storage)).length, 10000);
  });
});

describe('safe actionable HealthKit errors', () => {
  test('known codes produce fixed action messages without exposing native details', () => {
    const codes = [
      'ERR_MOOD_HEALTH_AUTHORIZATION_REQUIRED',
      'ERR_MOOD_HEALTH_READ_REQUEST_REQUIRED',
      'ERR_MOOD_HEALTH_AUTHORIZATION',
      'ERR_MOOD_HEALTH_QUERY',
      'ERR_MOOD_HEALTH_SAVE',
      'ERR_MOOD_HEALTH_SAVE_UNVERIFIED',
      'ERR_MOOD_HEALTH_SYNC_CONFLICT',
      'ERR_MOOD_HEALTH_CONFIGURATION',
      'ERR_MOOD_HEALTH_UNAVAILABLE',
      'ERR_MOOD_HEALTH_BACKGROUND_DELIVERY',
      'ERR_MOOD_HEALTH_INVALID_INPUT',
    ];
    for (const code of codes) {
      const sensitive = Object.assign(new Error('private health sample, source and diary note'), {
        code,
        sample: { uuid: 'private-uuid', valence: -0.5 },
      });
      const safe = toSafeHealthError(sensitive);
      assert.equal(safe.code, code);
      assert.ok(safe.message.length > 0);
      assert.equal(safe.message, toSafeHealthError({ code, message: 'different text' }).message);
      assert.deepEqual(Object.keys(safe), ['code', 'message']);
      assert.ok(!JSON.stringify(safe).includes('private'));
    }
    assert.match(toSafeHealthError({ code: codes[0] }).message, /权限/);
    assert.match(toSafeHealthError({ code: codes[4] }).message, /解锁/);
    assert.match(toSafeHealthError({ code: codes[6] }).message, /版本冲突/);
    assert.match(toSafeHealthError({ code: codes[7] }).message, /更新应用/);
  });

  test('unknown, malformed, sensitive, and throwing codes normalize without leaks', () => {
    const unknown = {
      code: UNKNOWN_FAILURE.firstErrorCode,
      message: UNKNOWN_FAILURE.firstErrorMessage,
    };
    for (const error of [
      undefined,
      null,
      'private sample text',
      42,
      new Error('private message'),
      { code: 'ERR_MOOD_HEALTH_PATIENT_PRIVATE_INFORMATION' },
      { code: 'ERR_MOOD_HEALTH_SAVE\nprivate note' },
      { code: `ERR_MOOD_HEALTH_${'A'.repeat(65)}` },
      { code: 'ERR_MOOD_HEALTH_save' },
      { code: 'HKErrorAuthorizationDenied' },
      { code: ['ERR_MOOD_HEALTH_SAVE'] },
      { code: { toString: () => 'ERR_MOOD_HEALTH_SAVE' } },
      {
        get code() {
          throw new Error('private getter data');
        },
      },
    ])
      assert.deepEqual(toSafeHealthError(error), unknown);
  });

  test('a batch reports only its first sanitized failure and keeps successful acknowledgements', async () => {
    const storage = new MemoryStorage();
    const exporter = createHealthExporter(storage, async (sample) => {
      if (sample.syncIdentifier === 'moodtracker:success') return { uuid: 'saved' };
      throw Object.assign(new Error('private health payload'), {
        code:
          sample.syncIdentifier === 'moodtracker:first'
            ? 'ERR_MOOD_HEALTH_AUTHORIZATION_REQUIRED'
            : 'ERR_MOOD_HEALTH_SYNC_CONFLICT',
      });
    });
    const result = await exporter.exportEntries([
      entry('first'),
      entry('second'),
      entry('success'),
    ]);
    assert.equal(result.saved, 1);
    assert.equal(result.failed, 2);
    assert.equal(result.firstErrorCode, 'ERR_MOOD_HEALTH_AUTHORIZATION_REQUIRED');
    assert.match(result.firstErrorMessage!, /权限/);
    assert.ok(!JSON.stringify(result).includes('private'));
    assert.equal(records(storage)['moodtracker:success'].acknowledged, true);
    assert.equal(records(storage)['moodtracker:first'].acknowledged, false);
  });
});

describe('cancellable automatic HealthKit batches', () => {
  test('an already aborted request does not read, reserve, or save anything', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const controller = new AbortController();
    controller.abort();
    assert.deepEqual(
      await createHealthExporter(storage, native.save).exportEntries([entry()], {
        signal: controller.signal,
      }),
      { saved: 0, skipped: 0, failed: 0 },
    );
    assert.equal(storage.reads, 0);
    assert.equal(storage.writes.length, 0);
    assert.equal(native.calls.length, 0);
  });

  test('mid-batch abort acknowledges the active save and leaves unattempted versions safely pending', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const controller = new AbortController();
    const exporter = createHealthExporter(storage, async (sample) => {
      const response = await native.save(sample);
      if (native.calls.length === 1) controller.abort();
      return response;
    });
    const batch = [entry('first'), entry('second'), entry('third')];
    assert.deepEqual(await exporter.exportEntries(batch, { signal: controller.signal }), {
      saved: 1,
      skipped: 0,
      failed: 0,
    });
    assert.equal(native.calls.length, 1);
    const reserved = records(storage);
    assert.equal(reserved['moodtracker:first'].acknowledged, true);
    assert.equal(reserved['moodtracker:second'].acknowledged, false);
    assert.equal(reserved['moodtracker:third'].acknowledged, false);
    assert.deepEqual(await exporter.exportEntries(batch), { saved: 2, skipped: 1, failed: 0 });
    assert.deepEqual(
      native.calls.map((sample) => sample.syncIdentifier),
      ['moodtracker:first', 'moodtracker:second', 'moodtracker:third'],
    );
    assert.equal(native.calls[1].syncVersion, reserved['moodtracker:second'].version);
    assert.equal(native.calls[2].syncVersion, reserved['moodtracker:third'].version);
  });

  test('a queued batch aborted before it starts never reserves its snapshot', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const started = deferred();
    const release = deferred();
    const exporter = createHealthExporter(storage, async (sample) => {
      started.resolve();
      await release.promise;
      return native.save(sample);
    });
    const active = exporter.exportEntries([entry('active')]);
    await started.promise;
    const controller = new AbortController();
    const queued = exporter.exportEntries([entry('obsolete')], { signal: controller.signal });
    controller.abort();
    release.resolve();
    await active;
    assert.deepEqual(await queued, { saved: 0, skipped: 0, failed: 0 });
    assert.equal(native.calls.length, 1);
    assert.equal(storage.reads, 1);
    assert.equal(records(storage)['moodtracker:obsolete'], undefined);
  });
});

describe('timestamp-scale versions and clock safety', () => {
  test('a restored journal without its old ledger starts at the newer device clock', async () => {
    const native = recorder();
    await createExporterWithClock(new MemoryStorage(), native.save, () => NOW).exportEntries([
      entry(),
    ]);
    await createExporterWithClock(new MemoryStorage(), native.save, () => NOW + DAY).exportEntries([
      entry(),
    ]);
    assert.deepEqual(
      native.calls.map((sample) => sample.syncVersion),
      [NOW, NOW + DAY],
    );
  });
  test('versions follow a forward clock and remain monotonic when the clock moves back', async () => {
    const native = recorder();
    let clock = NOW;
    const exporter = createExporterWithClock(new MemoryStorage(), native.save, () => clock);
    await exporter.exportEntries([entry()]);
    clock += DAY;
    await exporter.exportEntries([entry('one', { emotionId: 'sad' })]);
    clock = NOW;
    await exporter.exportEntries([entry()]);
    assert.deepEqual(
      native.calls.map((sample) => sample.syncVersion),
      [NOW, NOW + DAY, NOW + DAY + 1],
    );
  });
  test('a pending retry does not change version when the device clock advances', async () => {
    const native = recorder();
    let clock = NOW;
    let fail = true;
    const exporter = createExporterWithClock(
      new MemoryStorage(),
      async (sample) => {
        await native.save(sample);
        if (fail) throw new Error('temporary failure');
        return { uuid: 'fake-retry' };
      },
      () => clock,
    );
    await exporter.exportEntries([entry()]);
    clock += DAY;
    fail = false;
    await exporter.exportEntries([entry()]);
    assert.deepEqual(
      native.calls.map((sample) => sample.syncVersion),
      [NOW, NOW],
    );
  });
  test('invalid clocks reject before storage or native operations', async () => {
    for (const clock of [-1, NaN, Infinity, NOW + 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const storage = new MemoryStorage();
      const native = recorder();
      const exporter = createExporterWithClock(storage, native.save, () => clock);
      await assert.rejects(exporter.exportEntries([entry()]), /当前时间无效/);
      assert.equal(storage.reads, 0);
      assert.equal(storage.writes.length, 0);
      assert.equal(native.calls.length, 0);
    }
  });
});

describe('fail-closed export bookkeeping', () => {
  test('validates the whole batch before any ledger or native side effects', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    const invalid: unknown[] = [
      [entry('valid'), entry('bad', { emotionId: 'unknown' as never })],
      [entry('valid'), entry('bad', { timestamp: Date.now() + DAY })],
      [entry('valid'), entry('bad', { timestamp: NaN })],
      [entry('valid'), entry('bad', { timestamp: -1 })],
      [entry('same'), entry('same')],
      null,
      {},
    ];
    for (const batch of invalid) await assert.rejects(exporter.exportEntries(batch as MoodEntry[]));
    assert.equal(storage.reads, 0);
    assert.equal(storage.writes.length, 0);
    assert.equal(native.calls.length, 0);
    assert.deepEqual(await exporter.exportEntries([entry('valid')]), {
      saved: 1,
      skipped: 0,
      failed: 0,
    });
  });
  test('a ledger read failure never writes and does not poison the serial queue', async () => {
    const storage = new MemoryStorage();
    storage.failRead = true;
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    await assert.rejects(exporter.exportEntries([entry()]), /原始数据已保留/);
    assert.equal(storage.raw, null);
    assert.equal(native.calls.length, 0);
    storage.failRead = false;
    assert.deepEqual(await exporter.exportEntries([entry()]), { saved: 1, skipped: 0, failed: 0 });
  });
  test('a failed pending write stops before native save and can be retried safely', async () => {
    const storage = new MemoryStorage();
    storage.failWriteAt = 1;
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    await assert.rejects(exporter.exportEntries([entry()]), /进度无法保存/);
    assert.equal(storage.raw, null);
    assert.equal(native.calls.length, 0);
    assert.deepEqual(await exporter.exportEntries([entry()]), { saved: 1, skipped: 0, failed: 0 });
    assert.equal(native.calls[0].syncVersion, NOW);
  });
  test('a failed batch acknowledgement preserves every durable version for an idempotent retry', async () => {
    const storage = new MemoryStorage();
    storage.failWriteAt = 2;
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    await assert.rejects(
      exporter.exportEntries([entry('first'), entry('second')]),
      /部分记录可能已写入/,
    );
    assert.equal(native.calls.length, 2);
    assert.deepEqual(Object.keys(records(storage)), ['moodtracker:first', 'moodtracker:second']);
    assert.equal(records(storage)['moodtracker:first'].acknowledged, false);
    assert.equal(records(storage)['moodtracker:second'].acknowledged, false);
    assert.deepEqual(await exporter.exportEntries([entry('first'), entry('second')]), {
      saved: 2,
      skipped: 0,
      failed: 0,
    });
    assert.deepEqual(native.calls[0], native.calls[2]);
    assert.deepEqual(native.calls[1], native.calls[3]);
  });
  test('a failed version reservation preserves the earlier version and never invokes native with the edit', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    await exporter.exportEntries([entry()]);
    const original = storage.raw;
    storage.failWriteAt = 3;
    await assert.rejects(
      exporter.exportEntries([entry('one', { emotionId: 'sad' })]),
      /进度无法保存/,
    );
    assert.equal(storage.raw, original);
    assert.equal(native.calls.length, 1);
    await exporter.exportEntries([entry('one', { emotionId: 'sad' })]);
    assert.equal(native.calls.at(-1)!.syncVersion, NOW + 1);
  });
  test('corrupt ledgers are retained byte-for-byte with no reset, native save or unrelated batch writes', async () => {
    const healthy = new MemoryStorage();
    await createHealthExporter(healthy, recorder().save).exportEntries([entry()]);
    const original = JSON.parse(healthy.raw!);
    const goodRecord = original.records['moodtracker:one'];
    const ledger = (record: unknown, identifier = 'moodtracker:one') =>
      JSON.stringify({ version: 1, records: { [identifier]: record } });
    const badFingerprints = [
      '',
      '{',
      '{}',
      '[]',
      JSON.stringify({ timestamp: -1, valence: 0.5, kind: 'momentaryEmotion', associations: [] }),
      JSON.stringify({
        timestamp: entry().timestamp,
        valence: 2,
        kind: 'momentaryEmotion',
        associations: [],
      }),
      JSON.stringify({
        timestamp: entry().timestamp,
        valence: 0.5,
        kind: 'dailyMood',
        associations: [],
      }),
      JSON.stringify({
        timestamp: entry().timestamp,
        valence: 0.5,
        kind: 'momentaryEmotion',
        associations: ['sleep'],
      }),
      JSON.stringify({
        timestamp: entry().timestamp,
        valence: 0.5,
        kind: 'momentaryEmotion',
        associations: ['work', 'family'],
      }),
      JSON.stringify({
        timestamp: entry().timestamp,
        valence: 0.5,
        kind: 'momentaryEmotion',
        associations: ['work', 'work'],
      }),
      JSON.stringify({
        timestamp: entry().timestamp,
        valence: 0.5,
        kind: 'momentaryEmotion',
        associations: [],
        note: 'unexpected field',
      }),
    ];
    const invalid = [
      '',
      '{',
      'null',
      '[]',
      '{}',
      JSON.stringify({ version: 2, records: {} }),
      JSON.stringify({ version: 1, records: [] }),
      JSON.stringify({ version: 1, records: null }),
      JSON.stringify({ version: 1, records: {}, note: 'unexpected field' }),
      '{"version":1,"version":1,"records":{}}',
      `{"version":1,"records":{"moodtracker:one":${JSON.stringify(goodRecord)},"moodtracker:one":${JSON.stringify(goodRecord)}}}`,
      ledger(null),
      ledger([]),
      ledger({}),
      ledger({ ...goodRecord, version: 0 }),
      ledger({ ...goodRecord, version: -1 }),
      ledger({ ...goodRecord, version: 1.2 }),
      ledger({ ...goodRecord, version: Number.MAX_SAFE_INTEGER + 1 }),
      ledger({ ...goodRecord, acknowledged: 'yes' }),
      ledger({ ...goodRecord, note: 'unexpected field' }),
      ledger(goodRecord, 'wrong-prefix:one'),
      ledger(goodRecord, 'moodtracker:'),
      ledger(goodRecord, `moodtracker:${'x'.repeat(161)}`),
      ...badFingerprints.map((fingerprint) => ledger({ ...goodRecord, fingerprint })),
    ];
    for (const raw of invalid) {
      const storage = new MemoryStorage(raw);
      const native = recorder();
      const exporter = createHealthExporter(storage, native.save);
      await assert.rejects(exporter.exportEntries([entry('unrelated')]), /原始数据已保留/, raw);
      assert.equal(storage.raw, raw);
      assert.equal(storage.writes.length, 0);
      assert.equal(native.calls.length, 0);
    }
  });
  test('version exhaustion fails closed instead of reusing an earlier version', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    await exporter.exportEntries([entry()]);
    const ledger = JSON.parse(storage.raw!);
    ledger.records['moodtracker:one'].version = Number.MAX_SAFE_INTEGER;
    storage.raw = JSON.stringify(ledger);
    const before = storage.raw;
    await assert.rejects(exporter.exportEntries([entry('one', { emotionId: 'sad' })]), /版本无效/);
    assert.equal(storage.raw, before);
    assert.equal(native.calls.length, 1);
  });
  test('prototype-like journal IDs do not collide with ledger object properties', async () => {
    const storage = new MemoryStorage();
    const native = recorder();
    const exporter = createHealthExporter(storage, native.save);
    const batch = ['__proto__', 'constructor', 'toString'].map((id) => entry(id));
    assert.deepEqual(await exporter.exportEntries(batch), { saved: 3, skipped: 0, failed: 0 });
    assert.deepEqual(await exporter.exportEntries(batch), { saved: 0, skipped: 3, failed: 0 });
    assert.equal(Object.keys(records(storage)).length, 3);
  });
});
