import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey, formatTime, parseEntryTime, selectionInMonth } from '../src/lib/dates';
import { applyPickedTime, pickerValue } from '../src/lib/entry-time';

test('changing a picker date preserves the time and uses the local calendar day', () => {
  const now = new Date(2026, 8, 7, 14, 30);
  const current = { date: '2026-09-06', time: '23:45' };
  const next = applyPickedTime(current, 'date', new Date(2026, 7, 31, 0, 0), now);
  assert.deepEqual(next, { date: '2026-08-31', time: '23:45' });
  assert.deepEqual(current, { date: '2026-09-06', time: '23:45' });
  assert.equal(dayKey(pickerValue(next)), '2026-08-31');
  assert.equal(formatTime(pickerValue(next)), '23:45');
});

test('changing the clock preserves a backdated entry day even if native returns another date', () => {
  const now = new Date(2026, 8, 7, 14, 30);
  const next = applyPickedTime(
    { date: '2026-08-31', time: '12:00' },
    'time',
    new Date(2026, 8, 7, 0, 5),
    now,
  );
  assert.deepEqual(next, { date: '2026-08-31', time: '00:05' });
  assert.equal(
    parseEntryTime(next.date, next.time, now).getTime(),
    new Date(2026, 7, 31, 0, 5).getTime(),
  );
});

test('moving a late past entry to today clamps the time, but preserves an earlier time', () => {
  const now = new Date(2026, 8, 7, 14, 30, 27);
  for (const [time, expected] of [
    ['23:45', '14:30'],
    ['08:15', '08:15'],
  ]) {
    const next = applyPickedTime({ date: '2026-09-06', time }, 'date', now, now);
    assert.deepEqual(next, { date: '2026-09-07', time: expected });
    assert.ok(parseEntryTime(next.date, next.time, now) <= now);
  }
});

test('unbounded Android or web future time is rejected on save instead of changing the day', () => {
  const now = new Date(2026, 8, 7, 14, 30);
  const next = applyPickedTime(
    { date: '2026-09-07', time: '12:00' },
    'time',
    new Date(2026, 8, 7, 23, 0),
    now,
  );
  assert.equal(next.date, '2026-09-07');
  assert.throws(() => parseEntryTime(next.date, next.time, now), /当前或之前/);
});

test('picker fallback never passes an invalid Date to a native view', () => {
  const fallback = new Date(2026, 8, 7, 14, 30);
  for (const fields of [
    { date: '', time: '12:00' },
    { date: '2026-02-30', time: '12:00' },
    { date: '2026-09-07', time: '25:00' },
  ])
    assert.equal(pickerValue(fields, fallback).getTime(), fallback.getTime());
});

test('month navigation clamps the selected day for short months, leap years and current month', () => {
  const now = new Date(2026, 8, 7, 14, 30);
  const cases: [Date, Date, string][] = [
    [new Date(2026, 1, 1), new Date(2026, 0, 31), '2026-02-28'],
    [new Date(2024, 1, 1), new Date(2024, 0, 31), '2024-02-29'],
    [new Date(2026, 7, 1), new Date(2026, 8, 7), '2026-08-07'],
    [new Date(2026, 8, 1), new Date(2026, 7, 31), '2026-09-07'],
    [new Date(2025, 11, 1), new Date(2026, 0, 15), '2025-12-15'],
  ];
  for (const [month, selected, expected] of cases) {
    const original = selected.getTime();
    assert.equal(dayKey(selectionInMonth(month, selected, now)), expected);
    assert.equal(selected.getTime(), original);
  }
});
