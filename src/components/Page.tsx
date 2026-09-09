import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout, useTheme } from '../theme';
import { Button, Label } from './ui';
import { FadeIn } from './effects';
import { useMoodActions } from '../context/MoodContext';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';

export function Page({
  children,
  title,
  subtitle,
  eyebrow,
  action = true,
  scrollKey,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: boolean;
  scrollKey?: string | number;
}>) {
  const { desktop, compact, width } = useLayout();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { openComposer } = useMoodActions();
  const keyboardVisible = useKeyboardVisible();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (scrollKey !== undefined) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey]);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: compact ? 20 : 36,
          paddingTop: desktop ? 42 : Math.max(insets.top, 16) + 12,
          paddingBottom: desktop || keyboardVisible ? 32 : Math.max(insets.bottom, 16) + 180,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', gap: 26 }}>
          <FadeIn>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, gap: 10 }}>
                {eyebrow && (
                  <Label
                    style={{
                      color: theme.accentText,
                      fontSize: 11,
                      letterSpacing: 2.4,
                      fontWeight: '600',
                    }}
                  >
                    {eyebrow}
                  </Label>
                )}
                <Label
                  accessibilityRole="header"
                  style={{
                    fontSize: width < 360 ? 23 : compact ? 28 : 32,
                    lineHeight: compact ? 37 : 43,
                    fontWeight: '700',
                    letterSpacing: -0.8,
                  }}
                >
                  {title}
                </Label>
                {subtitle && (
                  <Label muted style={{ fontSize: 13, lineHeight: 21 }}>
                    {subtitle}
                  </Label>
                )}
              </View>
              {action && desktop && (
                <Button onPress={() => openComposer()} icon="plus">
                  记录此刻
                </Button>
              )}
            </View>
          </FadeIn>
          <FadeIn delay={90} style={{ gap: 26 }}>
            {children}
          </FadeIn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
