export function dayKey(value: number | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function startOfDay(value: number | Date = new Date()): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
export function addDays(value: number | Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}
export function startOfWeek(value: number | Date = new Date()): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}
export function monthDays(value: Date): (Date | null)[] {
  const start = new Date(value.getFullYear(), value.getMonth(), 1);
  const padding = (start.getDay() + 6) % 7;
  const count = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: padding }, () => null);
  for (let day = 1; day <= count; day++)
    cells.push(new Date(value.getFullYear(), value.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
export function parseLocalDate(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dayKey(date) === input ? date : null;
}
export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
export function formatDate(value: number | Date, year = false): string {
  const date = new Date(value);
  return `${year ? `${date.getFullYear()}年 ` : ''}${date.getMonth() + 1}月${date.getDate()}日 · 周${WEEKDAYS[(date.getDay() + 6) % 7]}`;
}
export function formatTime(value: number | Date): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function getGreeting(now = new Date()): string {
  const hour = now.getHours();
  return hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
}

export function parseEntryTime(date: string, time: string, now = new Date()): Date {
  const parsed = parseLocalDate(date);
  if (!parsed || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error('请输入有效日期与时间，例如 2026-09-02、18:30。');
  if (parsed.getFullYear() < 1970) throw new Error('请选择 1970 年之后的记录日期。');
  const [hours, minutes] = time.split(':').map(Number);
  parsed.setHours(hours, minutes, 0, 0);
  if (dayKey(parsed) !== date || parsed.getHours() !== hours || parsed.getMinutes() !== minutes)
    throw new Error('这个当地时间因夏令时调整而不存在，请选择前后其他时间。');
  if (parsed.getTime() > now.getTime())
    throw new Error('还没发生的瞬间，留给未来。请选择当前或之前的时间。');
  return parsed;
}
