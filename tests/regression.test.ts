import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createMoodStorage,
  MAX_BACKUP_BYTES,
  parseBackup,
  STORAGE_KEY,
  utf8Bytes,
  validateEntries,
  type StorageAdapter,
  type StorageCoordinator,
} from '../src/storage/core';
import { dayKey, formatTime, parseEntryTime } from '../src/lib/dates';
import { csvCell, makeBackup, makeCSV } from '../src/lib/backup';
import type { MoodEntry } from '../src/types';

// In-memory only: no browser APIs, real storage, files or network are touched.
function entry(id: string, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return { id, emotionId: 'good', timestamp: 1788300000000, ...overrides };
}
class MemoryAdapter implements StorageAdapter {
  values = new Map<string, string>();
  writes: Array<[string, string]> = [];
  failNextWrite = false;
  constructor(raw?: string) {
    if (raw !== undefined) this.values.set(STORAGE_KEY, raw);
  }
  async getItem(key: string) {
    await Promise.resolve();
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    await Promise.resolve();
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('disk full');
    }
    this.values.set(key, value);
    this.writes.push([key, value]);
  }
}
function sharedCoordinator() {
  let queue: Promise<unknown> = Promise.resolve();
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  const coordinate: StorageCoordinator = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = async () => {
      calls++;
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        return await operation();
      } finally {
        active--;
      }
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  };
  return { coordinate, stats: () => ({ active, maxActive, calls }) };
}
function withTimezone<T>(zone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}
const ids = (entries: MoodEntry[]) => entries.map((item) => item.id).sort();

