import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createMoodStorage,
  DEFAULT_SETTINGS,
  MAX_BACKUP_BYTES,
  parseBackup,
  SETTINGS_KEY,
  STORAGE_KEY,
  validateEntries,
  type StorageAdapter,
} from '../src/storage/core';
import {
  addDays,
  dayKey,
  formatDate,
  formatTime,
  getGreeting,
  monthDays,
  parseLocalDate,
  startOfDay,
  startOfWeek,
} from '../src/lib/dates';
import {
  activityInsights,
  averageMood,
  currentStreak,
  dailyAverage,
  emotionForScore,
  entriesInRange,
  groupByDay,
  MOOD_SCORES,
} from '../src/lib/insights';
import { ACTIVITIES, getActivity, getActivityIds } from '../src/data/activities';
import type { MoodEntry } from '../src/types';

// Run with npm test.
// All adapters are in-memory; these tests never touch a user's actual data.
function entry(
  id: string,
  date = new Date(2026, 8, 2, 12),
  overrides: Partial<MoodEntry> = {},
): MoodEntry {
  return { id, emotionId: 'good', timestamp: date.getTime(), ...overrides };
}
class MemoryAdapter implements StorageAdapter {
  values = new Map<string, string>();
  writes: Array<[string, string]> = [];
  failNextRead = false;
  failNextWrite = false;
  writeGate: Promise<void> | undefined;
  constructor(raw?: string) {
    if (raw !== undefined) this.values.set(STORAGE_KEY, raw);
  }
  async getItem(key: string) {
    await Promise.resolve();
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error('read unavailable');
    }
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    await Promise.resolve();
    if (this.writeGate) await this.writeGate;
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('disk full');
    }
    this.writes.push([key, value]);
    this.values.set(key, value);
  }
}
function withTimezone<T>(zone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}
const ids = (entries: MoodEntry[]) => entries.map((item) => item.id).sort();

describe('legacy schema and backup validation', () => {
  test('all legacy emotion/category IDs and optional notes remain compatible', () => {
    const legacy: MoodEntry[] = [
      entry('1', new Date(2026, 0, 1), {
        emotionId: 'joyful',
        categoryId: 'work',
        note: '旧日记 😌',
      }),
      entry('2', new Date(2026, 0, 2), { emotionId: 'good', categoryId: 'life' }),
      entry('3', new Date(2026, 0, 3), {
        emotionId: 'neutral',
        categoryId: 'relationship',
        note: '',
      }),
      entry('4', new Date(2026, 0, 4), { emotionId: 'anxious', categoryId: 'other' }),
      entry('5', new Date(2026, 0, 5), { emotionId: 'sad' }),
    ];
    const original = JSON.stringify(legacy);
    const expected = [...legacy].reverse();
    assert.deepEqual(validateEntries(legacy), expected);
    assert.deepEqual(parseBackup(original), expected);
    assert.deepEqual(
      parseBackup(JSON.stringify({ app: 'moodtracker', version: 2, entries: legacy })),
      expected,
    );
    assert.equal(JSON.stringify(legacy), original, 'validation must not mutate its input');
  });
  test('normalizes duplicate activity tags but preserves explicit empty tags', () => {
    const tagged = entry('tagged', undefined, { activityIds: ['work', 'work', 'sleep'] });
    const normalized = validateEntries([tagged])[0];
    assert.deepEqual(normalized.activityIds, ['work', 'sleep']);
    assert.deepEqual(tagged.activityIds, ['work', 'work', 'sleep']);
    assert.deepEqual(
      validateEntries([entry('empty', undefined, { categoryId: 'work', activityIds: [] })])[0]
        .activityIds,
      [],
    );
  });
  test('rejects duplicate IDs rather than silently dropping either record', () => {
    assert.throws(() =>
      validateEntries([entry('same'), entry('same', undefined, { note: 'different content' })]),
    );
  });
  test('rejects malformed backup envelopes and unsupported versions', () => {
    for (const raw of [
      '{',
      'null',
      'true',
      '{}',
      '{"app":"other","version":2,"entries":[]}',
      '{"app":"moodtracker","version":3,"entries":[]}',
    ]) {
      assert.throws(() => parseBackup(raw), Error, raw);
    }
    assert.deepEqual(parseBackup('[]'), []);
  });
  test('rejects unsupported or unrenderable entry fields', () => {
    const invalid: unknown[] = [
      null,
      [],
      {},
      entry('', undefined),
      entry('a', undefined, { id: 'x'.repeat(161) }),
      entry('a', undefined, { emotionId: 'unknown' as never }),
      entry('a', undefined, { categoryId: 'unknown' as never }),
      entry('a', undefined, { timestamp: NaN }),
      entry('a', undefined, { timestamp: -1 }),
      entry('a', undefined, { timestamp: 8.64e15 + 1 }),
      entry('a', undefined, { timestamp: '123' as never }),
      entry('a', undefined, { note: 42 as never }),
      entry('a', undefined, { note: 'x'.repeat(4001) }),
      entry('a', undefined, { activityIds: 'work' as never }),
      entry('a', undefined, { activityIds: ['unknown'] }),
      entry('a', undefined, { activityIds: Array(25).fill('work') }),
      entry('a', undefined, { updatedAt: Infinity }),
      entry('a', undefined, { updatedAt: -1 }),
      entry('a', undefined, { updatedAt: 8.64e15 + 1 }),
    ];
    for (const item of invalid) assert.throws(() => validateEntries([item]));
    assert.throws(() => validateEntries({ entries: [] }));
    assert.throws(() => validateEntries(Array.from({ length: 10001 }, (_, i) => entry(String(i)))));
  });
  test('10 MB limit measures UTF-8 bytes, not JavaScript string length', () => {
    // Valid Chinese-heavy entries: fewer than 10 MB code units, more than
    // 10 MB on disk. This is a regression test for the original raw.length check.
    const raw = JSON.stringify(
      Array.from({ length: 900 }, (_, i) =>
        entry(String(i), undefined, { note: '心'.repeat(4000) }),
      ),
    );
    assert.ok(raw.length < MAX_BACKUP_BYTES);
    assert.ok(Buffer.byteLength(raw, 'utf8') > MAX_BACKUP_BYTES);
    assert.throws(() => parseBackup(raw), /10 MB/);
  });
});

