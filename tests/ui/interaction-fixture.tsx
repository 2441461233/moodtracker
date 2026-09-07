import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EntryComposer } from '../../src/components/EntryComposer';
import { EntryDetail } from '../../src/components/EntryDetail';
import { FixtureContext, type FixtureState } from './fixture-context';
import { darkTheme, lightTheme, ThemeContext } from '../../src/theme';
import type { ComposerRequest } from '../../src/context/MoodContext';
import type { MoodEntry } from '../../src/types';

// All operations stay in React memory. This fixture never imports real storage or HealthKit.
function InteractionFixture() {
  const [composer, setComposer] = useState<ComposerRequest | null>(null);
  const [detail, setDetail] = useState<MoodEntry | null>(null);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [calls, setCalls] = useState(0);
  const [dark, setDark] = useState(false);
  const [slow, setSlow] = useState(false);
  const failNext = useRef(false);
  const now = new Date();
  const mood: FixtureState['mood'] = {
    entries,
    composer,
    detail,
    now,
    settings: { name: '隔离测试', theme: dark ? 'dark' : 'light', haptics: false },
    ready: true,
    storageError: null,
    breathing: false,
    toast: null,
    openComposer: (request = {}) => setComposer(request),
    closeComposer: () => setComposer(null),
    openDetail: setDetail,
    persistEntry: async (entry) => {
      setCalls((count) => count + 1);
      if (slow) await new Promise((resolve) => setTimeout(resolve, 8000));
      if (failNext.current) {
        failNext.current = false;
        throw new Error('模拟存储失败：输入应完整保留，请重试。');
      }
      setEntries((current) => [...current.filter((item) => item.id !== entry.id), entry]);
    },
    removeEntry: async (id) => setEntries((current) => current.filter((entry) => entry.id !== id)),
    feedback: () => undefined,
    notify: () => undefined,
    setBreathing: () => undefined,
    updateSettings: async () => undefined,
    reload: async () => undefined,
    importEntries: async () => ({ added: 0, skipped: 0 }),
  };
  const health: FixtureState['health'] = {
    availability: { available: false, reason: 'unsupported_platform' },
    enabled: false,
    loading: false,
    busy: false,
    status: 'off',
    backgroundDelivery: 'disabled',
    error: null,
    writeAuthorization: 'notDetermined',
    lastReadAt: null,
    lastWriteAt: null,
    records: [],
    hasRead: false,
    readTruncated: false,
    enable: async () => undefined,
    disable: async () => undefined,
    retry: () => undefined,
  };
  return (
    <FixtureContext.Provider value={{ mood, health, screen: 'today', navigate: () => undefined }}>
      <ThemeContext.Provider value={dark ? darkTheme : lightTheme}>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          }}
        >
          <main style={{ padding: 20 }}>
            <h2>表单交互隔离测试</h2>
            <p>仅内存合成记录；不访问日记存储或 Apple 健康。原生选择器与键盘仍需真机验证。</p>
            <div className="fixture-buttons">
              <button onClick={() => setComposer({})}>空白新建</button>
              <button onClick={() => setComposer({ emotionId: 'good' })}>首页已选心情</button>
              <button
                onClick={() => {
                  failNext.current = true;
                  setComposer({ emotionId: 'neutral' });
                }}
              >
                下一次保存失败
              </button>
              <button onClick={() => setDark(!dark)}>切换深色</button>
              <button aria-pressed={slow} onClick={() => setSlow(!slow)}>
                慢速保存 8 秒
              </button>
            </div>
            <p role="status">
              保存调用 {calls} 次 · 内存记录 {entries.length} 条
            </p>
            {entries.map((entry) => (
              <div key={entry.id}>
                <button onClick={() => setDetail(entry)}>查看合成记录</button>
                <pre style={{ whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(
                    { ...entry, localTime: new Date(entry.timestamp).toString() },
                    null,
                    2,
                  )}
                </pre>
              </div>
            ))}
          </main>
          {composer && <EntryComposer />}
          {detail && <EntryDetail />}
        </SafeAreaProvider>
      </ThemeContext.Provider>
    </FixtureContext.Provider>
  );
}

createRoot(document.getElementById('fixture-root')!).render(<InteractionFixture />);