describe('cross-instance coordination and conflict protection', () => {
  test('three independently queued instances retain all concurrent saves under one coordinator', async () => {
    const adapter = new MemoryAdapter();
    const mutex = sharedCoordinator();
    const stores = Array.from({ length: 3 }, () => createMoodStorage(adapter, mutex.coordinate));
    const incoming = Array.from({ length: 60 }, (_, i) =>
      entry(String(i), { timestamp: 1788300000000 + i }),
    );
    await Promise.all(incoming.map((item, i) => stores[i % stores.length].save(item)));
    for (const store of stores) assert.deepEqual(ids(await store.read()), ids(incoming));
    assert.equal(adapter.writes.length, 60);
    assert.equal(mutex.stats().maxActive, 1);
    assert.equal(mutex.stats().active, 0);
    assert.ok(mutex.stats().calls >= 63, 'public reads also pass through the coordinator');
  });
  test('a same-instance read waits for already queued writes', async () => {
    const adapter = new MemoryAdapter();
    const store = createMoodStorage(adapter, sharedCoordinator().coordinate);
    const first = store.save(entry('first'));
    const second = store.save(entry('second'));
    const result = await store.read();
    await Promise.all([first, second]);
    assert.deepEqual(ids(result), ['first', 'second']);
  });
  test('a rejected cross-instance duplicate does not poison the global or local queue', async () => {
    const adapter = new MemoryAdapter();
    const mutex = sharedCoordinator();
    const first = createMoodStorage(adapter, mutex.coordinate);
    const second = createMoodStorage(adapter, mutex.coordinate);
    const results = await Promise.allSettled([
      first.save(entry('same')),
      second.save(entry('same')),
    ]);
    assert.deepEqual(
      results.map((result) => result.status),
      ['fulfilled', 'rejected'],
    );
    await Promise.all([first.save(entry('after-a')), second.save(entry('after-b'))]);
    assert.deepEqual(ids(await second.read()), ['after-a', 'after-b', 'same']);
    assert.equal(adapter.writes.length, 3);
  });
  test('coordinator rejection fails closed, leaves old bytes intact and permits retry', async () => {
    const raw = JSON.stringify([entry('old')]);
    const adapter = new MemoryAdapter(raw);
    let rejectNext = true;
    const coordinate: StorageCoordinator = async (operation) => {
      if (rejectNext) {
        rejectNext = false;
        throw new Error('lock request denied');
      }
      return operation();
    };
    const store = createMoodStorage(adapter, coordinate);
    await assert.rejects(store.save(entry('failed')), /lock request denied/);
    assert.equal(await store.raw(), raw);
    assert.equal(adapter.writes.length, 0, 'do not fall back to an uncoordinated write');
    await store.save(entry('retry'));
    assert.deepEqual(ids(await store.read()), ['old', 'retry']);
  });
  test('failed persistence releases the shared coordinator for another instance', async () => {
    const raw = JSON.stringify([entry('old')]);
    const adapter = new MemoryAdapter(raw);
    const mutex = sharedCoordinator();
    const first = createMoodStorage(adapter, mutex.coordinate);
    const second = createMoodStorage(adapter, mutex.coordinate);
    adapter.failNextWrite = true;
    const results = await Promise.allSettled([
      first.save(entry('failed')),
      second.save(entry('retained')),
    ]);
    assert.deepEqual(
      results.map((result) => result.status),
      ['rejected', 'fulfilled'],
    );
    assert.deepEqual(ids(await first.read()), ['old', 'retained']);
    assert.equal(mutex.stats().active, 0);
  });
  test('stale update preserves the newer full record and unrelated entries', async () => {
    const original = entry('shared', { note: 'original', categoryId: 'work' });
    const adapter = new MemoryAdapter(JSON.stringify([original, entry('unrelated')]));
    const mutex = sharedCoordinator();
    const first = createMoodStorage(adapter, mutex.coordinate);
    const second = createMoodStorage(adapter, mutex.coordinate);
    const newVersion = {
      ...original,
      note: 'other tab changed this',
      activityIds: ['sleep'],
      updatedAt: 1788300000100,
    };
    await second.update(newVersion, original);
    const beforeRejectedWrite = await first.raw();
    const unsavedDraft = { ...original, note: 'my unsaved draft', updatedAt: 1788300000200 };
    await assert.rejects(first.update(unsavedDraft, original), /另一处.*修改/);
    assert.equal(await first.raw(), beforeRejectedWrite);
    assert.deepEqual(
      (await first.read()).find((item) => item.id === 'shared'),
      newVersion,
    );
    assert.deepEqual(ids(await first.read()), ['shared', 'unrelated']);
    assert.equal(unsavedDraft.note, 'my unsaved draft', 'the caller retains its draft object');
    assert.equal(adapter.writes.length, 1);
  });
  test('two simultaneous updates based on one snapshot allow only the first', async () => {
    const original = entry('shared', { note: 'original' });
    const adapter = new MemoryAdapter(JSON.stringify([original]));
    const mutex = sharedCoordinator();
    const first = createMoodStorage(adapter, mutex.coordinate);
    const second = createMoodStorage(adapter, mutex.coordinate);
    const results = await Promise.allSettled([
      first.update({ ...original, note: 'first writer' }, original),
      second.update({ ...original, note: 'second writer' }, original),
    ]);
    assert.deepEqual(
      results.map((result) => result.status),
      ['fulfilled', 'rejected'],
    );
    assert.equal((await second.read())[0].note, 'first writer');
    assert.equal(adapter.writes.length, 1);
  });
  test('stale delete cannot remove a newer record; fresh confirmation succeeds', async () => {
    const original = entry('shared', { note: 'original' });
    const adapter = new MemoryAdapter(JSON.stringify([original, entry('unrelated')]));
    const mutex = sharedCoordinator();
    const first = createMoodStorage(adapter, mutex.coordinate);
    const second = createMoodStorage(adapter, mutex.coordinate);
    const updated = {
      ...original,
      emotionId: 'joyful' as const,
      note: 'new text',
      updatedAt: 1788300000100,
    };
    await second.update(updated, original);
    const raw = await first.raw();
    await assert.rejects(first.remove('shared', original), /另一处被修改/);
    assert.equal(await first.raw(), raw);
    assert.equal(adapter.writes.length, 1);
    await first.remove('shared', updated);
    assert.deepEqual(ids(await second.read()), ['unrelated']);
  });
  test('an edit cannot resurrect a record another instance deleted', async () => {
    const original = entry('deleted', { note: 'original' });
    const adapter = new MemoryAdapter(JSON.stringify([original, entry('kept')]));
    const mutex = sharedCoordinator();
    const first = createMoodStorage(adapter, mutex.coordinate);
    const second = createMoodStorage(adapter, mutex.coordinate);
    await second.remove(original.id, original);
    const raw = await first.raw();
    await assert.rejects(first.update({ ...original, note: 'draft' }, original), /已不存在/);
    assert.equal(await first.raw(), raw);
    assert.deepEqual(ids(await first.read()), ['kept']);
  });
  test('expected snapshots are normalized instead of depending on property insertion order', async () => {
    const original = entry('existing', {
      categoryId: 'life',
      activityIds: ['home', 'home'],
      note: '旧记录',
    });
    const adapter = new MemoryAdapter(JSON.stringify([original]));
    const store = createMoodStorage(adapter, sharedCoordinator().coordinate);
    const expected: MoodEntry = {
      note: original.note,
      activityIds: ['home'],
      timestamp: original.timestamp,
      emotionId: original.emotionId,
      id: original.id,
      categoryId: 'life',
    };
    const updated = { ...expected, note: 'updated' };
    await store.update(updated, expected);
    assert.equal((await store.read())[0].note, 'updated');
  });
});

