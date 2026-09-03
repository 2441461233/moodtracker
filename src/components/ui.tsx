import React, { ComponentProps, PropsWithChildren } from 'react';
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
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}
    >
      {children}
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
  const color =
    kind === 'primary'
      ? theme.background === '#171821'
        ? '#252039'
        : '#FFFFFF'
      : kind === 'danger'
        ? theme.danger
        : theme.accentText;
  const backgroundColor =
    kind === 'primary'
      ? theme.accent
      : kind === 'secondary'
        ? theme.accentSoft
        : kind === 'danger'
          ? theme.dangerSoft
          : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.button,
        {
          backgroundColor,
          opacity: disabled ? 0.4 : 1,
          transform: [{ translateY: hovered ? -1 : 0 }, { scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} size="small" />
      ) : icon ? (
        <Icon name={icon} size={19} color={color} />
      ) : null}
      <Label style={{ color, fontWeight: '600', fontSize: 14, flexShrink: 1, textAlign: 'center' }}>
        {children}
      </Label>
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
        backgroundColor: theme.background === '#171821' ? mood.dark : mood.soft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 2 : 0,
        borderColor: mood.color,
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
        <Label accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600' }}>
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
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 21,
          backgroundColor: theme.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={29} color={theme.accentText} />
      </View>
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
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
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
        borderRadius: 13,
        alignSelf: 'flex-start',
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.id }}
          onPress={() => onChange(option.id)}
          style={({ pressed }) => ({
            minHeight: 36,
            minWidth: 62,
            maxWidth: '100%',
            flexShrink: 1,
            paddingHorizontal: 15,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            backgroundColor: value === option.id ? theme.surface : 'transparent',
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
  card: { padding: 24, borderRadius: 24, borderWidth: 1 },
  button: {
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
