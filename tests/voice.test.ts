import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyVoiceResult,
  entryText,
  validateServiceUrl,
  validateTranscriptionResult,
  validateVoice,
} from '../src/voice/core';
import { createMoodStorage, parseBackup, validateEntries } from '../src/storage/core';
import { makeBackup, makeCSV } from '../src/lib/backup';
import type { MoodEntry, VoiceRecording } from '../src/types';

const voice: VoiceRecording = {
  id: 'voice-synthetic-01',
  fileName: 'voice-synthetic-01.m4a',
  mimeType: 'audio/mp4',
  durationMs: 26000,
  status: 'pending',
};
const entry: MoodEntry = {
  id: 'synthetic-entry',
  emotionId: 'good',
  timestamp: 1788900000000,
  voice,
  note: '补充文字',
};
const result = {
  text: '我并没有解决所有问题，不过可以先休息一下。',
  originalText: '我并没有解决所有问题不过可以先休息一下',
};
function setup() {
  const data = new Map<string, string>();
  return createMoodStorage({
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  });
}
test('late results preserve manual edits, including intentionally empty text', () => {
  assert.equal(
    applyVoiceResult({ ...voice, edited: true, transcript: '自己的措辞' }, result).transcript,
    '自己的措辞',
  );
  assert.equal(applyVoiceResult({ ...voice, edited: true, transcript: '' }, result).transcript, '');
  assert.equal(applyVoiceResult(voice, result).transcript, result.text);
});
test('audio references reject traversal, mismatched identities and unbounded input', () => {
  for (const fileName of ['../secret.m4a', '/tmp/test.m4a', 'voice-synthetic-02.m4a'])
    assert.throws(() => validateVoice({ ...voice, fileName }));
  assert.throws(() => validateVoice({ ...voice, durationMs: 306000 }));
  assert.throws(() => validateVoice({ ...voice, transcript: 'x'.repeat(12001) }));
  assert.throws(() => validateVoice({ ...voice, mimeType: 'application/json' }));
  assert.deepEqual(validateEntries([entry])[0].voice, voice);
});
test('text backups keep AI text but cannot attach an existing local recording on import', () => {
  const saved = { ...entry, voice: applyVoiceResult(voice, result) };
  const [restored] = parseBackup(makeBackup([saved]));
  assert.equal(restored.voice?.fileName, undefined);
  assert.equal(restored.voice?.transcript, result.text);
  assert.equal(restored.voice?.originalTranscript, result.originalText);
  assert.equal(restored.voice?.status, 'ready');
  assert.equal(parseBackup(makeBackup([entry]))[0].voice?.status, 'failed');
  assert.equal(entryText(saved), `${result.text}\n\n补充文字`);
  assert.match(makeCSV([saved]), /我并没有解决所有问题/);
});
test('background result merges with a concurrently edited note under storage lock', async () => {
  const store = setup();
  await store.save(entry);
  await store.updateVoice(voice.id, (attachment) => applyVoiceResult(attachment, result));
  const [saved] = await store.update({ ...entry, note: '正在编辑的补充' }, entry);
  assert.equal(saved.note, '正在编辑的补充');
  assert.equal(saved.voice?.transcript, result.text);
  assert.ok(Object.isFrozen(saved.voice));
});
test('real concurrent manual edits still conflict', async () => {
  const store = setup();
  await store.save(entry);
  await store.update(
    { ...entry, voice: { ...voice, edited: true, transcript: '另一处的修改' } },
    entry,
  );
  await assert.rejects(store.update({ ...entry, note: '旧窗口输入' }, entry), /另一处/);
});
test('unchanged voice updates reuse the snapshot and imported text is never mutated as a local attachment', async () => {
  const store = setup();
  const initial = await store.save(entry);
  assert.equal(await store.updateVoice(voice.id, (attachment) => ({ ...attachment })), initial);
  const imported = {
    ...entry,
    id: 'imported-text',
    voice: { ...voice, fileName: undefined, status: 'ready' as const, transcript: '导入文字' },
  };
  await store.save(imported);
  const saved = await store.updateVoice(voice.id, (attachment) =>
    applyVoiceResult(attachment, result),
  );
  assert.equal(saved.find((value) => value.id === 'imported-text')?.voice?.transcript, '导入文字');
});
test('deletion and replacement cannot be resurrected by a late response', async () => {
  const store = setup();
  await store.save(entry);
  await store.remove(entry.id, entry);
  assert.deepEqual(
    await store.updateVoice(voice.id, (attachment) => applyVoiceResult(attachment, result)),
    [],
  );
  await store.save(entry);
  await store.update(
    { ...entry, voice: { ...voice, id: 'voice-replaced-02', fileName: 'voice-replaced-02.m4a' } },
    entry,
  );
  const [saved] = await store.updateVoice(voice.id, (attachment) =>
    applyVoiceResult(attachment, result),
  );
  assert.equal(saved.voice?.id, 'voice-replaced-02');
  assert.equal(saved.voice?.transcript, undefined);
});
test('concurrent manual transcript remains while AI original and completion state are merged', async () => {
  const store = setup();
  await store.save(entry);
  await store.updateVoice(voice.id, (attachment) => applyVoiceResult(attachment, result));
  const [saved] = await store.update(
    { ...entry, voice: { ...voice, edited: true, transcript: '我自己的表达' } },
    entry,
  );
  assert.equal(saved.voice?.transcript, '我自己的表达');
  assert.equal(saved.voice?.originalTranscript, result.originalText);
  assert.equal(saved.voice?.status, 'ready');
});
test('transcription service requires HTTPS except loopback and rejects credentials in URLs', () => {
  assert.equal(validateServiceUrl(' https://voice.example.com/ '), 'https://voice.example.com');
  assert.equal(validateServiceUrl('http://127.0.0.1:3100'), 'http://127.0.0.1:3100');
  for (const url of [
    'http://example.com',
    'https://secret@example.com',
    'https://example.com?token=x',
    'javascript:alert(1)',
  ])
    assert.throws(() => validateServiceUrl(url));
  for (const value of [
    { text: '', originalText: '原文' },
    { text: 'x'.repeat(12001), originalText: '原文' },
    null,
  ])
    assert.throws(() => validateTranscriptionResult(value));
});
