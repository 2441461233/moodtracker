import { Activity, MoodEntry } from '../types';

export const ACTIVITIES: Activity[] = [
  { id: 'work', label: '工作', icon: 'briefcase-outline', color: '#7B74C9' },
  { id: 'exercise', label: '运动', icon: 'dumbbell', color: '#489B83' },
  { id: 'sleep', label: '好好睡觉', icon: 'weather-night', color: '#8285CB' },
  { id: 'friends', label: '朋友', icon: 'account-group-outline', color: '#D49469' },
  { id: 'family', label: '家人', icon: 'home-heart', color: '#CB8299' },
  { id: 'food', label: '美食', icon: 'silverware-fork-knife', color: '#CBA34D' },
  { id: 'nature', label: '亲近自然', icon: 'leaf', color: '#699C74' },
  { id: 'rest', label: '独处放松', icon: 'sofa-outline', color: '#AF8CC1' },
  { id: 'music', label: '音乐', icon: 'music-note-outline', color: '#8D8BC5' },
  { id: 'reading', label: '阅读', icon: 'book-open-page-variant-outline', color: '#B29270' },
  { id: 'partner', label: '亲密关系', icon: 'heart-outline', color: '#CC8097' },
  { id: 'walking', label: '散步', icon: 'walk', color: '#629CA1' },
  { id: 'study', label: '学习', icon: 'school-outline', color: '#788EB5' },
  { id: 'hobby', label: '兴趣爱好', icon: 'palette-outline', color: '#A77BC2' },
  { id: 'home', label: '日常生活', icon: 'home-outline', color: '#80A183' },
  { id: 'pets', label: '陪伴宠物', icon: 'paw-outline', color: '#C69B77' },
  { id: 'meditation', label: '冥想', icon: 'meditation', color: '#9B8DC2' },
  { id: 'travel', label: '旅行', icon: 'airplane', color: '#659BB4' },
  { id: 'movies', label: '影视', icon: 'movie-open-outline', color: '#9F85B3' },
  { id: 'gaming', label: '游戏', icon: 'controller-classic-outline', color: '#759E9A' },
  { id: 'chores', label: '做家务', icon: 'broom', color: '#B9A06A' },
  { id: 'health', label: '照顾身体', icon: 'heart-pulse', color: '#C48787' },
  { id: 'shopping', label: '购物', icon: 'shopping-outline', color: '#B38AA7' },
  { id: 'other', label: '其他', icon: 'dots-horizontal', color: '#9293A4' },
];

export function getActivityIds(entry: MoodEntry): string[] {
  if (entry.activityIds) return entry.activityIds;
  const legacy: Record<string, string> = {
    work: 'work',
    life: 'home',
    relationship: 'partner',
    other: 'other',
  };
  return entry.categoryId ? [legacy[entry.categoryId]] : [];
}
export const getActivity = (id: string) => ACTIVITIES.find((activity) => activity.id === id);
