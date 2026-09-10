// Synthetic boundaries for the real VoiceInput, VoicePlayer and job coordinator.
// No microphone, device files, credentials, personal storage or network access.
import { useEffect, useRef, useState } from 'react';
import type { VoiceRecording } from '../../src/types';

let failNext = false;
export function failNextTranscription() {
  failNext = true;
}
export const AudioModule = { requestRecordingPermissionsAsync: async () => ({ granted: true }) };
export const RecordingPresets = { HIGH_QUALITY: {} };
export const setAudioModeAsync = async () => {};
type Recorder = {
  uri: string;
  record(): void;
  pause(): void;
  stop(): Promise<void>;
  prepareToRecordAsync(): Promise<void>;
  getStatus(): { durationMillis: number; isRecording: boolean; metering: number };
};
export function useAudioRecorder() {
  return useRef<Recorder>(
    (() => {
      let elapsed = 0;
      let started = 0;
      const duration = () => elapsed + (started ? Date.now() - started : 0);
      return {
        uri: 'synthetic-voice',
        prepareToRecordAsync: async () => {
          elapsed = 0;
          started = 0;
        },
        record: () => {
          started = Date.now();
        },
        pause: () => {
          elapsed = duration();
          started = 0;
        },
        stop: async () => {
          elapsed = duration();
          started = 0;
        },
        getStatus: () => ({ durationMillis: duration(), isRecording: !!started, metering: -24 }),
      };
    })(),
  ).current;
}
export function useAudioRecorderState(recorder: Recorder, interval: number) {
  const [status, setStatus] = useState(recorder.getStatus());
  useEffect(() => {
    const timer = setInterval(() => setStatus(recorder.getStatus()), interval);
    return () => clearInterval(timer);
  }, [recorder, interval]);
  return status;
}
export function useAudioPlayer() {
  return useRef({
    playing: false,
    currentTime: 0,
    didJustFinish: false,
    replace: () => {},
    play() {
      this.playing = true;
    },
    pause() {
      this.playing = false;
    },
    seekTo: async () => {},
  }).current;
}
export function useAudioPlayerStatus(player: ReturnType<typeof useAudioPlayer>) {
  const [state, setState] = useState({ ...player });
  useEffect(() => {
    const timer = setInterval(() => setState({ ...player }), 200);
    return () => clearInterval(timer);
  }, [player]);
  return state;
}
export function createAudioPlayer() {
  const listeners = new Set<(status: object) => void>();
  const player = {
    playing: false,
    currentTime: 0,
    duration: 3,
    get currentStatus() {
      return { playing: this.playing, currentTime: this.currentTime, duration: this.duration };
    },
    play() {
      this.playing = true;
      listeners.forEach((notify) => notify(this.currentStatus));
    },
    pause() {
      this.playing = false;
      listeners.forEach((notify) => notify(this.currentStatus));
    },
    seekTo: async () => {},
    addListener(_event: string, notify: (status: object) => void) {
      listeners.add(notify);
      return { remove: () => listeners.delete(notify) };
    },
    release() {
      listeners.clear();
    },
  };
  return player;
}
export const readVoiceConfig = async () => ({
  url: 'https://synthetic.invalid',
  token: 'synthetic-fixture-token',
  enabled: true,
});
export const saveVoiceConfig = async () => {};
export const retainRecording = async (
  _uri: string,
  durationMs: number,
): Promise<VoiceRecording> => {
  const id = `voice-synthetic-${Date.now()}`;
  return { id, fileName: `${id}.m4a`, durationMs, mimeType: 'audio/mp4', status: 'pending' };
};
export const removeRecording = async () => {};
export const audioBlob = async () => new Blob(['synthetic']);
export const playbackSource = async () => ({ uri: 'synthetic-voice', release() {} });
export const shareRecording = async () => {};
export const fetch = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1800));
  if (failNext) {
    failNext = false;
    return new Response(null, { status: 502 });
  }
  return new Response(
    JSON.stringify({
      text: '今天下班以后，我去公园走了走。看见晚霞，心情慢慢平静下来。',
      originalText: '今天下班以后我去公园走了走嗯看见晚霞心情慢慢平静下来',
    }),
  );
};