describe('strict entry-time parsing', () => {
  test('returns local minute precision without mutating the supplied clock', () =>
    withTimezone('Asia/Shanghai', () => {
      const now = new Date(2026, 8, 2, 12, 34, 56, 789);
      const before = now.getTime();
      const parsed = parseEntryTime('2026-09-02', '12:34', now);
      assert.equal(dayKey(parsed), '2026-09-02');
      assert.equal(formatTime(parsed), '12:34');
      assert.equal(parsed.getSeconds(), 0);
      assert.equal(parsed.getMilliseconds(), 0);
      assert.equal(now.getTime(), before);
      assert.equal(parsed.toISOString(), '2026-09-02T04:34:00.000Z');
    }));
  test('accepts exactly now and past moments; rejects any later minute or day', () =>
    withTimezone('UTC', () => {
      const now = new Date('2026-09-02T12:34:00Z');
      assert.equal(parseEntryTime('2026-09-02', '12:34', now).getTime(), now.getTime());
      assert.ok(parseEntryTime('2026-09-01', '23:59', now).getTime() < now.getTime());
      assert.throws(() => parseEntryTime('2026-09-02', '12:35', now), /未来/);
      assert.throws(() => parseEntryTime('2026-09-03', '00:00', now), /未来/);
    }));
  test('rejects invalid or noncanonical calendar/time input', () => {
    const now = new Date(2030, 0, 1);
    for (const [date, time] of [
      ['2026-02-29', '12:00'],
      ['2026-04-31', '12:00'],
      ['2026-9-02', '12:00'],
      ['2026-09-02', '24:00'],
      ['2026-09-02', '12:60'],
      ['2026-09-02', '1:00'],
      ['2026-09-02', '12:00:00'],
      ['2026-09-02', ' 12:00'],
      ['1969-12-31', '23:59'],
    ])
      assert.throws(() => parseEntryTime(date, time, now), Error, `${date} ${time}`);
    assert.equal(dayKey(parseEntryTime('2024-02-29', '12:00', now)), '2024-02-29');
  });
  test('spring DST missing hour is rejected rather than silently moved forward', () =>
    withTimezone('America/New_York', () => {
      const now = new Date(2026, 2, 9, 12);
      assert.throws(() => parseEntryTime('2026-03-08', '02:00', now), /夏令时/);
      assert.throws(() => parseEntryTime('2026-03-08', '02:30', now), /夏令时/);
      assert.throws(() => parseEntryTime('2026-03-08', '02:59', now), /夏令时/);
      assert.equal(formatTime(parseEntryTime('2026-03-08', '01:59', now)), '01:59');
      assert.equal(formatTime(parseEntryTime('2026-03-08', '03:00', now)), '03:00');
    }));
  test('fall DST repeated local hour remains a valid local time', () =>
    withTimezone('America/New_York', () => {
      const now = new Date(2026, 10, 2, 12);
      const parsed = parseEntryTime('2026-11-01', '01:30', now);
      assert.equal(dayKey(parsed), '2026-11-01');
      assert.equal(formatTime(parsed), '01:30');
      // ECMAScript's compatible disambiguation chooses the earlier occurrence.
      assert.equal(parsed.toISOString(), '2026-11-01T05:30:00.000Z');
    }));
  test('accepts the Unix epoch in UTC', () =>
    withTimezone('UTC', () => {
      assert.equal(parseEntryTime('1970-01-01', '00:00', new Date(2026, 0, 1)).getTime(), 0);
    }));
});

