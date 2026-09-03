import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { createMoodHealthBridge } from './bridge';
import type { NativeMoodHealthModule } from './types';

// No permission prompt, query, or write occurs while importing this module.
// Expo Go and other binaries without this module can still open the app.
const native =
  Platform.OS === 'ios' ? requireOptionalNativeModule<NativeMoodHealthModule>('MoodHealth') : null;
const MoodHealth = createMoodHealthBridge(native, Platform.OS);

export const {
  getAvailability,
  getWriteAuthorization,
  requestAuthorization,
  queryStateOfMind,
  saveStateOfMind,
} = MoodHealth;

export default MoodHealth;
