import React, { memo, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import TodayScreen from './src/screens/TodayScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {
  MoodProvider,
  useMoodData,
  useMoodActions,
  useMoodOverlays,
  useMoodToast,
} from './src/context/MoodContext';
import { useTheme, useLayout } from './src/theme';
import { Navigation } from './src/components/Navigation';
import { AmbientBackground } from './src/components/effects';
import { EntryComposer } from './src/components/EntryComposer';
import { EntryDetail } from './src/components/EntryDetail';
import { BreathingExercise } from './src/components/BreathingExercise';
import { Button, Card, EmptyState, Icon, Label } from './src/components/ui';
import { moodStorage } from './src/storage';
import { exportText } from './src/lib/transfer';
import { QuickRecordProvider } from './src/context/QuickRecordContext';
import { navigationRef } from './src/lib/navigation';

// Keep the native launch screen visible until the first usable screen has laid out.
if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

function hideNativeSplash() {
  if (Platform.OS !== 'web') {
    void SplashScreen.hideAsync().catch(() => undefined);
  }
}

// Web defaults to plain Views; enable screen detachment so transparent tabs cannot overlap.
enableScreens();

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <MoodProvider>
        <QuickRecordProvider>
          <AppContent />
        </QuickRecordProvider>
      </MoodProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const theme = useTheme();
  const { ready, storageError } = useMoodData();
  // Native keeps the system splash here, so saved appearance is applied before it disappears.
  if (!ready && Platform.OS !== 'web') return null;
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 15,
        }}
      >
        <ActivityIndicator color={theme.accent} />
        <Label muted>正在打开你的心情空间…</Label>
      </View>
    );
  if (storageError) return <RecoveryScreen message={storageError} />;
  return (
    <View onLayout={hideNativeSplash} style={{ flex: 1, backgroundColor: theme.background }}>
      <AppBackground />
      <AppNavigator />
      <AppOverlays />
      <Toast />
    </View>
  );
}

const AppNavigator = memo(function AppNavigator() {
  const theme = useTheme();
  const { desktop } = useLayout();
  const dark = theme.dark;
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        ...(dark ? DarkTheme : DefaultTheme),
        colors: {
          ...(dark ? DarkTheme : DefaultTheme).colors,
          background: theme.background,
          card: theme.surface,
          text: theme.text,
          primary: theme.accent,
          border: theme.border,
        },
      }}
    >
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Tab.Navigator
        detachInactiveScreens
        tabBar={(props) => <Navigation {...props} />}
        screenOptions={{
          headerShown: false,
          freezeOnBlur: Platform.OS !== 'web',
          tabBarPosition: desktop ? 'left' : 'bottom',
          animation: 'none',
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tab.Screen
          name="today"
          component={TodayScreen}
          options={{ title: '今日心情 · 情绪像素' }}
        />
        <Tab.Screen
          name="calendar"
          component={CalendarScreen}
          options={{ title: '情绪记录 · 情绪像素' }}
        />
        <Tab.Screen
          name="insights"
          component={InsightsScreen}
          options={{ title: '情绪洞察 · 情绪像素' }}
        />
        <Tab.Screen
          name="settings"
          component={SettingsScreen}
          options={{ title: '我的空间 · 情绪像素' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
});

const AppBackground = memo(function AppBackground() {
  const { composer, detail, breathing } = useMoodOverlays();
  return <AmbientBackground paused={!!composer || !!detail || breathing} />;
});

const AppOverlays = memo(function AppOverlays() {
  const { composer, detail, breathing } = useMoodOverlays();
  return (
    <>
      {composer && <EntryComposer />}
      {detail && <EntryDetail />}
      {breathing && <BreathingExercise />}
    </>
  );
});

const Toast = memo(function Toast() {
  const toast = useMoodToast();
  const theme = useTheme();
  const { desktop } = useLayout();
  return (
    <>
      {toast && (
        <View
          pointerEvents="none"
          accessibilityRole="alert"
          style={{
            position: 'absolute',
            bottom: desktop ? 28 : 104,
            alignSelf: 'center',
            maxWidth: '90%',
            paddingVertical: 13,
            paddingHorizontal: 21,
            borderRadius: 16,
            backgroundColor: theme.text,
            flexDirection: 'row',
            gap: 9,
            alignItems: 'center',
          }}
        >
          <Icon name="check-circle-outline" size={19} color={theme.surface} />
          <Label style={{ color: theme.surface, fontSize: 12, flexShrink: 1 }}>{toast}</Label>
        </View>
      )}
    </>
  );
});

function RecoveryScreen({ message }: { message: string }) {
  const theme = useTheme();
  const { reload } = useMoodActions();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const recover = async () => {
    setBusy(true);
    setStatus('');
    try {
      const raw = await moodStorage.raw();
      if (raw === null) throw new Error('未找到原始数据。请先检查当前浏览器的存储权限。');
      await exportText(raw, 'moodtracker-recovery.json');
      setStatus('已发起导出。请先保存这个原始文件，保留恢复的可能。');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : '无法导出原始文件，请检查浏览器存储权限。',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      onLayout={hideNativeSplash}
      style={{
        flex: 1,
        backgroundColor: theme.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ maxWidth: 520 }}>
        <EmptyState
          icon="shield-alert-outline"
          title="先好好保护你的记录"
          description={message}
          action="重新读取"
          onAction={() => {
            void reload();
          }}
        />
        <Button icon="download-outline" kind="secondary" busy={busy} onPress={recover}>
          导出原始备份
        </Button>
        {!!status && (
          <Label accessibilityRole="alert" style={{ fontSize: 12, lineHeight: 22, marginTop: 15 }}>
            {status}
          </Label>
        )}
      </Card>
    </View>
  );
}
