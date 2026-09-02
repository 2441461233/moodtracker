import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TodayScreen from './src/screens/TodayScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { MoodProvider, useMood } from './src/context/MoodContext';
import { useTheme, useLayout } from './src/theme';
import { Navigation } from './src/components/Navigation';
import { EntryComposer } from './src/components/EntryComposer';
import { EntryDetail } from './src/components/EntryDetail';
import { BreathingExercise } from './src/components/BreathingExercise';
import { Button, Card, EmptyState, Icon, Label } from './src/components/ui';
import { moodStorage } from './src/storage';
import { exportText } from './src/lib/transfer';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <MoodProvider>
        <AppContent />
      </MoodProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const theme = useTheme();
  const { desktop } = useLayout();
  const { composer, detail, breathing, ready, toast, storageError } = useMood();
  const dark = theme.background === '#171821';
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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <NavigationContainer
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
          tabBar={(props) => <Navigation {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarPosition: desktop ? 'left' : 'bottom',
            animation: 'none',
            sceneStyle: { backgroundColor: theme.background },
          }}
        >
          <Tab.Screen
            name="today"
            component={TodayScreen}
            options={{ title: '今日心情 · MoodTracker' }}
          />
          <Tab.Screen
            name="calendar"
            component={CalendarScreen}
            options={{ title: '心情日历 · MoodTracker' }}
          />
          <Tab.Screen
            name="insights"
            component={InsightsScreen}
            options={{ title: '情绪洞察 · MoodTracker' }}
          />
          <Tab.Screen
            name="settings"
            component={SettingsScreen}
            options={{ title: '我的空间 · MoodTracker' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      {composer && <EntryComposer />}
      {detail && <EntryDetail />}
      {breathing && <BreathingExercise />}
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
    </View>
  );
}

function RecoveryScreen({ message }: { message: string }) {
  const theme = useTheme();
  const { reload } = useMood();
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
