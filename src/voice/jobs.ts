import { fetch } from 'expo/fetch';
import { moodStorage } from '../storage';
import type { MoodEntry, VoiceRecording } from '../types';
import { audioBlob } from './files';
import { readVoiceConfig } from './config';
import { applyVoiceResult, TranscriptionResult, validateTranscriptionResult } from './core';

export type VoiceJob = {
  status: 'pending' | 'ready' | 'failed';
  result?: TranscriptionResult;
  error?: string;
};
const jobs = new Map<string, VoiceJob>();
const running = new Map<string, AbortController>();
const listeners = new Set<() => void>();
export const subscribeVoiceJobs = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getVoiceJob = (id?: string) => (id ? jobs.get(id) : undefined);
const publish = (id: string, value: VoiceJob) => {
  jobs.set(id, value);
  listeners.forEach((listener) => listener());
};
export function currentVoice(voice?: VoiceRecording): VoiceRecording | undefined {
  if (!voice || !voice.fileName) return voice;
  const job = jobs.get(voice.id);
  return job?.result
    ? applyVoiceResult(voice, job.result)
    : job
      ? { ...voice, status: job.status, error: job.error }
      : voice;
}
export async function flushVoiceJob(id: string): Promise<MoodEntry[]> {
  return moodStorage.updateVoice(id, (voice) => currentVoice(voice)!);
}
export function cancelVoiceJob(id: string) {
  running.get(id)?.abort();
  running.delete(id);
  jobs.delete(id);
}
export async function startVoiceJob(voice: VoiceRecording): Promise<void> {
  if (running.has(voice.id)) return;
  const controller = new AbortController();
  running.set(voice.id, controller);
  publish(voice.id, { status: 'pending' });
  const timeout = setTimeout(() => controller.abort(), 150000);
  try {
    const config = await readVoiceConfig();
    if (!config.enabled || !config.url || !config.token)
      throw new Error('原声已保留。请在「我的空间 → 语音转写」配置并启用服务后重试。');
    const blob = await audioBlob(voice);
    const response = await fetch(`${config.url}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': voice.mimeType,
        Authorization: `Bearer ${config.token}`,
        'X-Recording-Id': voice.id,
        'X-Recording-Duration': String(voice.durationMs),
      },
      body: blob,
      signal: controller.signal,
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: '转写服务口令不正确，请在我的空间更新。',
        413: '录音超过服务大小上限。',
        429: '转写服务繁忙，请稍后重试。',
        503: '转写服务还未配置好，请检查服务端 API Key。',
      };
      throw new Error(messages[response.status] ?? '云端暂时无法转写，原声已保留，请重试。');
    }
    const result = validateTranscriptionResult(await response.json());
    if (running.get(voice.id) !== controller) return;
    publish(voice.id, { status: 'ready', result });
  } catch (error) {
    if (running.get(voice.id) !== controller) return;
    publish(voice.id, {
      status: 'failed',
      error: controller.signal.aborted
        ? '转写等待超时，原声已保留，请稍后重试。'
        : error instanceof Error
          ? error.message.slice(0, 300)
          : '转写失败，原声已保留。',
    });
  } finally {
    clearTimeout(timeout);
    if (running.get(voice.id) === controller) {
      // Keep the in-memory result on a failed disk write; saving/retrying can flush it again.
      try {
        await flushVoiceJob(voice.id);
      } catch {
        /* Never discard an otherwise successful result. */
      }
      running.delete(voice.id);
      listeners.forEach((listener) => listener());
    }
  }
}
export function resumeVoiceJobs(entries: MoodEntry[]) {
  for (const entry of entries)
    if (entry.voice?.status === 'pending' && entry.voice.fileName && !jobs.has(entry.voice.id))
      void startVoiceJob(entry.voice);
}
