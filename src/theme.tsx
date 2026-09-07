import { createContext, useContext } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export const lightTheme = {
  dark: false,
  background: '#F4F5FB',
  surface: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.86)',
  subtle: '#F0F1F8',
  text: '#26273B',
  secondary: '#646A80',
  muted: '#6A6D81',
  border: '#E8EAF3',
  cardBorder: '#E9EBF4',
  accent: '#6C63DF',
  accentFrom: '#6C63DF',
  accentTo: '#9D8BFF',
  accentSoft: '#EEECFF',
  accentText: '#5C53CE',
  green: '#23977F',
  greenSoft: '#EAF7F2',
  orange: '#B98439',
  orangeSoft: '#FBF3E5',
  danger: '#B24B59',
  dangerSoft: '#FBEFF0',
  overlay: 'rgba(22, 22, 44, 0.42)',
  shadow: '#3C3669',
};
export const darkTheme: typeof lightTheme = {
  dark: true,
  background: '#0B0D18',
  surface: '#16182A',
  glass: 'rgba(22, 24, 42, 0.84)',
  subtle: '#1D2033',
  text: '#F1F0F9',
  secondary: '#A9ADC5',
  muted: '#7E8299',
  border: '#272B42',
  cardBorder: 'rgba(255, 255, 255, 0.07)',
  accent: '#8B7CF6',
  accentFrom: '#7466F0',
  accentTo: '#A78BFA',
  accentSoft: '#262047',
  accentText: '#C4B8FF',
  green: '#54C9A4',
  greenSoft: '#16302A',
  orange: '#E5B06E',
  orangeSoft: '#3A2F1E',
  danger: '#E88A93',
  dangerSoft: '#3D252E',
  overlay: 'rgba(4, 5, 12, 0.7)',
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
    color: '#26BF9A',
    soft: '#E3F7F0',
    dark: '#173B32',
    glow: 'rgba(38, 191, 154, 0.38)',
    icon: 'emoticon-excited-outline',
    label: '很开心',
    hint: '美好正在发生',
  },
  good: {
    color: '#5890E0',
    soft: '#E9F2FD',
    dark: '#1C3350',
    glow: 'rgba(88, 144, 224, 0.38)',
    icon: 'emoticon-happy-outline',
    label: '还不错',
    hint: '小确幸也值得记住',
  },
  neutral: {
    color: '#E0AA3E',
    soft: '#FBF3DE',
    dark: '#3E351C',
    glow: 'rgba(224, 170, 62, 0.36)',
    icon: 'emoticon-neutral-outline',
    label: '还好',
    hint: '平平淡淡也很好',
  },
  anxious: {
    color: '#E06A7A',
    soft: '#FCEDEF',
    dark: '#432631',
    glow: 'rgba(224, 106, 122, 0.36)',
    icon: 'emoticon-sad-outline',
    label: '有点烦',
    hint: '允许自己慢下来',
  },
  sad: {
    color: '#A882E0',
    soft: '#F2EBFB',
    dark: '#322A4C',
    glow: 'rgba(168, 130, 224, 0.4)',
    icon: 'emoticon-cry-outline',
    label: '很难过',
    hint: '不必急着变开心',
  },
} as const;
