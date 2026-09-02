import React, { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../theme';
import { Button, Label } from './ui';
import { useMood } from '../context/MoodContext';

export function Page({
  children,
  title,
  subtitle,
  eyebrow,
  action = true,
}: PropsWithChildren<{ title: string; subtitle?: string; eyebrow?: string; action?: boolean }>) {
  const { desktop, compact, width } = useLayout();
  const insets = useSafeAreaInsets();
  const { openComposer } = useMood();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: compact ? 20 : 36,
        paddingTop: desktop ? 39 : Math.max(insets.top, 16) + 12,
        paddingBottom: desktop ? 32 : insets.bottom + 125,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', gap: 26 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 9 }}>
            {eyebrow && (
              <Label muted style={{ fontSize: 12, letterSpacing: 1 }}>
                {eyebrow}
              </Label>
            )}
            <Label
              accessibilityRole="header"
              style={{
                fontSize: width < 360 ? 22 : compact ? 27 : 30,
                lineHeight: compact ? 36 : 42,
                fontWeight: '700',
                letterSpacing: -0.7,
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
        {children}
      </View>
    </ScrollView>
  );
}
