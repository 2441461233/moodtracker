import React, { ComponentProps, PropsWithChildren, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { font, MOOD_APPEARANCE, useTheme } from '../theme';
import { EmotionId } from '../types';
import { Gradient } from './effects';

export function Icon({ name, size = 22, color }: { name: string; size?: number; color?: string }) {
  const theme = useTheme();
  return (
    <MaterialCommunityIcons
      name={name as ComponentProps<typeof MaterialCommunityIcons>['name']}
      size={size}
      color={color ?? theme.secondary}
      accessible={false}
      aria-hidden
    />
  );
}
export function Label({
  children,
  style,
  muted = false,
  ...rest
}: PropsWithChildren<{ style?: StyleProp<TextStyle>; muted?: boolean }> &
  ComponentProps<typeof Text>) {
  const theme = useTheme();
  return (
    <Text {...rest} style={[styles.text, { color: muted ? theme.secondary : theme.text }, style]}>
      {children}
    </Text>
  );
}
/** 卡片顶部的高光线，让深色卡片有“被光照到”的层次。 */
function CardHighlight() {
  const theme = useTheme();
  if (!theme.dark) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 30, right: 30, height: 1 }}
    >
      <Gradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.cardBorder,
          boxShadow: theme.dark
            ? '0 12px 40px rgba(0, 0, 0, 0.34)'
            : '0 14px 36px rgba(60, 54, 105, 0.09)',
        },
        style,
      ]}
    >
      <CardHighlight />
      {children}
    </View>
  );
}
export function Disclosure({ title, children }: PropsWithChildren<{ title: string }>) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => ({
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Label muted style={{ fontSize: 12, lineHeight: 20 }}>
          {title}
        </Label>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} />
      </Pressable>
      {expanded && <View style={{ gap: 8, paddingBottom: 12 }}>{children}</View>}
    </View>
  );
}
export function Button({
  children,
  onPress,
  icon,
  kind = 'primary',
  disabled,
  busy,
  style,
  label,
}: PropsWithChildren<{
  onPress: () => void;
  icon?: string;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  label?: string;
}>) {
  const theme = useTheme();
  const primary = kind === 'primary';
  const color = primary
    ? theme.dark
      ? '#17123A'
      : '#FFFFFF'
    : kind === 'danger'
      ? theme.danger
      : theme.accentText;
  const backgroundColor =
    kind === 'secondary'
      ? theme.accentSoft
      : kind === 'danger'
        ? theme.dangerSoft
        : 'transparent';
  const content = busy ? (
    <ActivityIndicator color={color} size="small" />
  ) : icon ? (
    <Icon name={icon} size={19} color={color} />
  ) : null;
  const text = (
    <Label style={{ color, fontWeight: '600', fontSize: 14, flexShrink: 1, textAlign: 'center' }}>
      {children}
    </Label>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        {
          borderRadius: 15,
          opacity: disabled ? 0.4 : 1,
          transform: [{ translateY: hovered && !disabled ? -1 : 0 }, { scale: pressed ? 0.98 : 1 }],
        },
        primary && {
          boxShadow: theme.dark
            ? '0 8px 26px rgba(139, 124, 246, 0.42)'
            : '0 10px 24px rgba(108, 99, 223, 0.36)',
        },
        style,
      ]}
    >
      {primary ? (
        <Gradient
          colors={[theme.accentFrom, theme.accentTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          borderRadius={15}
          style={styles.button}
        >
          {content}
          {text}
        </Gradient>
      ) : (
        <View style={[styles.button, { backgroundColor }]}>
          {content}
          {text}
        </View>
      )}
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  disabled,
  selected = false,
}: {
  name: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed, hovered }) => [
        styles.iconButton,
        {
          opacity: disabled ? 0.3 : 1,
          backgroundColor: selected || hovered || pressed ? theme.accentSoft : theme.subtle,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <Icon name={name} size={20} color={selected ? theme.accentText : theme.secondary} />
    </Pressable>
  );
}
export function MoodIcon({
  id,
  size = 48,
  selected = false,
}: {
  id: EmotionId;
  size?: number;
  selected?: boolean;
}) {
  const theme = useTheme();
  const mood = MOOD_APPEARANCE[id];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.36,
        backgroundColor: theme.dark ? mood.dark : mood.soft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 2 : 0,
        borderColor: mood.color,
        boxShadow: `0 0 ${Math.round(size * 0.55)}px ${mood.glow}`,
      }}
    >
      <Icon name={mood.icon} size={size * 0.66} color={mood.color} />
    </View>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View style={{ flex: 1, gap: 4 }}>
        <Label
          accessibilityRole="header"
          style={{ fontSize: 17, fontWeight: '600', letterSpacing: -0.2 }}
        >
          {title}
        </Label>
        {subtitle && (
          <Label muted style={{ fontSize: 12, lineHeight: 19 }}>
            {subtitle}
          </Label>
        )}
      </View>
      {action && onAction && (
        <Button onPress={onAction} kind="ghost" icon="chevron-right">
          {action}
        </Button>
      )}
    </View>
  );
}
export function EmptyState({
  icon = 'notebook-outline',
  title,
  description,
  action,
  onAction,
  compact = false,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: compact ? 22 : 38,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <Gradient
        colors={theme.dark ? [theme.accentSoft, theme.subtle] : [theme.accentSoft, theme.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        borderRadius={23}
        style={{
          width: 62,
          height: 62,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: theme.dark ? '0 0 30px rgba(139, 124, 246, 0.22)' : undefined,
        }}
      >
        <Icon name={icon} size={30} color={theme.accentText} />
      </Gradient>
      <Label style={{ fontSize: 15, fontWeight: '600', textAlign: 'center' }}>{title}</Label>
      <Label muted style={{ maxWidth: 320, fontSize: 13, lineHeight: 22, textAlign: 'center' }}>
        {description}
      </Label>
      {action && onAction && (
        <Button onPress={onAction} kind="secondary" style={{ marginTop: 3 }}>
          {action}
        </Button>
      )}
    </View>
  );
}
export function Segment<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 4,
        maxWidth: '100%',
        backgroundColor: theme.subtle,
        padding: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        alignSelf: 'flex-start',
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.id, disabled }}
          disabled={disabled}
          onPress={() => onChange(option.id)}
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 62,
            maxWidth: '100%',
            flexShrink: 1,
            paddingHorizontal: 15,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            backgroundColor: value === option.id ? theme.surface : 'transparent',
            boxShadow:
              value === option.id && !theme.dark
                ? '0 3px 10px rgba(60, 54, 105, 0.12)'
                : undefined,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Label
            style={{
              fontSize: 13,
              color: value === option.id ? theme.accentText : theme.secondary,
              fontWeight: value === option.id ? '600' : '400',
            }}
          >
            {option.label}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  text: { fontFamily: font, fontSize: 14, lineHeight: 21 },
  card: { padding: 24, borderRadius: 26, borderWidth: 1 },
  button: {
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 15,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
});
