import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWidgetCalendarSnapshot } from '../src/lib/widget-calendar';
import type { MoodEntry } from '../src/types';

const now = new Date(2026, 8, 7, 18);
const sample = (id: string, emotionId: MoodEntry['emotionId'], timestamp: Date): MoodEntry => ({
  id,
  emotionId,
  timestamp: timestamp.getTime(),
  note: 'Private journal text',
  activityIds: ['work'],
});

test('calendar uses the same daily mean and rounding as the local app calendar', () => {
  const snapshot = makeWidgetCalendarSnapshot(
    [
      sample('one', 'joyful', new Date(2026, 8, 7, 9)),
      sample('two', 'sad', new Date(2026, 8, 7, 10)),
      sample('three', 'good', new Date(2026, 8, 6, 10)),
    ],
    now,
  );
  assert.deepEqual(snapshot, {
    version: 1,
    days: {
      '2026-09-06': { emotionId: 'good', count: 1 },
      '2026-09-07': { emotionId: 'neutral', count: 2 },
    },
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /Private|activity|note|one|two|three/);
});

test('only current/previous month and past entries are shared, including across year boundaries', () => {
  const snapshot = makeWidgetCalendarSnapshot(
    [
      sample('old', 'sad', new Date(2025, 10, 30, 23)),
      sample('previous', 'good', new Date(2025, 11, 1, 0)),
      sample('current', 'neutral', new Date(2026, 0, 1, 0)),
      sample('future', 'joyful', new Date(2026, 0, 2)),
    ],
    new Date(2026, 0, 1, 12),
  );
  assert.deepEqual(Object.keys(snapshot.days), ['2025-12-01', '2026-01-01']);
});

test('edits, deletion and empty journals fully replace stale calendar summaries', () => {
  const first = sample('entry', 'sad', new Date(2026, 8, 6, 20));
  const edited = {
    ...first,
    emotionId: 'joyful' as const,
    timestamp: new Date(2026, 8, 7, 12).getTime(),
  };
  assert.deepEqual(makeWidgetCalendarSnapshot([edited], now).days, {
    '2026-09-07': { emotionId: 'joyful', count: 1 },
  });
  assert.deepEqual(makeWidgetCalendarSnapshot([], now), { version: 1, days: {} });
});

test('snapshot is stable when only note text, ordering or update time changes', () => {
  const first = sample('a', 'good', new Date(2026, 8, 6, 10));
  const second = sample('b', 'sad', new Date(2026, 8, 7, 10));
  const before = makeWidgetCalendarSnapshot([first, second], now);
  const after = makeWidgetCalendarSnapshot(
    [{ ...second, note: 'changed', updatedAt: now.getTime() }, first],
    now,
  );
  assert.deepEqual(after, before);
});