describe('serialized and failure-safe persistence', () => {
  test('starts empty without writing or injecting sample entries', async () => {
    const adapter = new MemoryAdapter();
    const store = createMoodStorage(adapter);
    assert.deepEqual(await store.read(), []);
    assert.equal(await store.raw(), null);
    assert.equal(adapter.writes.length, 0);
  });
  test('reads a legacy array without silently rewriting it', async () => {
    const raw = JSON.stringify(
      [entry('old', undefined, { categoryId: 'relationship', note: '保留' })],
      null,
      2,
    );
    const adapter = new MemoryAdapter(raw);
    const store = createMoodStorage(adapter);
    assert.deepEqual(await store.read(), JSON.parse(raw));
    assert.equal(await store.raw(), raw);
    assert.equal(adapter.writes.length, 0);
  });
  test('concurrent saves retain every entry', async () => {
    const adapter = new MemoryAdapter();
    const store = createMoodStorage(adapter);
    const incoming = Array.from({ length: 30 }, (_, i) =>
      entry(String(i), new Date(2026, 0, i + 1)),
    );
    await Promise.all(incoming.map((item) => store.save(item)));
    assert.deepEqual(ids(await store.read()), ids(incoming));
    assert.equal(adapter.writes.length, incoming.length);
  });
  test('save, update, remove and import are ordered without resurrecting deleted records', async () => {
    const adapter = new MemoryAdapter(
      JSON.stringify([entry('a', undefined, { note: 'initial' }), entry('b')]),
    );
    const store = createMoodStorage(adapter);
    const results = await Promise.all([
      store.save(entry('c')),
      store.update(entry('a', undefined, { note: 'edited', updatedAt: Date.now() })),
      store.remove('b'),
      store.merge([entry('a', undefined, { note: 'old backup' }), entry('d')]),
    ]);
    const result = await store.read();
    assert.deepEqual(ids(result), ['a', 'c', 'd']);
    assert.equal(result.find((item) => item.id === 'a')?.note, 'edited');
    assert.deepEqual(
      { added: results[3].added, skipped: results[3].skipped },
      { added: 1, skipped: 1 },
    );
  });
  test('double submit accepts one record and rejects the duplicate', async () => {
    const adapter = new MemoryAdapter();
    const store = createMoodStorage(adapter);
    const results = await Promise.allSettled([
      store.save(entry('same')),
      store.save(entry('same')),
    ]);
    assert.deepEqual(
      results.map((result) => result.status),
      ['fulfilled', 'rejected'],
    );
    assert.deepEqual(ids(await store.read()), ['same']);
    assert.equal(adapter.writes.length, 1);
  });
  test('invalid save or missing update never writes and does not poison the queue', async () => {
    const raw = JSON.stringify([entry('original')]);
    const adapter = new MemoryAdapter(raw);
    const store = createMoodStorage(adapter);
    await assert.rejects(store.save(entry('bad', undefined, { emotionId: 'unknown' as never })));
    await assert.rejects(store.update(entry('missing')));
    assert.equal(await store.raw(), raw);
    assert.equal(adapter.writes.length, 0);
    await store.save(entry('valid'));
    assert.deepEqual(ids(await store.read()), ['original', 'valid']);
  });
  test('corrupt or duplicate-ID local data is retained byte-for-byte after rejected operations', async () => {
    for (const raw of ['{broken', '{}', JSON.stringify([entry('same'), entry('same')])]) {
      const adapter = new MemoryAdapter(raw);
      const store = createMoodStorage(adapter);
      await assert.rejects(store.read(), /原始数据已保留/);
      await assert.rejects(store.save(entry('new')));
      await assert.rejects(store.update(entry('new')));
      await assert.rejects(store.remove('same'));
      await assert.rejects(store.merge([entry('new')]));
      assert.equal(await store.raw(), raw);
      assert.equal(adapter.writes.length, 0);
    }
  });
  test('adapter read failure does not become an empty successful write', async () => {
    const raw = JSON.stringify([entry('original')]);
    const adapter = new MemoryAdapter(raw);
    const store = createMoodStorage(adapter);
    adapter.failNextRead = true;
    await assert.rejects(store.save(entry('new')), /read unavailable/);
    assert.equal(await store.raw(), raw);
    assert.equal(adapter.writes.length, 0);
    await store.save(entry('retry'));
    assert.deepEqual(ids(await store.read()), ['original', 'retry']);
  });
  test('failed writes preserve old data and allow a later queued operation to succeed', async () => {
    const raw = JSON.stringify([entry('original')]);
    const adapter = new MemoryAdapter(raw);
    const store = createMoodStorage(adapter);
    adapter.failNextWrite = true;
    await assert.rejects(store.save(entry('failed')), /disk full/);
    assert.equal(await store.raw(), raw);
    await store.save(entry('retry'));
    assert.deepEqual(ids(await store.read()), ['original', 'retry']);
    adapter.failNextWrite = true;
    await assert.rejects(store.remove('original'), /disk full/);
    assert.deepEqual(ids(await store.read()), ['original', 'retry']);
  });
  test('save does not resolve before the persistence adapter acknowledges the write', async () => {
    const adapter = new MemoryAdapter();
    let release!: () => void;
    adapter.writeGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = createMoodStorage(adapter);
    let resolved = false;
    const save = store.save(entry('pending')).then(() => {
      resolved = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(resolved, false);
    assert.equal(adapter.values.has(STORAGE_KEY), false);
    release();
    await save;
    assert.equal(resolved, true);
    assert.deepEqual(ids(await store.read()), ['pending']);
  });
  test('imports are additive and idempotent, preserving newer local edits', async () => {
    const adapter = new MemoryAdapter(
      JSON.stringify([entry('same', undefined, { note: 'local edit' })]),
    );
    const store = createMoodStorage(adapter);
    const backup = parseBackup(
      JSON.stringify([
        entry('same', undefined, { note: 'older backup' }),
        entry('legacy', undefined, { categoryId: 'life' }),
      ]),
    );
    const first = await store.merge(backup);
    assert.equal(first.added, 1);
    assert.equal(first.skipped, 1);
    assert.equal(first.entries.find((item) => item.id === 'same')?.note, 'local edit');
    const second = await store.merge(backup);
    assert.equal(second.added, 0);
    assert.equal(second.skipped, 2);
    assert.deepEqual(ids(second.entries), ['legacy', 'same']);
  });
  test('invalid import is atomic and never modifies valid local data', async () => {
    const raw = JSON.stringify([entry('existing')]);
    const adapter = new MemoryAdapter(raw);
    const store = createMoodStorage(adapter);
    await assert.rejects(
      store.merge([entry('valid'), entry('invalid', undefined, { activityIds: ['unsupported'] })]),
    );
    assert.equal(await store.raw(), raw);
    assert.equal(adapter.writes.length, 0);
  });
  test('settings use a separate key, sanitize invalid data and leave moods intact', async () => {
    const raw = JSON.stringify([entry('existing')]);
    const adapter = new MemoryAdapter(raw);
    const store = createMoodStorage(adapter);
    assert.deepEqual(await store.settings(), DEFAULT_SETTINGS);
    adapter.values.set(SETTINGS_KEY, '{bad');
    assert.deepEqual(await store.settings(), DEFAULT_SETTINGS);
    adapter.values.set(
      SETTINGS_KEY,
      JSON.stringify({ name: 'x'.repeat(30), theme: 'unknown', haptics: 'no' }),
    );
    assert.deepEqual(await store.settings(), {
      name: 'x'.repeat(24),
      theme: 'light',
      haptics: true,
    });
    await store.saveSettings({ name: 'Evan', theme: 'dark', haptics: false });
    assert.deepEqual(await store.settings(), { name: 'Evan', theme: 'dark', haptics: false });
    assert.equal(await store.raw(), raw);
  });
});

describe('local dates and calendar boundaries', () => {
  test('local day keys do not accidentally group by UTC dates', () =>
    withTimezone('Asia/Shanghai', () => {
      const local = new Date(2026, 8, 2, 0, 30);
      assert.equal(dayKey(local), '2026-09-02');
      assert.equal(dayKey(local.getTime()), '2026-09-02');
      assert.equal(local.toISOString().slice(0, 10), '2026-09-01');
      assert.equal(formatTime(local), '00:30');
      assert.equal(formatDate(local), '9月2日 · 周三');
    }));
  test('start of day and addDays return new objects without mutating input', () => {
    const date = new Date(2026, 11, 31, 23, 59, 58, 50);
    const original = date.getTime();
    assert.equal(startOfDay(date).getHours(), 0);
    assert.equal(dayKey(addDays(date, 1)), '2027-01-01');
    assert.equal(dayKey(addDays(new Date(2026, 0, 1), -1)), '2025-12-31');
    assert.equal(date.getTime(), original);
  });
  test('weeks start Monday even on Sunday and over year boundaries', () => {
    assert.equal(dayKey(startOfWeek(new Date(2026, 8, 7, 22))), '2026-09-07');
    assert.equal(dayKey(startOfWeek(new Date(2026, 8, 6, 22))), '2026-08-31');
    assert.equal(dayKey(startOfWeek(new Date(2026, 0, 1, 22))), '2025-12-29');
    assert.equal(startOfWeek(new Date()).getHours(), 0);
  });
  test('month grid has Monday-first padding, leap day and whole weeks', () => {
    const leap = monthDays(new Date(2024, 1, 17));
    assert.equal(leap.filter(Boolean).length, 29);
    assert.equal(leap.findIndex(Boolean), 3);
    assert.equal(dayKey(leap.filter(Boolean).at(-1)!), '2024-02-29');
    assert.equal(leap.length % 7, 0);
    const sundayStart = monthDays(new Date(2026, 1, 5));
    assert.equal(sundayStart.findIndex(Boolean), 6);
    assert.equal(sundayStart.filter(Boolean).length, 28);
    assert.equal(monthDays(new Date(2026, 2, 1)).length, 42);
  });
  test('strict local date parsing rejects rollover and noncanonical inputs', () => {
    assert.equal(dayKey(parseLocalDate('2024-02-29')!), '2024-02-29');
    assert.equal(parseLocalDate('2024-02-29')?.getHours(), 0);
    for (const input of [
      '2026-02-29',
      '2026-04-31',
      '2026-13-01',
      '2026-00-01',
      '2026-01-00',
      '2026-1-01',
      ' 2026-01-01',
      '2026-01-01T00:00:00Z',
    ])
      assert.equal(parseLocalDate(input), null, input);
  });
  test('spring DST range ends at the next local midnight, not one hour later', () =>
    withTimezone('America/New_York', () => {
      const start = startOfWeek(new Date(2026, 2, 8, 12));
      const end = addDays(start, 7);
      assert.equal(dayKey(start), '2026-03-02');
      assert.equal(dayKey(end), '2026-03-09');
      assert.equal(end.getHours(), 0);
      assert.equal((end.getTime() - start.getTime()) / 3600000, 167);
      const before = entry('before', new Date(end.getTime() - 1));
      const after = entry('next-week', new Date(2026, 2, 9, 0, 30));
      assert.deepEqual(ids(entriesInRange([before, after], start, end)), ['before']);
    }));
  test('fall DST retains the extra hour and the final local day', () =>
    withTimezone('America/New_York', () => {
      const start = startOfWeek(new Date(2026, 10, 1, 12));
      const end = addDays(start, 7);
      assert.equal((end.getTime() - start.getTime()) / 3600000, 169);
      assert.equal(dayKey(end), '2026-11-02');
      assert.equal(end.getHours(), 0);
      assert.deepEqual(
        ids(
          entriesInRange(
            [entry('last', new Date(2026, 10, 1, 23, 30)), entry('excluded', end)],
            start,
            end,
          ),
        ),
        ['last'],
      );
    }));
  test('greetings change at the displayed local hour', () => {
    assert.equal(getGreeting(new Date(2026, 8, 2, 5)), '夜深了');
    assert.equal(getGreeting(new Date(2026, 8, 2, 6)), '早上好');
    assert.equal(getGreeting(new Date(2026, 8, 2, 12)), '下午好');
    assert.equal(getGreeting(new Date(2026, 8, 2, 18)), '晚上好');
  });
});

describe('honest daily insights and activity sample thresholds', () => {
  test('range boundaries are start-inclusive, end-exclusive and order-independent', () => {
    const start = new Date(2026, 8, 1);
    const end = new Date(2026, 9, 1);
    const all = [
      entry('end', end),
      entry('before', new Date(start.getTime() - 1)),
      entry('last', new Date(end.getTime() - 1)),
      entry('start', start),
    ];
    assert.deepEqual(ids(entriesInRange(all, start, end)), ['last', 'start']);
    assert.deepEqual(entriesInRange(all, start, start), []);
    assert.equal(all.length, 4);
  });
  test('no-data averages and emotion mapping remain absent, never zero or invented', () => {
    assert.equal(averageMood([]), null);
    assert.equal(dailyAverage([]), null);
    assert.equal(emotionForScore(null), null);
    assert.equal(groupByDay([]).size, 0);
    assert.deepEqual(activityInsights([]), []);
    assert.equal(currentStreak([]), 0);
  });
  test('daily average weights recorded days equally instead of rewarding more check-ins', () => {
    const first = new Date(2026, 8, 1);
    const second = new Date(2026, 8, 2);
    const all = [
      entry('low', second, { emotionId: 'sad' }),
      ...Array.from({ length: 9 }, (_, i) => entry(`high${i}`, first, { emotionId: 'joyful' })),
    ];
    assert.equal(averageMood(all), 4.6);
    assert.equal(dailyAverage(all), 3);
    assert.equal(groupByDay(all).size, 2);
    assert.equal(groupByDay(all).get('2026-09-01')?.length, 9);
  });
  test('score labels cover all five categories and keep range endpoints stable', () => {
    assert.deepEqual(MOOD_SCORES, { joyful: 5, good: 4, neutral: 3, anxious: 2, sad: 1 });
    for (const [emotion, score] of Object.entries(MOOD_SCORES))
      assert.equal(emotionForScore(score), emotion);
    assert.equal(emotionForScore(3.5), 'good');
    assert.equal(emotionForScore(-10), 'sad');
    assert.equal(emotionForScore(10), 'joyful');
  });
  test('streak deduplicates days, allows today not yet recorded, stops at gaps and ignores future entries', () => {
    const now = new Date(2026, 8, 3, 12);
    const all = [
      entry('today', new Date(2026, 8, 3, 9)),
      entry('today-again', new Date(2026, 8, 3, 10)),
      entry('yesterday', new Date(2026, 8, 2)),
      entry('two-days', new Date(2026, 8, 1)),
      entry('before-gap', new Date(2026, 7, 30)),
      entry('tomorrow', new Date(2026, 8, 4)),
    ];
    assert.equal(currentStreak(all, now), 3);
    assert.equal(
      currentStreak(
        all.filter((item) => !item.id.startsWith('today')),
        now,
      ),
      2,
    );
    assert.equal(currentStreak([entry('old', new Date(2026, 8, 1))], now), 0);
    assert.equal(currentStreak([entry('later-today', new Date(2026, 8, 3, 18))], now), 0);
  });
  test('streak traverses daylight saving transitions as calendar days', () =>
    withTimezone('America/New_York', () => {
      const all = [7, 8, 9].map((day) => entry(String(day), new Date(2026, 2, day, 9)));
      assert.equal(currentStreak(all, new Date(2026, 2, 9, 12)), 3);
    }));
  test('legacy category fallback maps cleanly and explicit activity choices take precedence', () => {
    for (const [categoryId, expected] of Object.entries({
      work: 'work',
      life: 'home',
      relationship: 'partner',
      other: 'other',
    })) {
      assert.deepEqual(
        getActivityIds(
          entry(categoryId, undefined, { categoryId: categoryId as MoodEntry['categoryId'] }),
        ),
        [expected],
      );
    }
    assert.deepEqual(getActivityIds(entry('none')), []);
    assert.deepEqual(
      getActivityIds(entry('cleared', undefined, { categoryId: 'work', activityIds: [] })),
      [],
    );
    assert.deepEqual(
      getActivityIds(entry('replaced', undefined, { categoryId: 'work', activityIds: ['sleep'] })),
      ['sleep'],
    );
    assert.equal(new Set(ACTIVITIES.map((item) => item.id)).size, ACTIVITIES.length);
    for (const item of ACTIVITIES) assert.equal(getActivity(item.id), item);
    assert.equal(getActivity('unknown'), undefined);
  });
  test('activity differences require three distinct days in EACH comparison group', () => {
    const tagged = (day: number, count = 1) =>
      Array.from({ length: count }, (_, i) =>
        entry(`t${day}-${i}`, new Date(2026, 8, day), {
          emotionId: 'joyful',
          activityIds: ['exercise'],
        }),
      );
    const untagged = (day: number) =>
      entry(`u${day}`, new Date(2026, 8, day), { emotionId: 'sad' });
    let all = [...tagged(1, 10), ...tagged(2), untagged(4), untagged(5), untagged(6)];
    let insight = activityInsights(all).find((item) => item.id === 'exercise')!;
    assert.equal(
      insight.days,
      2,
      'many check-ins on one day do not create independent sample days',
    );
    assert.equal(insight.comparisonDays, 3);
    assert.equal(insight.difference, null);
    all = [...tagged(1), ...tagged(2), ...tagged(3), untagged(4), untagged(5)];
    assert.equal(activityInsights(all).find((item) => item.id === 'exercise')?.difference, null);
    all.push(untagged(6));
    insight = activityInsights(all).find((item) => item.id === 'exercise')!;
    assert.equal(insight.days, 3);
    assert.equal(insight.comparisonDays, 3);
    assert.equal(insight.average, 5);
    assert.equal(insight.difference, 4);
  });
  test('activity averages are daily-weighted and include the whole tagged day', () => {
    const all = [
      entry('tag-low', new Date(2026, 8, 1, 9), { emotionId: 'sad', activityIds: ['exercise'] }),
      entry('same-day-high', new Date(2026, 8, 1, 18), { emotionId: 'joyful' }),
      ...Array.from({ length: 8 }, (_, i) =>
        entry(`high${i}`, new Date(2026, 8, 2, 12), {
          emotionId: 'joyful',
          activityIds: ['exercise'],
        }),
      ),
      entry('neutral', new Date(2026, 8, 3), { emotionId: 'neutral', activityIds: ['exercise'] }),
      ...[4, 5, 6].map((day) =>
        entry(`without${day}`, new Date(2026, 8, day), { emotionId: 'sad' }),
      ),
    ];
    const insight = activityInsights(all).find((item) => item.id === 'exercise')!;
    assert.equal(insight.days, 3);
    assert.equal(insight.comparisonDays, 3);
    assert.equal(insight.average, 11 / 3);
    assert.equal(insight.difference, 8 / 3);
  });
  test('legacy tags participate in insights and unrecorded days are not counted as comparisons', () => {
    const all = [1, 4, 9].map((day) =>
      entry(`legacy${day}`, new Date(2026, 8, day), { categoryId: 'relationship' }),
    );
    const insight = activityInsights(all).find((item) => item.id === 'partner')!;
    assert.equal(insight.days, 3);
    assert.equal(insight.comparisonDays, 0);
    assert.equal(insight.difference, null);
  });
});
