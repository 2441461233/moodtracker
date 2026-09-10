import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../src/voice/audio-session.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
  const calls: { mode: Record<string, unknown>; resolve(): void; reject(error: Error): void }[] =
    [];
  const module = {
    exports: {} as {
      setRecordingAudioMode(): Promise<void>;
      setPlaybackAudioMode(): Promise<void>;
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: () => ({
      setAudioModeAsync: (mode: Record<string, unknown>) =>
        new Promise<void>((resolve, reject) => calls.push({ mode, resolve, reject })),
    }),
  });
  return { calls, ...module.exports };
}

test('capture and playback audio-mode transitions do not overlap', async () => {
  const audio = fixture();
  const recording = audio.setRecordingAudioMode();
  const playback = audio.setPlaybackAudioMode();
  await tick();
  assert.equal(audio.calls.length, 1);
  assert.equal(audio.calls[0].mode.allowsRecording, true);
  audio.calls[0].resolve();
  await recording;
  await tick();
  assert.equal(audio.calls.length, 2);
  assert.equal(audio.calls[1].mode.allowsRecording, false);
  for (const { mode } of audio.calls) {
    assert.equal(mode.playsInSilentMode, true);
    assert.equal(mode.shouldPlayInBackground, false);
    assert.equal(mode.allowsBackgroundRecording, false);
    assert.equal(mode.interruptionMode, 'doNotMix');
  }
  audio.calls[1].resolve();
  await playback;
});

test('a failed audio-mode transition does not prevent recovery or another recording', async () => {
  const audio = fixture();
  const failed = assert.rejects(audio.setRecordingAudioMode(), /interrupted/);
  const recovery = audio.setPlaybackAudioMode();
  await tick();
  audio.calls[0].reject(new Error('interrupted'));
  await failed;
  await tick();
  assert.equal(audio.calls.length, 2);
  audio.calls[1].resolve();
  await recovery;
  const next = audio.setRecordingAudioMode();
  await tick();
  assert.equal(audio.calls[2].mode.allowsRecording, true);
  audio.calls[2].resolve();
  await next;
});
