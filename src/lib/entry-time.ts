import { dayKey, formatTime, parseLocalDate } from './dates';

export type EntryTimeFields = { date: string; time: string };
export type EntryTimeMode = 'date' | 'time';

export function pickerValue({ date, time }: EntryTimeFields, fallback = new Date()): Date {
  const value = parseLocalDate(date);
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return new Date(fallback);
  const [hours, minutes] = time.split(':').map(Number);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

export function applyPickedTime(
  current: EntryTimeFields,
  mode: EntryTimeMode,
  picked: Date,
  now = new Date(),
): EntryTimeFields {
  const next = {
    date: mode === 'date' ? dayKey(picked) : current.date,
    time: mode === 'time' ? formatTime(picked) : current.time,
  };
  // Moving a late-night past entry to today should leave a selectable time.
  // Time-only selections are still validated on save (Android has no time maximum).
  if (mode === 'date' && next.date === dayKey(now) && next.time > formatTime(now)) {
    next.time = formatTime(now);
  }
  return next;
}