describe('restorable near-limit JSON backups and failure-safe size caps', () => {
  test('UTF-8 length matches Node for ASCII, CJK, emoji and lone surrogate code units', () => {
    for (const value of [
      '',
      'ASCII',
      '心情日记',
      '🙂🫶🏽',
      'é',
      'e\u0301',
      '\ud800',
      '\udc00',
      '中文\n"\\\t🙂',
    ]) {
      assert.equal(utf8Bytes(value), Buffer.byteLength(value, 'utf8'), JSON.stringify(value));
    }
  });
  test('previous pretty-print regression now imports, saves and exports within 10 MB', async () => {
    const original = Array.from({ length: 9000 }, (_, i) =>
      entry(String(i), { note: '心'.repeat(352) }),
    );
    const compact = JSON.stringify(original);
    assert.ok(utf8Bytes(compact) < MAX_BACKUP_BYTES - 1024);
    assert.ok(
      utf8Bytes(
        JSON.stringify(
          {
            app: 'moodtracker',
            version: 2,
            exportedAt: new Date().toISOString(),
            entries: original,
          },
          null,
          2,
        ),
      ) > MAX_BACKUP_BYTES,
    );
    const store = createMoodStorage(new MemoryAdapter(), sharedCoordinator().coordinate);
    const merged = await store.merge(parseBackup(compact));
    const exported = makeBackup(merged.entries);
    assert.ok(utf8Bytes(exported) < MAX_BACKUP_BYTES);
    assert.deepEqual(parseBackup(exported), validateEntries(original));
    assert.equal(merged.added, original.length);
  });
  test('near-cap saved data reserves enough envelope room for an exact round-trip', async () => {
    const original = Array.from({ length: 880 }, (_, i) =>
      entry(String(i), { note: 'x'.repeat(3800) + '心'.repeat(100) }),
    );
    // Use notes well below the per-entry limit, then fill close to the global
    // byte cap with valid entries. No assumptions about exportedAt length.
    const filled: MoodEntry[] = [];
    let bytes = 2;
    for (let i = 0; ; i++) {
      const next = entry(String(i), { note: original[i % original.length].note });
      const addition = utf8Bytes(JSON.stringify(next)) + (filled.length ? 1 : 0);
      if (bytes + addition > MAX_BACKUP_BYTES - 2048) break;
      filled.push(next);
      bytes += addition;
    }
    assert.ok(bytes > MAX_BACKUP_BYTES - 10000);
    assert.ok(filled.length < 10000);
    const adapter = new MemoryAdapter();
    const store = createMoodStorage(adapter);
    await store.merge(filled);
    const saved = await store.read();
    assert.deepEqual(parseBackup(makeBackup(saved)), saved);
    assert.ok(utf8Bytes(makeBackup(saved)) <= MAX_BACKUP_BYTES);
  });
  test('oversized save is rejected atomically without damaging the existing collection', async () => {
    const base = Array.from({ length: 900 }, (_, i) =>
      entry(String(i), { note: '心'.repeat(3900) }),
    );
    assert.ok(utf8Bytes(JSON.stringify(base)) > MAX_BACKUP_BYTES);
    const raw = JSON.stringify([entry('protected', { note: 'keep me' })]);
    const adapter = new MemoryAdapter(raw);
    const store = createMoodStorage(adapter);
    await assert.rejects(store.merge(base), /10 MB/);
    assert.equal(await store.raw(), raw);
    assert.equal(adapter.writes.length, 0);
    assert.throws(() => makeBackup(base), /10 MB/);
    await store.save(entry('retry'));
    assert.deepEqual(ids(await store.read()), ['protected', 'retry']);
  });
  test('JSON round-trip preserves user text, Unicode, legacy fields and updatedAt', () => {
    const source = [
      entry('unicode', {
        note: '第一行\n第二行\r\n"引号",反斜线\\，🙂🫶🏽 e\u0301',
        categoryId: 'relationship',
        activityIds: ['partner', 'reading'],
        updatedAt: 1788300000100,
      }),
      entry('optional'),
    ];
    const snapshot = JSON.stringify(source);
    const backup = makeBackup(source);
    const envelope = JSON.parse(backup);
    assert.equal(envelope.app, 'moodtracker');
    assert.equal(envelope.version, 2);
    assert.ok(Number.isFinite(Date.parse(envelope.exportedAt)));
    assert.deepEqual(parseBackup(backup), validateEntries(source));
    assert.equal(JSON.stringify(source), snapshot);
    assert.deepEqual(parseBackup(makeBackup([])), []);
  });
});

