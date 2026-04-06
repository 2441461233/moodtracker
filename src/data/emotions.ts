import { Emotion } from '../types';

export const EMOTIONS: Emotion[] = [
  {
    id: 'joyful',
    label: '很开心',
    emoji: '😄',
    color: '#F5A623',
    gradientColors: ['#FFD93D', '#F5A623'],
    valence: 'positive',
    description: '充满活力，心情愉悦',
  },
  {
    id: 'good',
    label: '还不错',
    emoji: '🙂',
    color: '#4CAF7D',
    gradientColors: ['#7ED99E', '#4CAF7D'],
    valence: 'positive',
    description: '感觉良好，状态稳定',
  },
  {
    id: 'neutral',
    label: '还好',
    emoji: '😐',
    color: '#8A9BB0',
    gradientColors: ['#B0BEC5', '#8A9BB0'],
    valence: 'neutral',
    description: '平平淡淡，波澜不惊',
  },
  {
    id: 'anxious',
    label: '有点烦',
    emoji: '😟',
    color: '#9B72CF',
    gradientColors: ['#C39BD3', '#9B72CF'],
    valence: 'negative',
    description: '有些焦虑或不安',
  },
  {
    id: 'sad',
    label: '很难过',
    emoji: '😢',
    color: '#5B8DB8',
    gradientColors: ['#89B4D1', '#5B8DB8'],
    valence: 'negative',
    description: '心情低落，有些难受',
  },
];

export const getEmotionById = (id: string): Emotion | undefined =>
  EMOTIONS.find((e) => e.id === id);
