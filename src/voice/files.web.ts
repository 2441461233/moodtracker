import type { VoiceRecording } from '../types';
import { MAX_AUDIO_BYTES, validateVoice } from './core';

let database: Promise<IDBDatabase> | undefined;
function open() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('moodtracker-voice-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('audio');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(new Error('浏览器无法保存录音，请检查存储权限。'));
    };
  }));
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('audio', mode);
    const request = operation(tx.objectStore('audio'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(new Error('录音存储失败，请检查浏览器空间后重试。'));
  });
}
export async function retainRecording(uri: string, durationMs: number): Promise<VoiceRecording> {
  if (!uri.startsWith('blob:')) throw new Error('无法读取这次录音。');
  const blob = await (await fetch(uri)).blob();
  if (!blob.size || blob.size > MAX_AUDIO_BYTES) throw new Error('录音为空或超过 12 MB。');
  const mimeType = blob.type.includes('mp4')
    ? 'audio/mp4'
    : blob.type.includes('ogg')
      ? 'audio/ogg'
      : 'audio/webm';
  const id = `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const fileName = `${id}.${mimeType === 'audio/mp4' ? 'm4a' : mimeType === 'audio/ogg' ? 'ogg' : 'webm'}`;
  await transaction('readwrite', (store) => store.add(blob, fileName));
  URL.revokeObjectURL(uri);
  return { id, fileName, mimeType, durationMs, status: 'pending' };
}
export async function audioBlob(voice: VoiceRecording): Promise<Blob> {
  validateVoice(voice);
  if (!voice.fileName) throw new Error('文字备份不包含原声。');
  const blob = await transaction('readonly', (store) => store.get(voice.fileName!));
  if (!(blob instanceof Blob) || !blob.size) throw new Error('本机找不到原声，文字仍然保留。');
  if (blob.size > MAX_AUDIO_BYTES) throw new Error('原声超过 12 MB，无法转写。');
  return blob;
}
export async function playbackSource(voice: VoiceRecording) {
  const uri = URL.createObjectURL(await audioBlob(voice));
  return {
    uri,
    release() {
      URL.revokeObjectURL(uri);
    },
  };
}
export async function removeRecording(voice: VoiceRecording): Promise<void> {
  validateVoice(voice);
  if (voice.fileName) await transaction('readwrite', (store) => store.delete(voice.fileName!));
}
export async function shareRecording(voice: VoiceRecording): Promise<void> {
  const source = await playbackSource(voice);
  const anchor = document.createElement('a');
  anchor.href = source.uri;
  anchor.download = voice.fileName!;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(source.release, 10000);
}
