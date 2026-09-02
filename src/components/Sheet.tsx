import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout, useTheme } from '../theme';
import { IconButton, Label } from './ui';

export function Sheet({
  children,
  title,
  onClose,
  footer,
  wide = false,
  scrollKey,
}: PropsWithChildren<{
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  wide?: boolean;
  scrollKey?: string | number;
}>) {
  const theme = useTheme();
  const { compact, height } = useLayout();
  const insets = useSafeAreaInsets();
  const [reducedMotion, setReducedMotion] = useState(false);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey]);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => subscription.remove();
  }, []);
  // RN Web Modal owns focus trapping/restoration and topmost-only Escape handling.
  return (
    <Modal
      visible
      transparent
      accessibilityLabel={title}
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: theme.overlay,
          justifyContent: compact ? 'flex-end' : 'center',
          alignItems: 'center',
          padding: compact ? 0 : 24,
        }}
      >
        <View
          onStartShouldSetResponder={() => true}
          onResponderRelease={onClose}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: wide ? 700 : 550,
            maxHeight: height - Math.max(insets.top, compact ? 18 : 48),
            flexShrink: 1,
            borderRadius: compact ? 28 : 26,
            borderBottomLeftRadius: compact ? 0 : 26,
            borderBottomRightRadius: compact ? 0 : 26,
            backgroundColor: theme.surface,
            overflow: 'hidden',
            paddingBottom: compact ? Math.max(insets.bottom, 12) : 0,
          }}
        >
          {compact && (
            <View
              style={{
                height: 5,
                width: 38,
                borderRadius: 3,
                backgroundColor: theme.border,
                alignSelf: 'center',
                marginTop: 10,
              }}
            />
          )}
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: compact ? 12 : 22,
              paddingBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Label accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600' }}>
              {title}
            </Label>
            <IconButton name="close" label="关闭弹窗" onPress={onClose} />
          </View>
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: compact ? 24 : 30,
              paddingTop: 8,
              paddingBottom: 24,
            }}
            style={{ flexShrink: 1 }}
          >
            {children}
          </ScrollView>
          {footer && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.border,
                padding: compact ? 20 : 24,
              }}
            >
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
