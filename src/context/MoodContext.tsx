import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, AppState, Platform, useColorScheme } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppSettings, MoodEntry, EmotionId } from '../types';
import { moodStorage } from '../storage';
import { DEFAULT_SETTINGS } from '../storage/core';
import { darkTheme, lightTheme, ThemeContext } from '../theme';
import { HealthSyncProvider } from './HealthSyncContext';

export interface ComposerRequest {
  emotionId?: EmotionId;
  date?: Date;
  entry?: MoodEntry;
}
interface MoodContextValue {
  entries: MoodEntry[];
  settings: AppSettings;
  ready: boolean;
  storageError: string | null;
  now: Date;
  composer: ComposerRequest | null;
  detail: MoodEntry | null;
  breathing: boolean;
  toast: string | null;
  openComposer: (request?: ComposerRequest) => void;
  closeComposer: () => void;
  openDetail: (entry: MoodEntry | null) => void;
  setBreathing: (value: boolean) => void;
  persistEntry: (entry: MoodEntry, editing: boolean) => Promise<void>;
  removeEntry: (id: string, expected?: MoodEntry) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  importEntries: (entries: MoodEntry[]) => Promise<{ added: number; skipped: number }>;
  notify: (message: string) => void;
  reload: () => Promise<void>;
  feedback: (success?: boolean) => void;
}
const MoodContext = createContext<MoodContextValue | null>(null);
export function useMood() {
  const value = useContext(MoodContext);
  if (!value) throw new Error('MoodProvider is required');
  return value;
}

export function MoodProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerRequest | null>(null);
  const [detail, setDetail] = useState<MoodEntry | null>(null);
  const [breathing, setBreathing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const systemScheme = useColorScheme();
  const isDark =
    settings.theme === 'dark' || (settings.theme === 'system' && systemScheme === 'dark');
  const notify = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);
  const reload = useCallback(async () => {
    try {
      const [saved, prefs] = await Promise.all([moodStorage.read(), moodStorage.settings()]);
      setEntries(saved);
      setSettings(prefs);
      setStorageError(null);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : '暂时无法读取本地记录，请稍后重试。',
      );
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    void reload();
    const clock = setInterval(() => setNow(new Date()), 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(new Date());
        void reload();
      }
    });
    return () => {
      clearInterval(clock);
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reload]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onStorage = () => {
      void reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reload]);
  const feedback = (success = false) => {
    if (!settings.haptics || Platform.OS === 'web') return;
    void (
      success
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.selectionAsync()
    ).catch(() => undefined);
  };
  const value: MoodContextValue = {
    entries,
    settings,
    ready,
    storageError,
    now,
    composer,
    detail,
    breathing,
    toast,
    notify,
    reload,
    feedback,
    openComposer: (request = {}) => {
      setComposer(request);
      feedback();
    },
    closeComposer: () => setComposer(null),
    openDetail: setDetail,
    setBreathing,
    persistEntry: async (entry, editing) => {
      setEntries(
        await (editing ? moodStorage.update(entry, composer?.entry) : moodStorage.save(entry)),
      );
      feedback(true);
      notify(editing ? '修改已保存，每一种感受都值得被记录。' : '已记录这一刻，谢谢你照顾自己。');
    },
    removeEntry: async (id, expected) => {
      setEntries(await moodStorage.remove(id, expected));
      notify('这条记录已删除。');
    },
    updateSettings: async (next) => {
      await moodStorage.saveSettings(next);
      setSettings(next);
    },
    importEntries: async (incoming) => {
      const result = await moodStorage.merge(incoming);
      setEntries(result.entries);
      return result;
    },
  };
  return (
    <MoodContext.Provider value={value}>
      <ThemeContext.Provider value={isDark ? darkTheme : lightTheme}>
        <HealthSyncProvider entries={entries} ready={ready && !storageError}>
          {children}
        </HealthSyncProvider>
      </ThemeContext.Provider>
    </MoodContext.Provider>
  );
}
