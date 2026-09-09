import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface NativeMoodWidgets {
  setCalendarSnapshot(json: string | null): Promise<void>;
}

const native =
  Platform.OS === 'ios' ? requireOptionalNativeModule<NativeMoodWidgets>('MoodWidgets') : null;

export async function setWidgetCalendarSnapshot(json: string | null): Promise<void> {
  await native?.setCalendarSnapshot(json);
}
