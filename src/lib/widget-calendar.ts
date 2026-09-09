import type { EmotionId, MoodEntry } from '../types';
import { dayKey } from './dates';
import { averageMood, emotionForScore, groupByDay } from './insights';

export interface WidgetCalendarSnapshot {
  version: 1;
  days: Record<string, { emotionId: EmotionId; count: number }>;
}

/** Only local daily aggregates leave the journal store, never notes, IDs or HealthKit data. */
export function makeWidgetCalendarSnapshot(
  entries: MoodEntry[],
  now: Date,
): WidgetCalendarSnapshot {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const days: WidgetCalendarSnapshot['days'] = {};
  for (const [date, records] of [
    ...groupByDay(
      entries.filter((entry) => entry.timestamp >= start && entry.timestamp <= now.getTime()),
    ),
  ].sort(([a], [b]) => a.localeCompare(b))) {
    const emotionId = emotionForScore(averageMood(records));
    if (emotionId) days[date] = { emotionId, count: records.length };
  }
  return { version: 1, days };
}

export function calendarWidgetURL(date: Date): string {
  return `moodjournal://calendar?date=${dayKey(date)}`;
}
