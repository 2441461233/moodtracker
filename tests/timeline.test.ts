import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test } from 'node:test';
import {
  createTimeline,
  filterTimeline,
  groupTimelineByDay,
  healthDisplayScore,
  timelineDailyAverage,
  timelineDayScore,
  timelineInRange,
} from '../src/health/timeline';
import { dayKey } from '../src/lib/dates';
import { dailyAverage } from '../src/lib/insights';
import {
  MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
  type StateOfMindSample,
} from '../modules/mood-health/src/types';
import type { MoodEntry } from '../src/types';

// Synthetic unit fixtures only; no real HealthKit reads, samples, or persisted data.
const time = new Date(2026, 8, 3, 12).getTime();
const journal = (changes: Partial<MoodEntry> = {}): MoodEntry => ({
  id: 'journal-1',
  timestamp: time,
  emotionId: 'good',
  note: '合成测试笔记',
  activityIds: ['work'],
  ...changes,
});
const health = (changes: Partial<StateOfMindSample> = {}): StateOfMindSample => ({
  uuid: 'synthetic-health-1',
  timestamp: time,
  kind: 'momentaryEmotion',
  valence: -0.37,
  labels: [1, 2],
  associations: [3],
  sourceName: '合成 Watch 来源',
  sourceBundleId: 'com.apple.synthetic-source',
  isFromThisApp: false,
  ...changes,
});

test('Apple-only days appear in the same timeline, retaining raw type and valence', () => {
  const sample = health({ kind: 'dailyMood' });
  const records = createTimeline([], [sample]);
  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'apple');
  assert.equal(records[0].kind, 'dailyMood');
  assert.equal(records[0].score, 2.26);
  assert.equal(groupTimelineByDay(records).get(dayKey(time))?.length, 1);
  if (records[0].type === 'apple') assert.deepEqual(records[0].sample, sample);
  assert.equal('entry' in records[0], false);
});

test('merging is non-mutating, preserves journal data, and sorts a shared timeline', () => {
  const entries = Object.freeze([Object.freeze(journal())]);
  const samples = Object.freeze([Object.freeze(health({ timestamp: time + 1 }))]);
  const before = JSON.stringify({ entries, samples });
  const records = createTimeline(entries, samples);
  assert.equal(records[0].type, 'apple');
  assert.equal(records[1].type, 'local');
  assert.equal(JSON.stringify({ entries, samples }), before);
  if (records[1].type === 'local') assert.equal(records[1].entry, entries[0]);
});

test('exact own-source sync ID hides a HealthKit copy even after local timestamp edits', () => {
  const own = health({
    localEntryId: 'journal-1',
    isFromThisApp: true,
    sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
    timestamp: time - 86400000,
    valence: -1,
  });
  const records = createTimeline([journal()], [own]);
  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'local');
  assert.equal(records[0].score, 4);
});

test('unmatched own-source samples remain visible after local-only deletion or device migration', () => {
  const own = health({
    localEntryId: 'absent',
    isFromThisApp: true,
    sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
  });
  assert.equal(createTimeline([], [own])[0].type, 'apple');
});

test('external or falsely flagged sources cannot use a local ID to suppress their sample', () => {
  for (const sample of [
    health({ localEntryId: 'journal-1' }),
    health({ localEntryId: 'journal-1', isFromThisApp: true }),
    health({ localEntryId: 'journal-1', sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER }),
  ])
    assert.equal(createTimeline([journal()], [sample]).length, 2);
});

test('legacy samples without a sync ID are not guessed away by equal time or mood', () => {
  const sample = health({
    isFromThisApp: true,
    sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
    valence: 0.5,
  });
  assert.equal(createTimeline([journal()], [sample]).length, 2);
});

test('duplicate HealthKit UUIDs count once; same-time distinct UUIDs stay distinct', () => {
  const one = health();
  assert.equal(createTimeline([], [one, { ...one }, health({ uuid: 'second' })]).length, 2);
});

test('namespaced view IDs prevent local versus HealthKit UUID collision', () => {
  const records = createTimeline([journal({ id: 'same' })], [health({ uuid: 'same' })]);
  assert.deepEqual(
    new Set(records.map((record) => record.id)),
    new Set(['local:same', 'apple:same']),
  );
});

test('source filters, day selection, and Apple approximate mood filters preserve original sample', () => {
  const records = createTimeline([journal()], [health()]);
  const selected = filterTimeline(records, {
    source: 'apple',
    day: dayKey(time),
    emotionId: 'anxious',
  });
  assert.equal(selected.length, 1);
  assert.equal(filterTimeline(records, { source: 'local' }).length, 1);
  assert.equal(filterTimeline(records, { source: 'all' }).length, 2);
  assert.equal(filterTimeline(records, { day: dayKey(time - 86400000) }).length, 0);
  if (selected[0].type === 'apple') assert.equal(selected[0].sample.valence, -0.37);
});

