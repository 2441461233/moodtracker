import React, { useState, type PropsWithChildren } from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TodayScreen from '../../src/screens/TodayScreen';
import CalendarScreen from '../../src/screens/CalendarScreen';
import InsightsScreen from '../../src/screens/InsightsScreen';
import { ThemeContext, lightTheme } from '../../src/theme';
import { FixtureContext, type FixtureScreen, type FixtureState } from './fixture-context';
import { FIXTURE_CASES, FIXTURE_NOW, type FixtureCase } from './fixtures';

class FixtureErrorBoundary extends React.Component<PropsWithChildren, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div role="alert" style={{ padding: 24, color: '#a51e36' }}>
        隔离夹具渲染失败：{this.state.error}
      </div>
    ) : (
      this.props.children
    );
  }
}

function initialCase(): FixtureCase {
  const value = new URLSearchParams(window.location.search).get('case');
  return value && Object.prototype.hasOwnProperty.call(FIXTURE_CASES, value)
    ? (value as FixtureCase)
    : 'mixed';
}
function initialScreen(): FixtureScreen {
  const value = new URLSearchParams(window.location.search).get('screen');
  return value === 'calendar' || value === 'insights' ? value : 'today';
}

function FixtureApp() {
  const embedded = new URLSearchParams(window.location.search).get('embedded') === '1';
  const [caseId, setCase] = useState<FixtureCase>(initialCase);
  const [screen, setScreen] = useState<FixtureScreen>(initialScreen);
  const [viewport, setViewport] = useState<'320' | '390' | 'desktop'>(() => {
    const value = new URLSearchParams(window.location.search).get('viewport');
    return value === '320' || value === 'desktop' ? value : '390';
  });
  const [params, setParams] = useState<Record<string, unknown> | undefined>();
  const [action, setAction] = useState('');
  const fixture = FIXTURE_CASES[caseId];
  const blockMutation = async () => {
    throw new Error('隔离测试：保存、删除、导入和导出均被禁用。');
  };
  const navigate = (name: string, nextParams?: Record<string, unknown>) => {
    if (name === 'today' || name === 'calendar' || name === 'insights') {
      setScreen(name);
      setParams(nextParams);
      setAction('');
    } else setAction(`测试导航：${name}。夹具不打开真实系统权限、账户或保存界面。`);
  };
  const state: FixtureState = {
    screen,
    params,
    navigate,
    mood: {
      entries: [...fixture.entries],
      settings: { name: '合成测试', theme: 'light', haptics: false },
      ready: true,
      storageError: null,
      now: FIXTURE_NOW,
      composer: null,
      detail: null,
      breathing: false,
      toast: null,
      openComposer: () => setAction('隔离测试：记录入口已触发，但不创建、不保存任何记录。'),
      closeComposer: () => undefined,
      openDetail: (entry) =>
        setAction(entry ? `合成本地详情：${entry.id}。Apple行不应触发这个入口。` : ''),
      setBreathing: () => setAction('隔离测试：呼吸入口已触发。'),
      persistEntry: blockMutation,
      removeEntry: blockMutation,
      updateSettings: blockMutation,
      importEntries: blockMutation,
      notify: setAction,
      reload: async () => undefined,
      feedback: () => undefined,
    },
    health: {
      availability: { available: true, reason: 'available' },
      enabled: fixture.enabled,
      loading: false,
      busy: caseId === 'not-read',
      status: !fixture.enabled ? 'off' : caseId === 'not-read' ? 'syncing' : 'idle',
      backgroundDelivery: fixture.enabled ? 'enabled' : 'disabled',
      error: null,
      writeAuthorization: 'authorized',
      lastReadAt: fixture.hasRead ? FIXTURE_NOW.getTime() : null,
      lastWriteAt: null,
      records: [...fixture.samples],
      hasRead: fixture.hasRead,
      readTruncated: false,
      enable: async () => setAction('隔离测试：不会调用健康授权。请使用顶部案例按钮切换状态。'),
      disable: async () => setCase('disconnected'),
      retry: () => setAction('隔离测试：不会请求真实健康数据。'),
    },
  };
  const Screen =
    screen === 'calendar' ? CalendarScreen : screen === 'insights' ? InsightsScreen : TodayScreen;
  return (
    <FixtureContext.Provider value={state}>
      <ThemeContext.Provider value={lightTheme}>
        <div className="fixture-shell">
          <header className="fixture-controls">
            <strong>隔离测试 · 合成样本 · 不访问健康 / 不保存数据</strong>
            <small>
              真实三屏与业务模型 · 仅上下文、导航和图标替换 · 固定日期 2026-09-03 · 非真机验证
            </small>
            {!embedded && (
              <>
                <nav aria-label="测试案例" className="fixture-buttons">
                  {(Object.keys(FIXTURE_CASES) as FixtureCase[]).map((id) => (
                    <button
                      key={id}
                      aria-pressed={id === caseId}
                      onClick={() => {
                        setCase(id);
                        setParams(undefined);
                        setAction('');
                      }}
                    >
                      {FIXTURE_CASES[id].label}
                    </button>
                  ))}
                </nav>
                <nav aria-label="测试屏幕" className="fixture-buttons">
                  {(
                    [
                      ['today', '今日'],
                      ['calendar', '日历'],
                      ['insights', '回顾'],
                    ] as const
                  ).map(([id, title]) => (
                    <button key={id} aria-pressed={id === screen} onClick={() => navigate(id)}>
                      {title}
                    </button>
                  ))}
                </nav>
                <nav aria-label="真实 iframe 视口" className="fixture-buttons">
                  {(
                    [
                      ['320', '320 px'],
                      ['390', '390 px'],
                      ['desktop', '桌面 1180 px'],
                    ] as const
                  ).map(([id, title]) => (
                    <button key={id} aria-pressed={id === viewport} onClick={() => setViewport(id)}>
                      {title}
                    </button>
                  ))}
                </nav>
                <details>
                  <summary>当前案例的独立预期</summary>
                  <p>{fixture.expectation}</p>
                </details>
              </>
            )}
            {action && <div role="status">{action}</div>}
          </header>
          {embedded ? (
            <main className="fixture-screen" aria-label="真实业务屏幕">
              <FixtureErrorBoundary key={`${caseId}-${screen}`}>
                <SafeAreaProvider
                  initialMetrics={{
                    frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
                    insets: { top: 0, right: 0, bottom: 0, left: 0 },
                  }}
                >
                  <View style={{ flex: 1, backgroundColor: lightTheme.background }}>
                    <Screen />
                  </View>
                </SafeAreaProvider>
              </FixtureErrorBoundary>
            </main>
          ) : (
            <main
              style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}
              aria-label="指定尺寸的隔离视口"
            >
              <div
                style={{
                  width: viewport === 'desktop' ? 1180 : Number(viewport),
                  margin: '0 auto',
                  border: '1px solid #d5c8a2',
                  background: '#fff',
                }}
              >
                <iframe
                  title={`真实业务屏幕 ${viewport} 像素`}
                  src={`/?embedded=1&case=${encodeURIComponent(caseId)}&screen=${screen}`}
                  width={viewport === 'desktop' ? 1180 : Number(viewport)}
                  height={800}
                  style={{ display: 'block', border: 0 }}
                />
              </div>
            </main>
          )}
        </div>
      </ThemeContext.Provider>
    </FixtureContext.Provider>
  );
}

createRoot(document.getElementById('fixture-root')!).render(<FixtureApp />);
