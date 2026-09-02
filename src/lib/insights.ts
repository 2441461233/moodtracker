import { MoodEntry, EmotionId } from '../types';
import { addDays, dayKey, startOfDay } from './dates';
import { ACTIVITIES, getActivityIds } from '../data/activities';

export const MOOD_SCORES: Record<EmotionId, number> = {
  joyful: 5,
  good: 4,
  neutral: 3,
  anxious: 2,
  sad: 1,
};
export function entriesInRange(entries: MoodEntry[], start: Date, end: Date): MoodEntry[] {
  return entries.filter(
    (entry) => entry.timestamp >= start.getTime() && entry.timestamp < end.getTime(),
  );
}
export function groupByDay(entries: MoodEntry[]): Map<string, MoodEntry[]> {
  const groups = new Map<string, MoodEntry[]>();
  for (const entry of entries) {
    const key = dayKey(entry.timestamp);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return groups;
}
export function averageMood(entries: MoodEntry[]): number | null {
  if (!entries.length) return null;
  return entries.reduce((sum, entry) => sum + MOOD_SCORES[entry.emotionId], 0) / entries.length;
}
/** Recorded days receive equal weight, irrespective of the number of check-ins. */
export function dailyAverage(entries: MoodEntry[]): number | null {
  const days = [...groupByDay(entries).values()];
  if (!days.length) return null;
  return days.reduce((sum, day) => sum + (averageMood(day) ?? 0), 0) / days.length;
}
export function emotionForScore(score: number | null): EmotionId | null {
  if (score === null) return null;
  const values: EmotionId[] = ['sad', 'anxious', 'neutral', 'good', 'joyful'];
  return values[Math.min(4, Math.max(0, Math.round(score) - 1))];
}
export function currentStreak(entries: MoodEntry[], now = new Date()): number {
  const keys = new Set(
    entries
      .filter((entry) => entry.timestamp <= now.getTime())
      .map((entry) => dayKey(entry.timestamp)),
  );
  let cursor = startOfDay(now);
  if (!keys.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (keys.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
export function activityInsights(entries: MoodEntry[]) {
  const days = [...groupByDay(entries).values()];
  return ACTIVITIES.map((activity) => {
    const withActivity = days.filter((day) =>
      day.some((entry) => getActivityIds(entry).includes(activity.id)),
    );
    const withoutActivity = days.filter(
      (day) => !day.some((entry) => getActivityIds(entry).includes(activity.id)),
    );
    const withAverage = dailyAverage(withActivity.flat());
    const withoutAverage = dailyAverage(withoutActivity.flat());
    return {
      ...activity,
      days: withActivity.length,
      comparisonDays: withoutActivity.length,
      average: withAverage,
      difference:
        withActivity.length >= 3 &&
        withoutActivity.length >= 3 &&
        withAverage !== null &&
        withoutAverage !== null
          ? withAverage - withoutAverage
          : null,
    };
  })
    .filter((item) => item.days > 0)
    .sort(
      (a, b) =>
        (b.difference === null ? -1 : Math.abs(b.difference)) -
          (a.difference === null ? -1 : Math.abs(a.difference)) || b.days - a.days,
    );
}
