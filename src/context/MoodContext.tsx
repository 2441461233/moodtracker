import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { cancelVoiceJob, flushVoiceJob, resumeVoiceJobs, subscribeVoiceJobs } from '../voice/jobs';
import { removeRecording } from '../voice/files';

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
  openComposer: (request?: ComposerRequest, options?: { preserveDraft?: boolean }) => void;
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
type MoodData = Pick<MoodContextValue, 'entries' | 'settings' | 'ready' | 'storageError'>;
type MoodOverlays = Pick<MoodContextValue, 'composer' | 'detail' | 'breathing'>;
type MoodActions = Omit<MoodContextValue, keyof MoodData | keyof MoodOverlays | 'now' | 'toast'>;
const DataContext = createContext<MoodData | null>(null);
const ActionsContext = createContext<MoodActions | null>(null);
const OverlaysContext = createContext<MoodOverlays | null>(null);
const ClockContext = createContext<Date | null>(null);
const ToastContext = createContext<string | null>(null);
function required<T>(value: T | null): T {
  if (value === null) throw new Error('MoodProvider is required');
  return value;
}
// Subscribe only to the state a component renders. Opening a sheet or announcing a
// toast must not invalidate the journal, charts, navigation or health snapshot.
export function useMoodData() {
  return required(useContext(DataContext));
}
export function useMoodActions() {
  return required(useContext(ActionsContext));
}
export function useMoodOverlays() {
  return required(useContext(OverlaysContext));
}
export function useMoodClock() {
  return required(useContext(ClockContext));
}
export function useMoodToast() {
  return useContext(ToastContext);
}
/** Compatibility hook for isolated fixtures; app components use scoped subscriptions. */
export function useMood(): MoodContextValue {
  return {
    ...useMoodData(),
    ...useMoodActions(),
    ...useMoodOverlays(),
    now: useMoodClock(),
    toast: useMoodToast(),
  };
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
  const composerRef = useRef(composer);
  composerRef.current = composer;
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
      setSettings((current) =>
        current.name === prefs.name &&
        current.theme === prefs.theme &&
        current.haptics === prefs.haptics
          ? current
          : prefs,
      );
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
    const clock = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const next = new Date();
      // Screens only display the day and hourly greeting. The composer takes its
      // own precise timestamp when opened, without waking every mounted screen.
      setNow((current) =>
        current.toDateString() === next.toDateString() && current.getHours() === next.getHours()
          ? current
          : next,
      );
    }, 30000);
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
  useEffect(
    () =>
      subscribeVoiceJobs(() => {
        void reload();
      }),
    [reload],
  );
  useEffect(() => {
    if (ready && !storageError) resumeVoiceJobs(entries);
  }, [entries, ready, storageError]);
  const feedback = useCallback(
    (success = false) => {
      if (!settings.haptics || Platform.OS === 'web') return;
      void (
        success
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.selectionAsync()
      ).catch(() => undefined);
    },
    [settings.haptics],
  );
  const actions = useMemo<MoodActions>(
    () => ({
      notify,
      reload,
      feedback,
      openComposer: (request = {}, options) => {
        setComposer((current) => (options?.preserveDraft && current ? current : request));
        feedback();
      },
      closeComposer: () => setComposer(null),
      openDetail: setDetail,
      setBreathing,
      persistEntry: async (entry, editing) => {
        setEntries(
          await (editing
            ? moodStorage.update(entry, composerRef.current?.entry)
            : moodStorage.save(entry)),
        );
        // The entry is already committed. A later transcript write must never
        // report that save as failed and invite a duplicate submission.
        if (entry.voice) {
          try {
            setEntries(await flushVoiceJob(entry.voice.id));
          } catch {
            /* retry from retained job */
          }
        }
        feedback(true);
        notify(editing ? '修改已保存，每一种感受都值得被记录。' : '已记录这一刻，谢谢你照顾自己。');
      },
      removeEntry: async (id, expected) => {
        const before = (await moodStorage.read()).find((entry) => entry.id === id);
        setEntries(await moodStorage.remove(id, expected));
        if (before?.voice) {
          cancelVoiceJob(before.voice.id);
          void removeRecording(before.voice).catch(() => undefined);
        }
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
    }),
    [feedback, notify, reload],
  );
  const data = useMemo(
    () => ({ entries, settings, ready, storageError }),
    [entries, settings, ready, storageError],
  );
  const overlays = useMemo(() => ({ composer, detail, breathing }), [composer, detail, breathing]);
  return (
    <DataContext.Provider value={data}>
      <ActionsContext.Provider value={actions}>
        <ClockContext.Provider value={now}>
          <OverlaysContext.Provider value={overlays}>
            <ToastContext.Provider value={toast}>
              <ThemeContext.Provider value={isDark ? darkTheme : lightTheme}>
                <HealthSyncProvider entries={entries} ready={ready && !storageError}>
                  {children}
                </HealthSyncProvider>
              </ThemeContext.Provider>
            </ToastContext.Provider>
          </OverlaysContext.Provider>
        </ClockContext.Provider>
      </ActionsContext.Provider>
    </DataContext.Provider>
  );
}