test('search is across dates, includes source and kind, but does not invent Apple diary notes', () => {
  const records = createTimeline([journal()], [health({ kind: 'dailyMood' })]);
  assert.equal(filterTimeline(records, { query: '整体', day: '1970-01-01' }).length, 1);
  assert.equal(filterTimeline(records, { query: 'wATch' }).length, 1);
  assert.equal(filterTimeline(records, { query: '工作' }).length, 1);
  assert.equal(filterTimeline(records, { query: '合成测试笔记', source: 'apple' }).length, 0);
  assert.equal(
    filterTimeline(records, { query: '   ', source: 'local', day: dayKey(time) }).length,
    1,
  );
});

test('range boundaries are start-inclusive and end-exclusive across calendar months', () => {
  const start = new Date(2026, 8, 1);
  const end = new Date(2026, 9, 1);
  const records = createTimeline(
    [],
    [
      health({ uuid: 'before', timestamp: +start - 1 }),
      health({ uuid: 'start', timestamp: +start }),
      health({ uuid: 'last', timestamp: +end - 1 }),
      health({ uuid: 'end', timestamp: +end }),
    ],
  );
  assert.deepEqual(
    timelineInRange(records, start, end).map((record) => record.id),
    ['apple:last', 'apple:start'],
  );
});

test('day groups follow device local dates, including a midnight boundary', () => {
  const midnight = new Date(2026, 8, 3).getTime();
  const groups = groupTimelineByDay(
    createTimeline(
      [],
      [
        health({ uuid: 'left', timestamp: midnight - 1 }),
        health({ uuid: 'right', timestamp: midnight }),
      ],
    ),
  );
  assert.equal(groups.size, 2);
  assert.equal(groups.get(dayKey(midnight))?.[0].id, 'apple:right');
});

test('full precision display mapping preserves endpoints and neutral; invalid values fail', () => {
  assert.equal(healthDisplayScore(-1), 1);
  assert.equal(healthDisplayScore(0), 3);
  assert.equal(healthDisplayScore(1), 5);
  assert.equal(healthDisplayScore(0.123), 3.246);
  for (const valence of [NaN, Infinity, -1.01, 1.01])
    assert.throws(() => healthDisplayScore(valence));
});

test('a daily mood represents that day instead of mixing it with many momentary check-ins', () => {
  const records = createTimeline(
    [journal({ emotionId: 'joyful' })],
    [
      health({ uuid: 'daily', kind: 'dailyMood', valence: -1 }),
      health({ uuid: 'moment', valence: 1 }),
    ],
  );
  assert.equal(timelineDayScore(records), 1);
  assert.equal(records.length, 3); // All original records still appear in the list.
});

test('multiple daily moods average within their own type, without weighting by moments', () => {
  const records = createTimeline(
    [journal()],
    [
      health({ uuid: 'd1', kind: 'dailyMood', valence: -1 }),
      health({ uuid: 'd2', kind: 'dailyMood', valence: 1 }),
    ],
  );
  assert.equal(timelineDayScore(records), 3);
});

test('period average gives recorded days equal weight and preserves missing as null', () => {
  const records = createTimeline(
    [journal({ emotionId: 'joyful' })],
    [
      health({ uuid: 'same-day', valence: 1 }),
      health({ uuid: 'next-day', timestamp: time + 86400000, valence: -1 }),
    ],
  );
  assert.equal(timelineDailyAverage(records), 3);
  assert.equal(timelineDailyAverage([]), null);
  assert.equal(timelineDayScore([]), null);
});

test('disconnected or empty-health timeline keeps local statistics unchanged', () => {
  const entries = [journal(), journal({ id: 'two', timestamp: time - 86400000, emotionId: 'sad' })];
  assert.equal(timelineDailyAverage(createTimeline(entries, [])), dailyAverage(entries));
  assert.equal(createTimeline([], []).length, 0);
});

test('bad samples do not poison other calendar days or fabricate a neutral value', () => {
  const samples = [
    health(),
    health({ uuid: 'invalid', valence: NaN }),
    health({ uuid: 'bad-date', timestamp: Infinity }),
  ];
  assert.equal(createTimeline([], samples).length, 1);
});

test('health updates and disable clear the derived view instead of keeping stale copies', () => {
  const entries = [journal()];
  assert.equal(createTimeline(entries, [health()]).length, 2);
  assert.equal(createTimeline(entries, []).length, 1);
  const changed = createTimeline(entries, [health({ valence: 0.83 })]).find(
    (record) => record.type === 'apple',
  );
  assert.equal(changed?.score, 4.66);
});

test('read-only view modules have no persistence, exports, or HealthKit write path', () => {
  const model = readFileSync(new URL('../src/health/timeline.ts', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../src/health/useTimeline.ts', import.meta.url), 'utf8');
  const list = readFileSync(new URL('../src/components/TimelineList.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(
    model + hook + list,
    /AsyncStorage|moodStorage|persistEntry\(|saveStateOfMind\(|exportEntries\(/,
  );
  assert.match(hook, /enabled && hasRead \? samples : \[\]/);
  assert.match(list, /record\.type === 'local'/);
  assert.match(list, /<HealthRecordRow/);
});
