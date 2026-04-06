import { Category } from '../types';

export const CATEGORIES: Category[] = [
  {
    id: 'work',
    label: '工作',
    emoji: '💼',
    color: '#5B8DB8',
  },
  {
    id: 'life',
    label: '生活',
    emoji: '🏡',
    color: '#4CAF7D',
  },
  {
    id: 'relationship',
    label: '亲密关系',
    emoji: '💕',
    color: '#E07B9A',
  },
  {
    id: 'other',
    label: '其他',
    emoji: '✨',
    color: '#9B72CF',
  },
];

export const getCategoryById = (id: string): Category | undefined =>
  CATEGORIES.find((c) => c.id === id);
