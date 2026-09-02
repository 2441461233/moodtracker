import { createContext, useContext } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export const lightTheme = {
  background: '#F7F8FC',
  surface: '#FFFFFF',
  subtle: '#F2F3F8',
  text: '#27283D',
  secondary: '#646A80',
  muted: '#6A6D81',
  border: '#EBECF3',
  accent: '#6C63DF',
  accentSoft: '#EEECFF',
  accentText: '#6258CF',
  green: '#23977F',
  greenSoft: '#EAF7F2',
  orange: '#B98439',
  orangeSoft: '#FBF3E5',
  danger: '#B24B59',
  dangerSoft: '#FBEFF0',
  overlay: 'rgba(25, 25, 49, 0.32)',
  shadow: '#3C3669',
};
export const darkTheme: typeof lightTheme = {
  background: '#171821',
  surface: '#22232F',
  subtle: '#2B2D3B',
  text: '#F0EFF7',
  secondary: '#B6B7C9',
  muted: '#9295AB',
  border: '#353747',
  accent: '#AAA0FF',
  accentSoft: '#34304F',
  accentText: '#B9B1FF',
  green: '#6BC6AA',
  greenSoft: '#243D36',
  orange: '#E3B978',
  orangeSoft: '#42382A',
  danger: '#E8A0A6',
  dangerSoft: '#452D36',
  overlay: 'rgba(0, 0, 0, 0.62)',
  shadow: '#000000',
};
export const ThemeContext = createContext(lightTheme);
export const useTheme = () => useContext(ThemeContext);
export const font = Platform.select({
  web: 'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  default: undefined,
});
export const useLayout = () => {
  const { width, height } = useWindowDimensions();
  return { width, height, desktop: width >= 1024, wide: width >= 1180, compact: width < 600 };
};
export const MOOD_APPEARANCE = {
  joyful: {
    color: '#229D7D',
    soft: '#E5F6EF',
    dark: '#24473C',
    icon: 'emoticon-excited-outline',
    label: '很开心',
    hint: '美好正在发生',
  },
  good: {
    color: '#4D89C7',
    soft: '#EAF3FD',
    dark: '#293C52',
    icon: 'emoticon-happy-outline',
    label: '还不错',
    hint: '小确幸也值得记住',
  },
  neutral: {
    color: '#AD8635',
    soft: '#FBF3DF',
    dark: '#463E28',
    icon: 'emoticon-neutral-outline',
    label: '还好',
    hint: '平平淡淡也很好',
  },
  anxious: {
    color: '#C37180',
    soft: '#FBEDEF',
    dark: '#4A303C',
    icon: 'emoticon-sad-outline',
    label: '有点烦',
    hint: '允许自己慢下来',
  },
  sad: {
    color: '#967CB6',
    soft: '#F0EAF7',
    dark: '#3D314B',
    icon: 'emoticon-cry-outline',
    label: '很难过',
    hint: '不必急着变开心',
  },
} as const;
