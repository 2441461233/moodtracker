import AsyncStorage from '@react-native-async-storage/async-storage';
import MoodHealth from '../../modules/mood-health';
import { createHealthExporter } from './core';

// One queue owns opted-in automatic writes and recovery retries. Incoming health
// samples are never persisted here or passed to the journal storage.
export const healthExporter = createHealthExporter(AsyncStorage, (sample) =>
  MoodHealth.saveStateOfMind(sample),
);

export { MoodHealth };
export { selectEntriesForHealth } from './core';
