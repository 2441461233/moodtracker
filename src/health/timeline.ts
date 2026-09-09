import {
  MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
  type StateOfMindSample,
} from '../../modules/mood-health/src/types';
import type { EmotionId, MoodEntry } from '../types';
import { getActivity, getActivityIds } from '../data/activities';
import { getEmotionById } from '../data/emotions';
import { dayKey } from '../lib/dates';
import { emotionForScore, MOOD_SCORES } from '../lib/insights';

type TimelineFields = {
  id: string;
  timestamp: number;
  emotionId: EmotionId;
  /** Display-only 1–5 approximation. Never sent back to HealthKit or storage. */
  score: number;
  kind: StateOfMindSample['kind'];
};

/** A view model, deliberately NOT a MoodEntry that could be saved or exported. */
export type TimelineRecord = TimelineFields &
  ({ type: 'local'; entry: MoodEntry } | { type: 'apple'; sample: StateOfMindSample });
export type TimelineSource = 'all' | 'local' | 'apple';

export function healthDisplayScore(valence: number): number {
  if (!Number.isFinite(valence) || valence < -1 || valence > 1)
    throw new Error('Invalid health valence');
  return valence * 2 + 3;
}

/** Merge only in memory. Exact self-source IDs hide copies, never fuzzy matching. */
export function createTimeline(
  entries: readonly MoodEntry[],
  samples: readonly StateOfMindSample[],
): TimelineRecord[] {
  const localIds = new Set(entries.map((entry) => entry.id));
  const result: TimelineRecord[] = entries.map((entry) => ({
    type: 'local',
    id: `local:${entry.id}`,
    timestamp: entry.timestamp,
    emotionId: entry.emotionId,
    score: MOOD_SCORES[entry.emotionId],
    kind: 'momentaryEmotion',
    entry,
  }));
  const seen = new Set<string>();
  for (const sample of samples) {
    if (
      seen.has(sample.uuid) ||
      !Number.isFinite(sample.timestamp) ||
      sample.timestamp < 0 ||
      !Number.isFinite(new Date(sample.timestamp).getTime()) ||
      !Number.isFinite(sample.valence) ||
      sample.valence < -1 ||
      sample.valence > 1 ||
      (sample.kind !== 'momentaryEmotion' && sample.kind !== 'dailyMood')
    )
      continue;
    seen.add(sample.uuid);
    if (
      sample.isFromThisApp &&
      sample.sourceBundleId === MOOD_HEALTH_APP_BUNDLE_IDENTIFIER &&
      sample.localEntryId &&
      localIds.has(sample.localEntryId)
    )
      continue;
    const score = healthDisplayScore(sample.valence);
    result.push({
      type: 'apple',
      id: `apple:${sample.uuid}`,
      timestamp: sample.timestamp,
      score,
      emotionId: emotionForScore(score)!,
      kind: sample.kind,
      sample,
    });
  }
  return result.sort(
    (left, right) => right.timestamp - left.timestamp || left.id.localeCompare(right.id),
  );
}

export function groupTimelineByDay(
  records: readonly TimelineRecord[],
): Map<string, TimelineRecord[]> {
  const groups = new Map<string, TimelineRecord[]>();
  for (const record of records) {
    const key = dayKey(record.timestamp);
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  return groups;
}

export function timelineInRange(
  records: readonly TimelineRecord[],
  start: Date,
  end: Date,
): TimelineRecord[] {
  return records.filter(
    (record) => record.timestamp >= start.getTime() && record.timestamp < end.getTime(),
  );
}

/** One day's representative score: daily mood when present, otherwise moments. */
export function timelineDayScore(records: readonly TimelineRecord[]): number | null {
  if (!records.length) return null;
  const daily = records.filter((record) => record.kind === 'dailyMood');
  const selected = daily.length ? daily : records;
  return selected.reduce((sum, record) => sum + record.score, 0) / selected.length;
}

/** Recorded days have equal weight. Missing days are never zero-filled. */
export function timelineDailyAverage(records: readonly TimelineRecord[]): number | null {
  const days = [...groupTimelineByDay(records).values()];
  if (!days.length) return null;
  return days.reduce((sum, day) => sum + timelineDayScore(day)!, 0) / days.length;
}

export function filterTimeline(
  records: readonly TimelineRecord[],
  options: {
    source?: TimelineSource;
    emotionId?: EmotionId | 'all';
    query?: string;
    day?: string;
  } = {},
): TimelineRecord[] {
  const query = options.query?.trim().toLocaleLowerCase() ?? '';
  return records.filter((record) => {
    if (options.source && options.source !== 'all' && record.type !== options.source) return false;
    if (options.emotionId && options.emotionId !== 'all' && record.emotionId !== options.emotionId)
      return false;
    if (!query) return !options.day || dayKey(record.timestamp) === options.day;
    const mood = getEmotionById(record.emotionId)?.label ?? '';
    const haystack =
      record.type === 'local'
        ? `本地 日记 ${mood} ${record.entry.note ?? ''} ${getActivityIds(record.entry)
            .map((id) => getActivity(id)?.label ?? '')
            .join(' ')}`
        : `Apple 健康 心境 ${record.sample.sourceName} ${record.sample.sourceBundleId} ${record.kind === 'dailyMood' ? '一天整体心情' : '当下情绪'} ${mood} ${record.sample.valence}`;
    return haystack.toLocaleLowerCase().includes(query);
  });
}
