import { MoodEntry, AppSettings, EmotionId, CategoryId } from '../types';
import { ACTIVITIES } from '../data/activities';

export const STORAGE_KEY = 'mood_entries';
export const SETTINGS_KEY = 'moodtracker_settings_v2';
export const DEFAULT_SETTINGS: AppSettings = { name: '', theme: 'light', haptics: true };
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const emotions = new Set<EmotionId>(['joyful', 'good', 'neutral', 'anxious', 'sad']);
const categories = new Set<CategoryId>(['work', 'life', 'relationship', 'other']);
const activities = new Set(ACTIVITIES.map((item) => item.id));
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export type StorageCoordinator = <T>(operation: () => Promise<T>) => Promise<T>;

export function utf8Bytes(raw: string): number {
  let bytes = 0;
  for (const character of raw) {
    const point = character.codePointAt(0)!;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export function validateEntries(value: unknown): MoodEntry[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new Error('备份格式不正确，或记录超过 10,000 条。');
  const ids = new Set<string>();
  return value
    .map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('记录格式不正确。');
      const entry = item as MoodEntry;
      if (
        typeof entry.id !== 'string' ||
        !entry.id ||
        entry.id.length > 160 ||
        ids.has(entry.id) ||
        !emotions.has(entry.emotionId) ||
        !Number.isFinite(entry.timestamp) ||
        entry.timestamp < 0 ||
        !Number.isFinite(new Date(entry.timestamp).getTime()) ||
        (entry.categoryId !== undefined && !categories.has(entry.categoryId)) ||
        (entry.note !== undefined &&
          (typeof entry.note !== 'string' || entry.note.length > 4000)) ||
        (entry.activityIds !== undefined &&
          (!Array.isArray(entry.activityIds) ||
            entry.activityIds.length > 24 ||
            entry.activityIds.some((id) => !activities.has(id)))) ||
        (entry.updatedAt !== undefined &&
          (!Number.isFinite(entry.updatedAt) ||
            entry.updatedAt < 0 ||
            !Number.isFinite(new Date(entry.updatedAt).getTime())))
      )
        throw new Error('记录中有重复编号或不支持的字段，请检查备份。');
      ids.add(entry.id);
      return {
        id: entry.id,
        emotionId: entry.emotionId,
        timestamp: entry.timestamp,
        ...(entry.categoryId !== undefined ? { categoryId: entry.categoryId } : {}),
        ...(entry.note !== undefined ? { note: entry.note } : {}),
        ...(entry.activityIds !== undefined
          ? { activityIds: [...new Set(entry.activityIds)] }
          : {}),
        ...(entry.updatedAt !== undefined ? { updatedAt: entry.updatedAt } : {}),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}
export function parseBackup(raw: string): MoodEntry[] {
  let bytes = 0;
  for (const character of raw) {
    const point = character.codePointAt(0)!;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (bytes > MAX_BACKUP_BYTES) throw new Error('备份文件不能超过 10 MB。');
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('这不是有效的 JSON 备份文件。');
  }
  if (Array.isArray(value)) return validateEntries(value);
  if (!value || typeof value !== 'object') throw new Error('无法识别这个备份文件。');
  const backup = value as { app?: string; version?: number; entries?: unknown };
  if (backup.app !== 'moodtracker' || backup.version !== 2)
    throw new Error('请选择 MoodTracker 导出的备份文件。');
  return validateEntries(backup.entries);
}
export function createMoodStorage(
  adapter: StorageAdapter,
  coordinate: StorageCoordinator = (operation) => operation(),
) {
  let queue: Promise<unknown> = Promise.resolve();
  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const run = () => coordinate(operation);
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  }
  async function read(): Promise<MoodEntry[]> {
    const raw = await adapter.getItem(STORAGE_KEY);
    if (raw === null) return [];
    try {
      return validateEntries(JSON.parse(raw));
    } catch {
      throw new Error(
        '本地记录暂时无法读取。原始数据已保留，请先导出原始备份，不要清除浏览器数据。',
      );
    }
  }
  async function persist(entries: MoodEntry[]): Promise<MoodEntry[]> {
    const validated = validateEntries(entries);
    const serialized = JSON.stringify(validated);
    // Reserve room for the export envelope so every saved collection can round-trip.
    if (utf8Bytes(serialized) > MAX_BACKUP_BYTES - 1024)
      throw new Error('记录已接近 10 MB 的本地容量上限。请先导出备份，再整理不需要的记录。');
    await adapter.setItem(STORAGE_KEY, serialized);
    return validated;
  }
  return {
    read: async () => {
      await queue;
      return coordinate(read);
    },
    raw: () => adapter.getItem(STORAGE_KEY),
    save: (entry: MoodEntry) =>
      mutate(async () => {
        const existing = await read();
        if (existing.some((item) => item.id === entry.id))
          throw new Error('这条记录已经保存，请勿重复提交。');
        return persist([entry, ...existing]);
      }),
    update: (entry: MoodEntry, expected?: MoodEntry) =>
      mutate(async () => {
        const existing = await read();
        const current = existing.find((item) => item.id === entry.id);
        if (!current) throw new Error('这条记录已不存在，请重新打开。');
        if (expected && JSON.stringify(current) !== JSON.stringify(validateEntries([expected])[0]))
          throw new Error(
            '另一处刚刚修改了这条记录。你的输入仍在，请保留笔记并重新打开最新记录后再修改。',
          );
        return persist(existing.map((item) => (item.id === entry.id ? entry : item)));
      }),
    remove: (id: string, expected?: MoodEntry) =>
      mutate(async () => {
        const existing = await read();
        const current = existing.find((item) => item.id === id);
        if (
          current &&
          expected &&
          JSON.stringify(current) !== JSON.stringify(validateEntries([expected])[0])
        )
          throw new Error('这条记录在另一处被修改了。请关闭并重新查看最新内容后再决定是否删除。');
        return persist(existing.filter((item) => item.id !== id));
      }),
    merge: (incoming: MoodEntry[]) =>
      mutate(async () => {
        const validated = validateEntries(incoming);
        const existing = await read();
        const ids = new Set(existing.map((item) => item.id));
        // Imports are additive: a backup must not silently overwrite local edits.
        const additions = validated.filter((item) => !ids.has(item.id));
        return {
          entries: await persist([...existing, ...additions]),
          added: additions.length,
          skipped: validated.length - additions.length,
        };
      }),
    settings: async (): Promise<AppSettings> => {
      const raw = await adapter.getItem(SETTINGS_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      try {
        const value = JSON.parse(raw) as Partial<AppSettings>;
        return {
          name: typeof value.name === 'string' ? value.name.slice(0, 24) : '',
          theme: ['light', 'dark', 'system'].includes(value.theme ?? '') ? value.theme! : 'light',
          haptics: typeof value.haptics === 'boolean' ? value.haptics : true,
        };
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
    saveSettings: (settings: AppSettings) =>
      mutate(() => adapter.setItem(SETTINGS_KEY, JSON.stringify(settings))),
  };
}
