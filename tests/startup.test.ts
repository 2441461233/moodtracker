import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

// Exercise the actual app branches without loading native services or personal storage.
const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const { code } = transformSync(`${source}\nexport { AppContent, RecoveryScreen };`, {
  loader: 'tsx',
  format: 'cjs',
  jsx: 'transform',
});

interface Element {
  type: string | ((props: Record<string, unknown>) => Element);
  props: { onLayout?: () => void; [key: string]: unknown };
}

function launch(platform = 'ios') {
  const calls: string[] = [];
  const mood = {
    ready: false,
    storageError: null as string | null,
    composer: null,
    detail: null,
    breathing: false,
    toast: null,
  };
  const react = {
    createElement(type: Element['type'], props: Element['props'] | null, ...children: Element[]) {
      return { type, props: { ...props, children } };
    },
    useState: (value: unknown) => [value, () => undefined],
  };
  const modules: Record<string, unknown> = {
    react,
    'react-native': { Platform: { OS: platform }, View: 'View', ActivityIndicator: 'Spinner' },
    'expo-splash-screen': {
      preventAutoHideAsync: async () => {
        calls.push('hold');
      },
      hideAsync: async () => {
        calls.push('hide');
      },
    },
    '@react-navigation/native': {
      NavigationContainer: 'NavigationContainer',
      DefaultTheme: { colors: {} },
      DarkTheme: { colors: {} },
    },
    '@react-navigation/bottom-tabs': {
      createBottomTabNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }),
    },
    'react-native-screens': { enableScreens: () => undefined },
    './src/context/MoodContext': { useMood: () => mood },
    './src/theme': {
      useTheme: () => ({ dark: true, background: '#0B0D18' }),
      useLayout: () => ({ desktop: false }),
    },
  };
  const module = { exports: {} as { AppContent: () => Element | null } };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name: string) => modules[name] ?? {},
  });
  return { calls, mood, render: module.exports.AppContent };
}

test('native launch stays covered through data loading and releases after the ready screen lays out', () => {
  const app = launch();
  assert.deepEqual(app.calls, ['hold']);
  assert.equal(app.render(), null);
  assert.deepEqual(app.calls, ['hold']);
  app.mood.ready = true;
  const screen = app.render()!;
  assert.equal(screen.type, 'View');
  assert.deepEqual(app.calls, ['hold']);
  screen.props.onLayout!();
  assert.deepEqual(app.calls, ['hold', 'hide']);
});

test('storage failure reveals the recovery screen instead of trapping the app behind the splash', () => {
  const app = launch();
  app.mood.ready = true;
  app.mood.storageError = 'Storage is unavailable';
  const recovery = app.render()!;
  assert.equal(typeof recovery.type, 'function');
  const screen = (recovery.type as (props: Element['props']) => Element)(recovery.props);
  assert.equal(screen.type, 'View');
  assert.deepEqual(app.calls, ['hold']);
  screen.props.onLayout!();
  assert.deepEqual(app.calls, ['hold', 'hide']);
});

test('web keeps its loading view and never calls native splash APIs', () => {
  const app = launch('web');
  assert.equal(app.render()!.type, 'View');
  app.mood.ready = true;
  app.render()!.props.onLayout!();
  assert.deepEqual(app.calls, []);
});
