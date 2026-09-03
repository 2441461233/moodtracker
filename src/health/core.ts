import { getActivityIds } from '../data/activities';
import { validateEntries } from '../storage/core';
import type { EmotionId, MoodEntry } from '../types';
import type { HealthAssociation } from '../../modules/mood-health/src/types';

export const HEALTH_EXPORT_STORAGE_KEY = 'moodtracker_health_export_v1';
export const HEALTH_EXPORT_RANGES = [30, 90, 365] as const;
export type HealthExportRange = (typeof HEALTH_EXPORT_RANGES)[number];

export type HealthSampleInput = {
  syncIdentifier: string;
  syncVersion: number;
  timestamp: number;
  valence: number;
  kind: 'momentaryEmotion';
  associations: HealthAssociation[];
};

export interface HealthSyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface HealthExportResult {
  saved: number;
  skipped: number;
  failed: number;
}

// This is an explicit approximation of the journal's five existing levels,
// not a diagnosis or a claim that an Apple emotional label has been selected.
const VALENCES: Record<EmotionId, number> = {
  joyful: 1,
  good: 0.5,
  neutral: 0,
  anxious: -0.5,
  sad: -1,
};
const ASSOCIATIONS: Record<string, HealthAssociation> = {
  work: 'work',
  exercise: 'fitness',
  friends: 'friends',
  family: 'family',
  partner: 'partner',
  study: 'education',
  hobby: 'hobbies',
  travel: 'travel',
  health: 'health',
};
const ASSOCIATION_VALUES = new Set(Object.values(ASSOCIATIONS));
const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_PREFIX = 'moodtracker:';
const LEDGER_ERROR =
  'Apple 健康写入历史无法读取，原始数据已保留。请勿清除 App 数据；修复前已暂停写入，避免重复记录。';
const WRITE_ERROR =
  'Apple 健康写入进度无法保存，部分记录可能已写入。请勿清除 App 数据，稍后可安全重试。';

interface LedgerRecord {
  version: number;
  fingerprint: string;
  acknowledged: boolean;
}
type Ledger = Map<string, LedgerRecord>;

function validDate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isFinite(new Date(value).getTime())
  );
}

function requireNow(now: number): void {
  if (!validDate(now)) throw new Error('当前时间无效，已暂停 Apple 健康操作。');
}

function requireVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1)
    throw new Error('Apple 健康写入版本无效，已暂停写入。');
}

function sampleFromValidatedEntry(entry: MoodEntry, version: number): HealthSampleInput {
  return {
    syncIdentifier: `${SYNC_PREFIX}${entry.id}`,
    syncVersion: version,
    timestamp: entry.timestamp,
    valence: VALENCES[entry.emotionId],
    kind: 'momentaryEmotion',
    // Unsupported journal tags stay in the journal. Do not guess associations.
    associations: [
      ...new Set(
        getActivityIds(entry).flatMap((id) => (ASSOCIATIONS[id] ? [ASSOCIATIONS[id]] : [])),
      ),
    ].sort(),
  };
}

export function toHealthSample(
  entry: MoodEntry,
  syncVersion = 1,
  now = Date.now(),
): HealthSampleInput {
  requireNow(now);
  requireVersion(syncVersion);
  const validated = validateEntries([entry])[0];
  if (validated.timestamp > now) throw new Error('未来时间的记录不能写入 Apple 健康。');
  return sampleFromValidatedEntry(validated, syncVersion);
}

/** A rolling, inclusive time window, capped at 365 days; future entries stay local. */
export function selectEntriesForHealth(
  entries: MoodEntry[],
  days: HealthExportRange,
  now = Date.now(),
): MoodEntry[] {
  requireNow(now);
  if (!HEALTH_EXPORT_RANGES.includes(days)) throw new Error('请选择最近 30、90 或 365 天的记录。');
  const start = Math.max(0, now - days * DAY_MS);
  return validateEntries(entries)
    .filter((entry) => entry.timestamp >= start && entry.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Only export bookkeeping is stored here: no notes, Apple reads, source names,
// or HealthKit UUIDs. The fingerprint is the exact canonical outgoing payload
// so a hash collision cannot accidentally suppress a journal edit.
function fingerprint(sample: HealthSampleInput): string {
  return JSON.stringify({
    timestamp: sample.timestamp,
    valence: sample.valence,
    kind: sample.kind,
    associations: sample.associations,
  });
}

function objectWithKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function validFingerprint(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 1024) return false;
  try {
    const value: unknown = JSON.parse(raw);
    if (!objectWithKeys(value, ['timestamp', 'valence', 'kind', 'associations'])) return false;
    if (
      !validDate(value.timestamp) ||
      typeof value.valence !== 'number' ||
      !Object.values(VALENCES).includes(value.valence) ||
      value.kind !== 'momentaryEmotion' ||
      !Array.isArray(value.associations) ||
      value.associations.some((association) => !ASSOCIATION_VALUES.has(association))
    )
      return false;
    const canonical = {
      timestamp: value.timestamp,
      valence: value.valence,
      kind: value.kind,
      associations: [...new Set<string>(value.associations)].sort(),
    };
    return JSON.stringify(canonical) === raw;
  } catch {
    return false;
  }
}

function parseLedger(raw: string | null): Ledger {
  if (raw === null) return new Map();
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !objectWithKeys(value, ['version', 'records']) ||
      value.version !== 1 ||
      !value.records ||
      typeof value.records !== 'object' ||
      Array.isArray(value.records)
    )
      throw new Error(LEDGER_ERROR);
    const ledger: Ledger = new Map();
    for (const [identifier, record] of Object.entries(value.records)) {
      if (
        !identifier.startsWith(SYNC_PREFIX) ||
        identifier.length <= SYNC_PREFIX.length ||
        identifier.length > SYNC_PREFIX.length + 160 ||
        !objectWithKeys(record, ['version', 'fingerprint', 'acknowledged']) ||
        typeof record.version !== 'number' ||
        !Number.isSafeInteger(record.version) ||
        record.version < 1 ||
        !validFingerprint(record.fingerprint) ||
        typeof record.acknowledged !== 'boolean'
      )
        throw new Error(LEDGER_ERROR);
      ledger.set(identifier, {
        version: record.version,
        fingerprint: record.fingerprint,
        acknowledged: record.acknowledged,
      });
    }
    // This ledger is app-owned, never imported from journal backups. Requiring
    // our canonical encoding also detects duplicate JSON keys that JSON.parse
    // would otherwise silently discard, potentially rolling a version backward.
    if (JSON.stringify({ version: 1, records: Object.fromEntries(ledger) }) !== raw)
      throw new Error(LEDGER_ERROR);
    return ledger;
  } catch {
    throw new Error(LEDGER_ERROR);
  }
}

