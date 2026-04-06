export type EmotionId = 'joyful' | 'good' | 'neutral' | 'anxious' | 'sad';
export type EmotionValence = 'positive' | 'neutral' | 'negative';

export interface Emotion {
  id: EmotionId;
  label: string;
  emoji: string;
  color: string;
  gradientColors: [string, string];
  valence: EmotionValence;
  description: string;
}

export interface MoodEntry {
  id: string;
  emotionId: EmotionId;
  note?: string;
  timestamp: number; // Unix ms
}
