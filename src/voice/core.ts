import type { MoodEntry, VoiceRecording } from '../types';

export const MAX_RECORDING_MS = 5 * 60 * 1000;
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
export const MAX_TRANSCRIPT_LENGTH = 12000;
const recordingId = /^[a-z0-9-]{8,100}$/;
const recordingFile = /^[a-z0-9-]{8,100}\.(m4a|webm|ogg)$/;

export function validateVoice(value: unknown): VoiceRecording {
  if (!value || typeof value !== 'object') throw new Error('语音记录格式不正确。');
  const voice = value as VoiceRecording;
  if (
    typeof voice.id !== 'string' ||
    !recordingId.test(voice.id) ||
    (voice.fileName !== undefined &&
      (typeof voice.fileName !== 'string' ||
        !recordingFile.test(voice.fileName) ||
        !voice.fileName.startsWith(`${voice.id}.`))) ||
    !['audio/mp4', 'audio/webm', 'audio/ogg'].includes(voice.mimeType) ||
    !Number.isFinite(voice.durationMs) ||
    voice.durationMs <= 0 ||
    voice.durationMs > MAX_RECORDING_MS + 5000 ||
    !['pending', 'ready', 'failed'].includes(voice.status) ||
    [voice.transcript, voice.originalTranscript].some(
      (text) =>
        text !== undefined && (typeof text !== 'string' || text.length > MAX_TRANSCRIPT_LENGTH),
    ) ||
    (voice.error !== undefined && (typeof voice.error !== 'string' || voice.error.length > 300)) ||
    (voice.edited !== undefined && typeof voice.edited !== 'boolean')
  )
    throw new Error('语音记录包含不支持的字段。');
  return {
    id: voice.id,
    mimeType: voice.mimeType,
    durationMs: voice.durationMs,
    status: voice.status,
    ...(voice.fileName ? { fileName: voice.fileName } : {}),
    ...(voice.transcript !== undefined ? { transcript: voice.transcript } : {}),
    ...(voice.originalTranscript !== undefined
      ? { originalTranscript: voice.originalTranscript }
      : {}),
    ...(voice.error ? { error: voice.error } : {}),
    ...(voice.edited ? { edited: true } : {}),
  };
}

export function entryText(entry: Pick<MoodEntry, 'note' | 'voice'>): string {
  return [entry.voice?.transcript?.trim(), entry.note?.trim()].filter(Boolean).join('\n\n');
}

export type TranscriptionResult = { text: string; originalText: string; warning?: string };
export function validateTranscriptionResult(value: unknown): TranscriptionResult {
  const result = value as Partial<TranscriptionResult> | null;
  if (
    !result ||
    typeof result.text !== 'string' ||
    !result.text.trim() ||
    result.text.length > MAX_TRANSCRIPT_LENGTH ||
    typeof result.originalText !== 'string' ||
    result.originalText.length > MAX_TRANSCRIPT_LENGTH ||
    (result.warning !== undefined &&
      (typeof result.warning !== 'string' || result.warning.length > 300))
  )
    throw new Error('转写返回的内容不完整，原声已保留，请重试。');
  return {
    text: result.text.trim(),
    originalText: result.originalText.trim(),
    ...(result.warning ? { warning: result.warning } : {}),
  };
}

/** A late response must never overwrite text that was manually edited. */
export function applyVoiceResult(
  voice: VoiceRecording,
  result: TranscriptionResult,
): VoiceRecording {
  return {
    ...voice,
    status: 'ready',
    transcript: voice.edited ? voice.transcript : result.text,
    originalTranscript: result.originalText,
    error: result.warning,
  };
}

export function validateServiceUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('请输入有效的转写服务地址。');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('转写服务需要 HTTPS 地址，且不能包含密钥、查询参数或片段。');
  return url.href.replace(/\/$/, '');
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
