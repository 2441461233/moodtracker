import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { MAX_BACKUP_BYTES } from '../storage/core';

export async function exportText(
  content: string,
  filename: string,
  mimeType = 'application/json',
): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('当前设备暂不支持文件分享，请换一个支持分享的设备。');
  const file = new File(Paths.cache, `${Date.now()}-${filename}`);
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle: '保存心情日记备份',
    UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json',
  });
}

export async function pickBackup(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || (asset.size ?? 0) > MAX_BACKUP_BYTES) {
    if (Platform.OS === 'web' && asset?.uri) URL.revokeObjectURL(asset.uri);
    throw new Error('请选择不超过 10 MB 的 JSON 备份文件。');
  }
  if (Platform.OS === 'web') {
    try {
      if (!asset.file) throw new Error('浏览器无法读取此文件，请重新选择。');
      return await asset.file.text();
    } finally {
      URL.revokeObjectURL(asset.uri);
    }
  }
  const file = new File(asset.uri);
  if (file.size > MAX_BACKUP_BYTES) throw new Error('备份文件不能超过 10 MB。');
  return file.text();
}
