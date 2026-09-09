import { failNextTranscription } from './voice-services';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  MoodProvider,
  useMoodActions,
  useMoodClock,
  useMoodData,
  useMoodOverlays,
  useMoodToast,
} from '../../src/context/MoodContext';
import { EntryComposer } from '../../src/components/EntryComposer';
import { EntryDetail } from '../../src/components/EntryDetail';
import { EntryList } from '../../src/components/EntryList';
import { renders } from './performance-metrics';

let actions: ReturnType<typeof useMoodActions>;
function DataProbe() {
  renders.data++;
  const { entries, ready } = useMoodData();
  const { openDetail } = useMoodActions();
  return (
    <>
      <p>
        状态：{ready ? '就绪' : '载入'} · 合成记录 {entries.length} 条
      </p>
      <EntryList entries={entries} onPress={openDetail} />
    </>
  );
}
function ActionProbe() {
  renders.actions++;
  actions = useMoodActions();
  const [result, setResult] = useState('待运行');
  const check = (value: boolean, message: string) => {
    if (!value) throw new Error(message);
  };
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 40));
  const run = async () => {
    try {
      const before = { ...renders };
      actions.notify('合成提示');
      await settle();
      check(
        renders.data === before.data &&
          renders.actions === before.actions &&
          renders.clock === before.clock &&
          renders.overlays === before.overlays,
        '提示引发了无关订阅重绘',
      );
      actions.openComposer();
      await settle();
      check(
        renders.data === before.data &&
          renders.actions === before.actions &&
          renders.clock === before.clock,
        '打开记录引发了页面/时钟重绘',
      );
      actions.closeComposer();
      await settle();
      await actions.reload();
      await settle();
      check(
        renders.data === before.data && renders.actions === before.actions,
        '未变更数据的重新读取引发了重绘',
      );
      setResult('PASS：提示、打开/关闭表单、无变化重新读取均未重绘数据/操作订阅');
    } catch (error) {
      actions.closeComposer();
      setResult(`FAIL：${String(error)}`);
    }
  };
  return (
    <>
      <button onClick={() => void run()}>运行渲染回归</button>
      <button onClick={() => actions.openComposer({ emotionId: 'good' })}>打开输入性能测试</button>
      <button onClick={failNextTranscription}>下次转写模拟失败</button>
      <p role="status">{result}</p>
    </>
  );
}
function OverlayProbe() {
  renders.overlays++;
  const { composer, detail } = useMoodOverlays();
  return composer ? <EntryComposer /> : detail ? <EntryDetail /> : null;
}
function ClockProbe() {
  renders.clock++;
  useMoodClock();
  return null;
}
function ToastProbe() {
  renders.toast++;
  return <p>{useMoodToast()}</p>;
}
function Diagnostics() {
  const [sample, setSample] = useState({ ...renders });
  useEffect(() => {
    const interval = setInterval(() => setSample({ ...renders }), 200);
    return () => clearInterval(interval);
  }, []);
  return (
    <output
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 99999,
        pointerEvents: 'none',
        background: '#fff8df',
        fontSize: 11,
      }}
    >
      渲染计数 {JSON.stringify(sample)}
    </output>
  );
}
createRoot(document.getElementById('fixture-root')!).render(
  <>
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <MoodProvider>
        <main style={{ padding: '48px 20px' }}>
          <h2>渲染性能隔离测试</h2>
          <p>
            真实 React Provider / 表单，仅内存数据与服务替身。计数来自实际渲染；不是 iPhone 帧率。
          </p>
          <DataProbe />
          <ActionProbe />
          <ClockProbe />
          <ToastProbe />
        </main>
        <OverlayProbe />
      </MoodProvider>
    </SafeAreaProvider>
    <Diagnostics />
  </>,
);
