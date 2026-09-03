import AsyncStorage from '@react-native-async-storage/async-storage';
import MoodHealth from '../../modules/mood-health';
import { createHealthExporter } from './core';

// A single queue owns all explicit writes. Health reads are never persisted here.
export const healthExporter = createHealthExporter(AsyncStorage, (sample) =>
  MoodHealth.saveStateOfMind(sample),
);

export { MoodHealth };
export { selectEntriesForHealth } from './core';
