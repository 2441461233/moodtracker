import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { validateServiceUrl } from './core';

export interface VoiceServiceConfig {
  url: string;
  token: string;
  enabled: boolean;
}
const key = 'moodtracker_voice_service_v1';
const empty: VoiceServiceConfig = { url: '', token: '', enabled: false };
export async function readVoiceConfig(): Promise<VoiceServiceConfig> {
  const raw =
    Platform.OS === 'web' ? sessionStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (!raw) return { ...empty };
  try {
    const value = JSON.parse(raw);
    return {
      url: validateServiceUrl(value.url),
      token: typeof value.token === 'string' ? value.token : '',
      enabled: value.enabled === true,
    };
  } catch {
    return { ...empty };
  }
}
export async function saveVoiceConfig(config: VoiceServiceConfig): Promise<void> {
  const value = {
    ...config,
    url: config.url.trim() ? validateServiceUrl(config.url) : '',
    token: config.token.trim(),
  };
  if (value.enabled && (!value.url || value.token.length < 24 || value.token.length > 256))
    throw new Error('请先填写服务地址与服务端提供的访问口令。');
  const raw = JSON.stringify(value);
  if (Platform.OS === 'web') sessionStorage.setItem(key, raw);
  else
    await SecureStore.setItemAsync(key, raw, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
}
