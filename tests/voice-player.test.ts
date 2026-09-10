import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(
  process.env.VOICE_PLAYER_TEST_SOURCE ||
    new URL('../src/components/VoicePlayer.tsx', import.meta.url),
  'utf8',
);
const { code } = transformSync(source, { loader: 'tsx', format: 'cjs', jsx: 'transform' });
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
type Element = { type: unknown; props: Record<string, any> };
function find(root: Element, id: string): Element | undefined {
  if (root.props?.testID === id) return root;
  for (const child of [root.props?.children].flat(Infinity)) {
    if (child && typeof child === 'object') {
      const match = find(child as Element, id);
      if (match) return match;
    }
  }
}
function fixture(
  options: {
    failCreate?: boolean;
    delayedFile?: boolean;
    delayedMode?: boolean;
    ended?: boolean;
    delayedSeek?: boolean;
  } = {},
) {
  const events: string[] = [];
  const effects: (() => undefined | (() => void))[] = [];
  const cleanups: (() => void)[] = [];
  const states: any[] = [];
  const refs: { current: any }[] = [];
  let stateIndex = 0;
  let refIndex = 0;
  let mounted = false;
  let rendered = false;
  const file = deferred<{ uri: string; release(): void }>();
  const mode = deferred<void>();
  const seek = deferred<void>();
  const audio = {
    uri: 'file:///retained/voice-test.m4a',
    release: () => events.push('source-release'),
  };
  let released = false;
  let playing = false;
  const status = () => ({
    playing,
    currentTime: options.ended ? 3 : 0,
    duration: 3,
    didJustFinish: !!options.ended,
  });
  const alive = () => {
    if (released) throw new Error('Native shared object already released');
  };
  const player = {
    get playing() {
      alive();
      return playing;
    },
    get duration() {
      alive();
      return 3;
    },
    get currentTime() {
      alive();
      return options.ended ? 3 : 0;
    },
    get currentStatus() {
      alive();
      return status();
    },
    replace() {
      alive();
      events.push('replace');
    },
    pause() {
      alive();
      playing = false;
      events.push('pause');
    },
    play() {
      alive();
      playing = true;
      events.push('play');
    },
    seekTo() {
      alive();
      events.push('seek');
      return options.delayedSeek ? seek.promise : Promise.resolve();
    },
    addListener() {
      alive();
      events.push('subscribe');
      return { remove: () => events.push('unsubscribe') };
    },
    release() {
      alive();
      released = true;
      events.push('release');
    },
  };
  const create = (uri: string | null) => {
    events.push(`create:${uri}`);
    if (options.failCreate) throw new Error('Native player initialization failed');
    return player;
  };
  const react = {
    createElement: (type: unknown, props: object, ...children: unknown[]) => ({
      type,
      props: { ...props, children },
    }),
    useRef: (value: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: value }),
    useState: (value: unknown) => {
      const index = stateIndex++;
      if (!rendered) states[index] = value;
      return [
        states[index],
        (next: unknown) => {
          assert.ok(mounted, 'No updates after unmount');
          states[index] = next;
        },
      ];
    },
    useEffect: (effect: () => undefined | (() => void)) => {
      if (!rendered) effects.push(effect);
    },
  };
  const modules: Record<string, unknown> = {
    react,
    'react-native': { View: 'View', AppState: { addEventListener: () => ({ remove() {} }) } },
    'expo-audio': {
      createAudioPlayer: create,
      // Match Expo's documented release hook ordering for the pre-fix component.
      useAudioPlayer: () => {
        const value = create(null);
        react.useEffect(() => () => value.release());
        return value;
      },
      useAudioPlayerStatus: status,
      setAudioModeAsync: () => (options.delayedMode ? mode.promise : Promise.resolve()),
    },
    '../theme': { useTheme: () => ({ border: '#ccc', secondary: '#666' }) },
    './ui': { Button: 'Button', Label: 'Label' },
    '../voice/files': {
      playbackSource: () => (options.delayedFile ? file.promise : Promise.resolve(audio)),
      shareRecording: async () => {},
    },
    '../voice/core': { formatDuration: () => '00:03' },
    '../voice/audio-session': {
      setPlaybackAudioMode: () => (options.delayedMode ? mode.promise : Promise.resolve()),
    },
  };
  const module = { exports: {} as { VoicePlayer: (props: object) => Element } };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency ${name}`);
      return modules[name];
    },
  });
  function render() {
    stateIndex = refIndex = 0;
    const tree = module.exports.VoicePlayer({
      voice: { id: 'voice-test', fileName: 'voice-test.m4a', durationMs: 3000 },
    });
    rendered = true;
    return tree;
  }
  return {
    events,
    states,
    render,
    mount() {
      mounted = true;
      const tree = render();
      for (const effect of effects) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      }
      return tree;
    },
    unmount() {
      mounted = false;
      cleanups.forEach((cleanup) => cleanup());
    },
    resolveFile() {
      file.resolve(audio);
    },
    resolveMode() {
      mode.resolve();
    },
    resolveSeek() {
      seek.resolve();
    },
    play() {
      find(render(), 'voice-play')!.props.onPress();
    },
  };
}

test('retained audio is resolved before a native player is created', async () => {
  const app = fixture({ delayedFile: true });
  app.mount();
  assert.equal(app.events.length, 0);
  app.resolveFile();
  await tick();
  assert.equal(app.events[0], 'create:file:///retained/voice-test.m4a');
  assert.equal(find(app.render(), 'voice-play')!.props.disabled, false);
  app.unmount();
});

test('closing playback stops and unsubscribes before releasing the native object once', async () => {
  const app = fixture();
  app.mount();
  await tick();
  app.play();
  await tick();
  assert.ok(app.events.includes('play'));
  assert.doesNotThrow(() => app.unmount());
  assert.deepEqual(app.events.slice(-4), ['unsubscribe', 'pause', 'release', 'source-release']);
});

test('leaving before file resolution releases the file without creating a player', async () => {
  const app = fixture({ delayedFile: true });
  app.mount();
  app.unmount();
  app.resolveFile();
  await tick();
  assert.deepEqual(app.events, ['source-release']);
});

test('native player setup failure remains recoverable and preserves the original for export', async () => {
  const app = fixture({ failCreate: true });
  assert.doesNotThrow(() => app.mount());
  await tick();
  assert.equal(find(app.render(), 'voice-play')!.props.disabled, true);
  assert.ok(
    app.states.some((value) => typeof value === 'string' && value.includes('录音记录仍然保留')),
  );
  assert.ok(app.states.includes('file:///retained/voice-test.m4a'));
  app.unmount();
});

for (const stage of ['mode', 'seek'] as const) {
  test(`leaving while awaiting ${stage} never resumes a released player`, async () => {
    const app = fixture(
      stage === 'mode' ? { delayedMode: true } : { ended: true, delayedSeek: true },
    );
    app.mount();
    await tick();
    app.play();
    await tick();
    app.unmount();
    if (stage === 'mode') app.resolveMode();
    else app.resolveSeek();
    await tick();
    assert.ok(!app.events.includes('play'));
  });
}
