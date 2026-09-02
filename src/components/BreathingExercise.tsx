import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, View } from 'react-native';
import { useMood } from '../context/MoodContext';
import { useTheme } from '../theme';
import { Button, Icon, Label } from './ui';
import { Sheet } from './Sheet';

export function BreathingExercise() {
  const { setBreathing } = useMood();
  const theme = useTheme();
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const scale = useRef(new Animated.Value(1)).current;
  const done = seconds >= 60;
  const inhaling = seconds % 10 < 4;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const visibility = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setRunning(false);
    });
    return () => {
      listener.remove();
      visibility.remove();
    };
  }, []);
  useEffect(() => {
    if (!running || done) return;
    const interval = setInterval(() => setSeconds((value) => Math.min(value + 1, 60)), 1000);
    return () => clearInterval(interval);
  }, [running, done]);
  useEffect(() => {
    if (!running || done || reducedMotion) {
      scale.stopAnimation();
      return;
    }
    const remaining = inhaling ? 4 - (seconds % 10) : 10 - (seconds % 10);
    Animated.timing(scale, {
      toValue: inhaling ? 1.22 : 1,
      duration: remaining * 1000,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    return () => scale.stopAnimation();
  }, [running, inhaling, done, reducedMotion, scale]);
  const start = () => {
    if (done) setSeconds(0);
    setRunning(!running || done);
  };
  return (
    <Sheet
      title="给自己一分钟"
      onClose={() => setBreathing(false)}
      footer={
        <Button
          icon={done ? 'check' : running ? 'pause' : 'play-outline'}
          onPress={done ? () => setBreathing(false) : start}
        >
          {done
            ? '带着这份平静，继续今天'
            : running
              ? '暂停一下'
              : seconds
                ? '继续呼吸'
                : '准备好了，开始'}
        </Button>
      }
    >
      <View style={{ alignItems: 'center', paddingVertical: 22, gap: 27 }}>
        <Label muted style={{ fontSize: 13, textAlign: 'center' }}>
          找一个舒服的姿势，让肩膀慢慢放松。
        </Label>
        <View style={{ width: 236, height: 236, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: theme.accentSoft,
              borderWidth: 1,
              borderColor: theme.accent,
              transform: [{ scale }],
            }}
          />
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Icon name={done ? 'check' : 'weather-windy'} size={30} color={theme.accentText} />
            <Label
              accessibilityLiveRegion="polite"
              style={{ fontSize: 26, fontWeight: '600', lineHeight: 37 }}
            >
              {done
                ? '做得很好'
                : !running
                  ? seconds
                    ? '休息一下'
                    : '准备开始'
                  : inhaling
                    ? '轻轻吸气'
                    : '慢慢呼气'}
            </Label>
            <Label muted style={{ fontSize: 12 }}>
              {done
                ? '谢谢你，留了一点时间给自己'
                : running
                  ? `${inhaling ? 4 - (seconds % 10) : 10 - (seconds % 10)} 秒`
                  : '跟随自己的舒适节奏'}
            </Label>
          </View>
        </View>
        <Label style={{ fontSize: 14, color: theme.accentText }}>
          {done ? '一分钟，属于你自己' : `还剩 ${60 - seconds} 秒`}
        </Label>
        <Label muted style={{ fontSize: 11, lineHeight: 21, textAlign: 'center', maxWidth: 330 }}>
          吸气约 4 秒，呼气约 6 秒，不需要屏息。{'\n'}如果感到不适，请随时停止，恢复自然呼吸。
        </Label>
      </View>
    </Sheet>
  );
}