/**
 * One exporter instance serializes every batch. Keep it as an app singleton.
 * The durable pending record is written BEFORE HealthKit. If the native write
 * succeeds but acknowledgement cannot be stored, retry uses the same identifier
 * and version. Edits always reserve a higher version, including edits of pending
 * writes. Old ledger rows are retained when entries are absent or deleted locally.
 * New versions start at the device's millisecond clock to reduce collisions when
 * a journal backup is restored without its private ledger. This is NOT a
 * multi-device conflict-resolution protocol; clock skew can still cause conflicts.
 * No background work, permission requests or HealthKit deletions happen here.
 */
export function createHealthExporter(
  storage: HealthSyncStorage,
  save: (input: HealthSampleInput) => Promise<{ uuid: string }>,
  clock: () => number = Date.now,
) {
  let queue: Promise<unknown> = Promise.resolve();

  function checkedClock(): number {
    const now = clock();
    requireNow(now);
    if (!Number.isSafeInteger(now)) throw new Error('当前时间无效，已暂停 Apple 健康操作。');
    return now;
  }

  async function read(): Promise<Ledger> {
    let raw: string | null;
    try {
      raw = await storage.getItem(HEALTH_EXPORT_STORAGE_KEY);
    } catch {
      throw new Error(LEDGER_ERROR);
    }
    return parseLedger(raw);
  }

  async function persist(ledger: Ledger): Promise<void> {
    try {
      await storage.setItem(
        HEALTH_EXPORT_STORAGE_KEY,
        JSON.stringify({ version: 1, records: Object.fromEntries(ledger) }),
      );
    } catch {
      throw new Error(WRITE_ERROR);
    }
  }

  async function run(samples: HealthSampleInput[]): Promise<HealthExportResult> {
    const result: HealthExportResult = { saved: 0, skipped: 0, failed: 0 };
    const ledger = await read();
    const pending: Array<{ sample: HealthSampleInput; fingerprint: string }> = [];
    let reservationsChanged = false;
    for (const original of samples) {
      const identifier = original.syncIdentifier;
      const nextFingerprint = fingerprint(original);
      const previous = ledger.get(identifier);
      if (previous?.fingerprint === nextFingerprint && previous.acknowledged) {
        result.skipped++;
        continue;
      }

      const version =
        previous?.fingerprint === nextFingerprint
          ? previous.version
          : Math.max(checkedClock(), (previous?.version ?? 0) + 1);
      requireVersion(version);
      if (!previous || previous.fingerprint !== nextFingerprint) {
        ledger.set(identifier, { version, fingerprint: nextFingerprint, acknowledged: false });
        reservationsChanged = true;
      }
      pending.push({ sample: { ...original, syncVersion: version }, fingerprint: nextFingerprint });
    }
    // Reserve the whole batch before touching HealthKit. A crash leaves durable
    // idempotent retries, without rewriting a growing ledger for every sample.
    if (reservationsChanged) await persist(ledger);
    for (const item of pending) {
      // Never pass our queued payload object directly to an external implementation.
      const sample = { ...item.sample, associations: [...item.sample.associations] };
      try {
        const response = await save(sample);
        if (!response || typeof response.uuid !== 'string' || !response.uuid.trim())
          throw new Error('Apple 健康未确认保存。');
      } catch {
        result.failed++;
        continue;
      }
      ledger.set(item.sample.syncIdentifier, {
        version: item.sample.syncVersion,
        fingerprint: item.fingerprint,
        acknowledged: true,
      });
      result.saved++;
    }
    // A failed acknowledgement rejects the whole operation. The durable ledger
    // still contains the exact pending versions, so retries cannot create a new
    // sample merely because final progress was not saved. At most two writes per
    // batch keeps a 10,000-entry export from causing quadratic storage traffic.
    if (result.saved > 0) await persist(ledger);
    return result;
  }

  return {
    exportEntries(entries: MoodEntry[]): Promise<HealthExportResult> {
      let samples: HealthSampleInput[];
      try {
        const now = checkedClock();
        // Snapshot before queuing, validate the whole batch before any side effect,
        // and strip notes and unrelated fields before retaining queued work.
        samples = validateEntries(entries).map((entry) => {
          if (entry.timestamp > now) throw new Error('未来时间的记录不能写入 Apple 健康。');
          return sampleFromValidatedEntry(entry, 1);
        });
      } catch (error) {
        return Promise.reject(error);
      }
      const operation = () => run(samples);
      const result = queue.then(operation, operation);
      queue = result.catch(() => undefined);
      return result;
    },
  };
}
