import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { MoodEntry } from '../types';
import { createMoodStorage, StorageCoordinator } from './core';
import { addDays, startOfDay, startOfWeek } from '../lib/dates';

const coordinate: StorageCoordinator = async (operation) => {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks?.request) {
    return await navigator.locks.request('moodtracker-storage-v2', operation);
  }
  return operation();
};
export const moodStorage = createMoodStorage(AsyncStorage, coordinate);

export async function saveEntry(entry: MoodEntry): Promise<void> {
  await moodStorage.save(entry);
}

export async function getAllEntries(): Promise<MoodEntry[]> {
  return moodStorage.read();
}

export async function getEntriesForWeek(weekStart: Date): Promise<MoodEntry[]> {
  const all = await getAllEntries();
  const start = startOfDay(weekStart);
  const end = addDays(start, 7);
  return all.filter((e) => e.timestamp >= start.getTime() && e.timestamp < end.getTime());
}

export async function deleteEntry(id: string): Promise<void> {
  await moodStorage.remove(id);
}

/** Returns Monday of the current week */
export function getCurrentWeekStart(): Date {
  return startOfWeek();
}
