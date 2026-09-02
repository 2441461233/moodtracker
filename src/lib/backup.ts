import { MoodEntry } from '../types';
import { dayKey, formatTime } from './dates';
import { getActivity, getActivityIds } from '../data/activities';
import { MAX_BACKUP_BYTES, utf8Bytes } from '../storage/core';

const labels = {
  joyful: '很开心',
  good: '还不错',
  neutral: '还好',
  anxious: '有点烦',
  sad: '很难过',
};
export function makeBackup(entries: MoodEntry[]): string {
  const raw = JSON.stringify({
    app: 'moodtracker',
    version: 2,
    exportedAt: new Date().toISOString(),
    entries,
  });
  if (utf8Bytes(raw) > MAX_BACKUP_BYTES)
    throw new Error('记录超出了 10 MB 的备份上限。请先导出 CSV 留存，再分批整理记录。');
  return raw;
}
/** Quote every field; neutralize spreadsheet formulas in user-controlled text. */
export function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function makeCSV(entries: MoodEntry[]): string {
  const rows = [
    ['日期', '时间', '心情', '活动', '笔记'],
    ...entries.map((entry) => [
      dayKey(entry.timestamp),
      formatTime(entry.timestamp),
      labels[entry.emotionId],
      getActivityIds(entry)
        .map((id) => getActivity(id)?.label ?? id)
        .join('、'),
      entry.note ?? '',
    ]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
