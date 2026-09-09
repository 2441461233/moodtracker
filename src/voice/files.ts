import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { VoiceRecording } from '../types';
import { MAX_AUDIO_BYTES, validateVoice } from './core';

const folder = () => new Directory(Paths.document, 'voice-recordings');
function localFile(voice: VoiceRecording) {
  const validated = validateVoice(voice);
  if (!validated.fileName) throw new Error('这条记录没有本机原声，文字仍然保留。');
  return new File(folder(), validated.fileName);
}
export async function retainRecording(uri: string, durationMs: number): Promise<VoiceRecording> {
  const source = new File(uri);
  if (!source.exists || !source.size || source.size > MAX_AUDIO_BYTES)
    throw new Error('录音为空或超过 12 MB，请缩短录音后重试。');
  folder().create({ intermediates: true, idempotent: true });
  const id = `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const fileName = `${id}.m4a`;
  source.copy(new File(folder(), fileName));
  return { id, fileName, mimeType: 'audio/mp4', durationMs, status: 'pending' };
}
export async function audioBlob(voice: VoiceRecording): Promise<Blob> {
  const file = localFile(voice);
  if (!file.exists || !file.size) throw new Error('原声文件已不可用，文字仍然保留。');
  if (file.size > MAX_AUDIO_BYTES) throw new Error('原声超过 12 MB，无法转写。');
  return file;
}
export async function playbackSource(
  voice: VoiceRecording,
): Promise<{ uri: string; release(): void }> {
  const file = localFile(voice);
  if (!file.exists) throw new Error('本机找不到原声文件。');
  return { uri: file.uri, release() {} };
}
export async function removeRecording(voice: VoiceRecording): Promise<void> {
  if (!voice.fileName) return;
  const file = localFile(voice);
  if (file.exists) file.delete();
}
export async function shareRecording(voice: VoiceRecording): Promise<void> {
  const file = localFile(voice);
  if (!file.exists) throw new Error('本机找不到原声文件。');
  if (!(await Sharing.isAvailableAsync())) throw new Error('当前设备暂不支持分享原声。');
  await Sharing.shareAsync(file.uri, { mimeType: voice.mimeType, dialogTitle: '导出原声' });
}
