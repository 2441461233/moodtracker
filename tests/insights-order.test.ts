import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityInsights } from '../src/lib/insights';
import { ACTIVITIES } from '../src/data/activities';
import type { MoodEntry } from '../src/types';

test('a strong negative association is not hidden behind six small positive ones', () => {
  const positive = ACTIVITIES.filter((activity) => activity.id !== 'home')
    .slice(0, 6)
    .map((activity) => activity.id);
  const entries: MoodEntry[] = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    timestamp: new Date(2026, 7, index + 1, 12).getTime(),
    emotionId: index < 3 ? 'sad' : index < 6 ? 'good' : 'joyful',
    activityIds: index < 3 ? ['home'] : index < 6 ? positive : [],
  }));
  const insights = activityInsights(entries);
  assert.equal(insights.length, 7);
  assert.equal(insights[0].id, 'home');
  assert.ok(insights[0].difference! < -3);
  assert.ok(insights.slice(1).every((activity) => activity.difference! > 0));
});
