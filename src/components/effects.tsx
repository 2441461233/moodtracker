import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useTheme } from '../theme';

let reducedMotionCache: boolean | null = null;
export function useReducedMotion() {
  const [reduced, setReduced] = useState(reducedMotionCache ?? true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      reducedMotionCache = value;
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      reducedMotionCache = value;
      setReduced(value);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

let gradientId = 0;
function useGradientId() {
  return useRef(`gradient-${++gradientId}`).current;
}

/** 跨端线性渐变容器（react-native-svg 实现）。 */
export function Gradient({
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
  borderRadius = 0,
  children,
}: PropsWithChildren<{
  colors: [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle;
  borderRadius?: number;
}>) {
  const id = useGradientId();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const native = Platform.OS !== 'web';
  return (
    <View
      style={[style, { borderRadius, overflow: 'hidden' }]}
      onLayout={
        native
          ? ({ nativeEvent: { layout } }) => {
              const width = Math.max(layout.width, 0);
              const height = Math.max(layout.height, 0);
              setSize((current) =>
                current?.width === width && current.height === height ? current : { width, height },
              );
            }
          : undefined
      }
    >
      {/* Keep the background outside the padded content row. Native SVG uses
          measured bounds instead of percentage dimensions under Fabric. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          native && !size ? { backgroundColor: colors[0] } : undefined,
        ]}
      >
        {(!native || size) && (
          <Svg width={native ? size!.width : '100%'} height={native ? size!.height : '100%'}>
            <Defs>
              <SvgLinearGradient id={id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
                {colors.map((color, index) => (
                  <Stop
                    key={index}
                    offset={colors.length === 1 ? 0 : index / (colors.length - 1)}
                    stopColor={color}
                  />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
        )}
      </View>
      {children}
    </View>
  );
}

/** 情绪光斑：径向渐变的柔光圆，用于氛围背景与光晕。 */
export function GlowOrb({
  color,
  size,
  opacity = 1,
  style,
}: {
  color: string;
  size: number;
  opacity?: number;
  style?: ViewStyle;
}) {
  const id = useGradientId();
  const radius = size / 2;
  return (
    <View pointerEvents="none" style={[{ width: size, height: size, opacity }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgRadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset={0} stopColor={color} stopOpacity={0.55} />
            <Stop offset={0.45} stopColor={color} stopOpacity={0.22} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <SvgCircle cx={radius} cy={radius} r={radius} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function AmbientOrb({
  color,
  size,
  origin,
  drift,
  duration,
  reduced,
}: {
  color: string;
  size: number;
  origin: { top?: number; left?: number; right?: number };
  drift: { x: number; y: number };
  duration: number;
  reduced: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, duration, progress]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        ...origin,
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-drift.x, drift.x],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-drift.y, drift.y],
            }),
          },
        ],
      }}
    >
      <GlowOrb color={color} size={size} />
    </Animated.View>
  );
}

/** 页面级氛围背景：缓慢呼吸的“情绪极光”。 */
export function AmbientBackground({ paused = false }: { paused?: boolean }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  if (!theme.dark) {
    return (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <GlowOrb
          color="#B9B2F2"
          size={560}
          opacity={0.5}
          style={{ position: 'absolute', top: -180, right: -120 }}
        />
        <GlowOrb
          color="#BFE3D6"
          size={460}
          opacity={0.4}
          style={{ position: 'absolute', top: 320, left: -160 }}
        />
      </View>
    );
  }
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <AmbientOrb
        color="#5A4BD1"
        size={620}
        origin={{ top: -170, left: -110 }}
        drift={{ x: 34, y: 26 }}
        duration={9000}
        reduced={reduced || paused || !active}
      />
      <AmbientOrb
        color="#2C6E5D"
        size={520}
        origin={{ top: 200, right: -150 }}
        drift={{ x: 30, y: 40 }}
        duration={11000}
        reduced={reduced || paused || !active}
      />
      <AmbientOrb
        color="#7A4A78"
        size={480}
        origin={{ top: 520, left: 30 }}
        drift={{ x: 26, y: 30 }}
        duration={13000}
        reduced={reduced || paused || !active}
      />
    </View>
  );
}

/** 内容淡入上浮动画，尊重系统“减弱动态效果”。 */
export function FadeIn({
  children,
  delay = 0,
  translate = 12,
  style,
}: PropsWithChildren<{ delay?: number; translate?: number; style?: ViewStyle }>) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [reduced, delay, progress]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [translate, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
