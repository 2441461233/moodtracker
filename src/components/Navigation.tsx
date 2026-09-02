import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout, useTheme } from '../theme';
import { useMood } from '../context/MoodContext';
import { Button, Icon, Label } from './ui';

const items: Record<string, { label: string; icon: string; short: string }> = {
  today: { label: '今日心情', short: '今天', icon: 'emoticon-happy-outline' },
  calendar: { label: '心情日历', short: '日历', icon: 'calendar-month-outline' },
  insights: { label: '情绪洞察', short: '洞察', icon: 'chart-box-outline' },
  settings: { label: '我的空间', short: '我的', icon: 'tune-variant' },
};
export function Navigation({ state, navigation, descriptors }: BottomTabBarProps) {
  const theme = useTheme();
  const { desktop, height, width } = useLayout();
  const { settings, openComposer, feedback } = useMood();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={
        desktop
          ? {
              width: 224,
              padding: 22,
              paddingTop: 32,
              backgroundColor: theme.surface,
              borderRightWidth: 1,
              borderRightColor: theme.border,
              gap: 24,
            }
          : {
              position: 'absolute',
              bottom: Math.max(insets.bottom, 16),
              left: Math.max(20, (width - 470) / 2),
              right: Math.max(20, (width - 470) / 2),
              borderRadius: 25,
              padding: 7,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              shadowColor: theme.shadow,
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.12,
              shadowRadius: 25,
              elevation: 8,
            }
      }
    >
      {!desktop && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="记录一个瞬间"
          onPress={() => openComposer()}
          style={({ pressed }) => ({
            position: 'absolute',
            bottom: 88,
            right: 0,
            width: 55,
            height: 55,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.accent,
            opacity: pressed ? 0.7 : 1,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.22,
            shadowRadius: 14,
            elevation: 5,
          })}
        >
          <Icon
            name="plus"
            color={theme.background === '#171821' ? '#252039' : '#FFFFFF'}
            size={28}
          />
        </Pressable>
      )}
      {desktop && (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <Image
            source={require('../../assets/brand-icon.png')}
            style={{ width: 39, height: 39, borderRadius: 14 }}
            accessibilityLabel="MoodTracker"
          />
          <View>
            <Label style={{ fontSize: 20, fontWeight: '700', letterSpacing: -0.6 }}>
              moodtracker<Label style={{ color: theme.accent, fontSize: 20 }}>.</Label>
            </Label>
            <Label muted style={{ fontSize: 10, letterSpacing: 3 }}>
              心 情 日 记
            </Label>
          </View>
        </View>
      )}
      <View style={{ flexDirection: desktop ? 'column' : 'row', gap: desktop ? 10 : 3 }}>
        {state.routes.map((route, index) => {
          const active = state.index === index;
          const item = items[route.name];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) {
                  feedback();
                  navigation.navigate(route.name);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed, hovered }) => ({
                flex: desktop ? undefined : 1,
                minHeight: desktop ? 50 : 57,
                flexDirection: desktop ? 'row' : 'column',
                gap: desktop ? 13 : 4,
                paddingHorizontal: desktop ? 15 : 0,
                justifyContent: desktop ? 'flex-start' : 'center',
                alignItems: 'center',
                borderRadius: desktop ? 14 : 18,
                backgroundColor: active ? theme.accentSoft : hovered ? theme.subtle : 'transparent',
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Icon
                name={item.icon}
                color={active ? theme.accentText : theme.secondary}
                size={desktop ? 21 : 23}
              />
              <Label
                style={{
                  color: active ? theme.accentText : theme.secondary,
                  fontWeight: active ? '600' : '400',
                  fontSize: desktop ? 14 : 10,
                }}
              >
                {desktop ? item.label : item.short}
              </Label>
            </Pressable>
          );
        })}
      </View>
      {desktop && (
        <>
          <Button onPress={() => openComposer()} icon="plus">
            记录一个瞬间
          </Button>
          <View style={{ flex: 1 }} />
          {height >= 800 && (
            <View style={{ gap: 10, paddingHorizontal: 10, paddingBottom: 24 }}>
              <Icon name="leaf" size={25} color={theme.accentText} />
              <Label style={{ fontSize: 14, lineHeight: 24 }}>和每一种心情，{'\n'}好好相处。</Label>
              <Label muted style={{ fontSize: 10, letterSpacing: 1 }}>
                GROW AT YOUR OWN PACE
              </Label>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开我的空间"
            onPress={() => navigation.navigate('settings')}
            style={{
              borderTopWidth: 1,
              borderTopColor: theme.border,
              paddingTop: 20,
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: theme.subtle,
                width: 35,
                height: 35,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="account-outline" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Label numberOfLines={1} style={{ fontSize: 12, fontWeight: '600' }}>
                {settings.name || '我的心情空间'}
              </Label>
              <Label muted style={{ fontSize: 10 }}>
                本地保存 · 只属于你
              </Label>
            </View>
            <Icon name="chevron-right" size={16} />
          </Pressable>
        </>
      )}
    </View>
  );
}
