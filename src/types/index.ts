export type EmotionId = 'joyful' | 'good' | 'neutral' | 'anxious' | 'sad';
export type EmotionValence = 'positive' | 'neutral' | 'negative';
export type CategoryId = 'work' | 'life' | 'relationship' | 'other';

export interface Emotion {
  id: EmotionId;
  label: string;
  emoji: string;
  color: string;
  gradientColors: [string, string];
  valence: EmotionValence;
  description: string;
}

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
}

export interface MoodEntry {
  id: string;
  emotionId: EmotionId;
  categoryId?: CategoryId;
  note?: string;
  timestamp: number; // Unix ms
  activityIds?: string[];
  updatedAt?: number;
}

export type AppTab = 'today' | 'calendar' | 'insights' | 'settings';
export interface AppSettings {
  name: string;
  theme: 'light' | 'dark' | 'system';
  haptics: boolean;
}
export interface Activity {
  id: string;
  label: string;
  icon: string;
  color: string;
}
