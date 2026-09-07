import React, { PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout, useTheme } from '../theme';
import { Button, IconButton, Label } from './ui';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { WidgetSheetContext } from '../context/WidgetSheetContext';

export function Sheet({
  children,
  title,
  onClose,
  footer,
  wide = false,
  scrollKey,
  scrollRef,
  visible = true,
  onDismiss,
  dismissDisabled = false,
  contentDisabled = false,
  preserveOnQuickRecord = false,
}: PropsWithChildren<{
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  wide?: boolean;
  scrollKey?: string | number;
  scrollRef?: React.RefObject<ScrollView | null>;
  visible?: boolean;
  onDismiss?: () => void;
  dismissDisabled?: boolean;
  contentDisabled?: boolean;
  preserveOnQuickRecord?: boolean;
}>) {
  const theme = useTheme();
  const { compact, height } = useLayout();
  const insets = useSafeAreaInsets();
  const [reducedMotion, setReducedMotion] = useState(true);
  const internalScroll = useRef<ScrollView>(null);
  const scroll = scrollRef ?? internalScroll;
  const keyboardVisible = useKeyboardVisible();
  const quickRecord = useContext(WidgetSheetContext);
  const [quickDismissing, setQuickDismissing] = useState(false);
  const latest = useRef({ visible, dismissDisabled, quickDismissing });
  latest.current = { visible, dismissDisabled, quickDismissing };
  useEffect(() => {
    if (!quickRecord) return;
    return quickRecord.register({
      preserve: preserveOnQuickRecord,
      dismiss: () => {
        const current = latest.current;
        if (!current.visible || current.dismissDisabled || current.quickDismissing) return;
        Keyboard.dismiss();
        setQuickDismissing(true);
      },
    });
  }, [quickRecord, preserveOnQuickRecord]);
  useEffect(() => {
    quickRecord?.refresh();
  }, [quickRecord, dismissDisabled, visible]);
  const requestClose = () => {
    if (dismissDisabled) return;
    Keyboard.dismiss();
    onClose();
  };
  useEffect(() => {
    Keyboard.dismiss();
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
      visible={visible && !quickDismissing}
      transparent
      accessibilityLabel={title}
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={requestClose}
      onDismiss={() => {
        if (quickDismissing) onClose();
        else onDismiss?.();
      }}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: theme.overlay,
          justifyContent: compact ? 'flex-end' : 'center',
          alignItems: 'center',
          paddingHorizontal: compact ? 0 : 24,
          paddingTop: Math.max(insets.top, compact ? 18 : 24),
          paddingBottom: compact ? 0 : Math.max(insets.bottom, 24),
        }}
      >
        <View
          onStartShouldSetResponder={() => true}
          onResponderRelease={requestClose}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={requestClose}
          style={{
            width: '100%',
            maxWidth: wide ? 700 : 550,
            maxHeight:
              height -
              Math.max(insets.top, compact ? 18 : 24) -
              (compact ? 0 : Math.max(insets.bottom, 24)),
            flexShrink: 1,
            borderRadius: compact ? 28 : 26,
            borderBottomLeftRadius: compact ? 0 : 26,
            borderBottomRightRadius: compact ? 0 : 26,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.42)',
            paddingBottom: compact ? (keyboardVisible ? 0 : Math.max(insets.bottom, 12)) : 0,
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
            <Label accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', flex: 1 }}>
              {title}
            </Label>
            {keyboardVisible && (
              <Button kind="ghost" onPress={Keyboard.dismiss} style={{ paddingHorizontal: 10 }}>
                收起键盘
              </Button>
            )}
            <IconButton
              name="close"
              label="关闭弹窗"
              onPress={requestClose}
              disabled={dismissDisabled}
            />
          </View>
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: compact ? 24 : 30,
              paddingTop: 8,
              paddingBottom: 24,
            }}
            style={{ flexShrink: 1 }}
          >
            <View
              pointerEvents={contentDisabled ? 'none' : 'auto'}
              accessibilityElementsHidden={contentDisabled}
              importantForAccessibility={contentDisabled ? 'no-hide-descendants' : 'auto'}
            >
              {children}
            </View>
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
