import { useMemo } from 'react';
import { useMood } from '../context/MoodContext';
import { useHealthSync } from '../context/HealthSyncContext';
import { createTimeline } from './timeline';

/** All screens share the same foreground-only health snapshot; never persist it. */
export function useTimeline() {
  const { entries } = useMood();
  const health = useHealthSync();
  const { records: samples, enabled, hasRead } = health;
  const records = useMemo(
    () => createTimeline(entries, enabled && hasRead ? samples : []),
    [entries, samples, enabled, hasRead],
  );
  return { records, health };
}
