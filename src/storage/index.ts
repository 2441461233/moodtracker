import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodEntry } from '../types';

const STORAGE_KEY = 'mood_entries';

export async function saveEntry(entry: MoodEntry): Promise<void> {
  const existing = await getAllEntries();
  const updated = [entry, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function getAllEntries(): Promise<MoodEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as MoodEntry[];
}

export async function getEntriesForWeek(weekStart: Date): Promise<MoodEntry[]> {
  const all = await getAllEntries();
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return all.filter(
    (e) => e.timestamp >= start.getTime() && e.timestamp < end.getTime()
  );
}

export async function deleteEntry(id: string): Promise<void> {
  const existing = await getAllEntries();
  const updated = existing.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/** Returns Monday of the current week */
export function getCurrentWeekStart(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