// A deliberately small independent RFC-4180-style parser, used only to verify
// that CSV quoting preserves the actual cells rather than comparing formatting.
function parseCSV(raw: string): string[][] {
  const text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  assert.equal(quoted, false, 'CSV has an unterminated quoted cell');
  if (cell.length || row.length || text.endsWith('"')) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
describe('CSV spreadsheet safety and text fidelity', () => {
  test('formula-like user strings receive an apostrophe before any whitespace', () => {
    for (const value of [
      '=1+1',
      '+SUM(A1:A2)',
      '-1+2',
      '@SUM(A1)',
      '  =HYPERLINK("x")',
      '\t=1',
      '\r=1',
      '\n=1',
      '\tplain',
    ]) {
      assert.equal(parseCSV(csvCell(value))[0][0], `'${value}`, JSON.stringify(value));
    }
  });
  test('plain text, commas, CRLF, quotes and Unicode survive one-cell serialization', () => {
    for (const value of [
      '',
      '中文🙂',
      'line one\nline two',
      'line one\r\nline two',
      'a,b,"c"',
      "already 'quoted'",
      'e\u0301',
      'not=a formula',
    ]) {
      assert.equal(parseCSV(csvCell(value))[0][0], value);
    }
    assert.equal(csvCell('a"b'), '"a""b"');
  });
  test('CSV has BOM, stable headers, local dates, activity labels and no row splitting', () =>
    withTimezone('Asia/Shanghai', () => {
      const source = [
        entry('rich', {
          timestamp: new Date(2026, 8, 2, 0, 30).getTime(),
          emotionId: 'joyful',
          note: '中文, "引号"\r\n第二行🙂',
          activityIds: ['work', 'reading'],
        }),
        entry('formula', {
          timestamp: new Date(2026, 8, 1, 12, 5).getTime(),
          emotionId: 'sad',
          note: '=1+1',
          categoryId: 'relationship',
        }),
        entry('empty', { timestamp: new Date(2026, 8, 1, 10, 0).getTime(), emotionId: 'neutral' }),
      ];
      const before = JSON.stringify(source);
      const csv = makeCSV(source);
      assert.equal(csv.charCodeAt(0), 0xfeff);
      const rows = parseCSV(csv);
      assert.equal(rows.length, 4);
      assert.ok(rows.every((row) => row.length === 5));
      assert.deepEqual(rows[0], ['日期', '时间', '心情', '活动', '笔记']);
      assert.deepEqual(rows[1], ['2026-09-02', '00:30', '很开心', '工作、阅读', source[0].note]);
      assert.deepEqual(rows[2], ['2026-09-01', '12:05', '很难过', '亲密关系', "'=1+1"]);
      assert.deepEqual(rows[3], ['2026-09-01', '10:00', '还好', '', '']);
      assert.equal(JSON.stringify(source), before);
      assert.deepEqual(parseCSV(makeCSV([])), [rows[0]]);
    }));
});
