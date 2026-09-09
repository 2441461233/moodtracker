import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMoodStorage, STORAGE_KEY, type StorageAdapter } from '../src/storage/core';
import type { MoodEntry } from '../src/types';

const entry: MoodEntry = {
  id: 'synthetic',
  emotionId: 'good',
  timestamp: 1788900000000,
  activityIds: ['work'],
  note: '合成样本',
};
function setup() {
  const values = new Map([[STORAGE_KEY, JSON.stringify([entry])]]);
  let failWrite = false;
  const adapter: StorageAdapter = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      if (failWrite) {
        failWrite = false;
        throw new Error('write failed');
      }
      values.set(key, value);
    },
  };
  return {
    values,
    store: createMoodStorage(adapter),
    external: createMoodStorage(adapter),
    fail: () => {
      failWrite = true;
    },
  };
}

test('unchanged storage reuses an immutable snapshot, including nested activities', async () => {
  const { store } = setup();
  const snapshot = await store.read();
  assert.equal(await store.read(), snapshot);
  assert.throws(() => snapshot.push(entry), TypeError);
  assert.throws(() => {
    snapshot[0].note = 'corrupt';
  }, TypeError);
  assert.throws(() => snapshot[0].activityIds!.push('sleep'), TypeError);
  assert.equal((await store.read())[0].note, entry.note);
});
test('cached reads see external edits, removal and invalid bytes immediately', async () => {
  const { store, external, values } = setup();
  const first = await store.read();
  await external.update({ ...entry, note: 'external' }, entry);
  const second = await store.read();
  assert.notEqual(first, second);
  assert.equal(second[0].note, 'external');
  values.set(STORAGE_KEY, '{bad json');
  await assert.rejects(store.read(), /原始数据已保留/);
  values.delete(STORAGE_KEY);
  const empty = await store.read();
  assert.deepEqual(empty, []);
  assert.equal(await store.read(), empty);
});
test('failed writes do not publish or cache unsaved input; retry gets a fresh snapshot', async () => {
  const { store, fail } = setup();
  const before = await store.read();
  fail();
  await assert.rejects(store.update({ ...entry, note: 'draft' }, entry), /write failed/);
  assert.equal(await store.read(), before);
  const saved = await store.update({ ...entry, note: 'retry' }, entry);
  assert.equal(saved, await store.read());
  assert.equal(saved[0].note, 'retry');
  assert.equal(before[0].note, entry.note);
});
