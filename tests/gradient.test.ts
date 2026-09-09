import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

// Exercise the production component on the native branch without replacing it
// with react-native-web's different percentage/layout behavior.
const source = readFileSync(new URL('../src/components/effects.tsx', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'tsx', format: 'cjs', jsx: 'transform' });
type Element = { type: string; props: Record<string, any> };
function fixture(platform: string) {
  let size: unknown = null;
  const react = {
    createElement: (type: string, props: object, ...children: unknown[]) => ({
      type,
      props: { ...props, children },
    }),
    useRef: (current: unknown) => ({ current }),
    useState: () => [
      size,
      (update: (current: unknown) => unknown) => {
        size = update(size);
      },
    ],
  };
  const modules: Record<string, unknown> = {
    react,
    'react-native': {
      Platform: { OS: platform },
      View: 'View',
      StyleSheet: { absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } },
    },
    'react-native-svg': {
      __esModule: true,
      default: 'Svg',
      Defs: 'Defs',
      LinearGradient: 'LinearGradient',
      Rect: 'Rect',
      Stop: 'Stop',
    },
  };
  const module = { exports: {} as { Gradient: (props: object) => Element } };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name: string) => modules[name] ?? {},
  });
  const render = () =>
    module.exports.Gradient({
      colors: ['#6C63DF', '#9D8BFF'],
      style: { paddingVertical: 11, paddingHorizontal: 18, flexDirection: 'row' },
      children: '继续',
    });
  return { render, size: () => size };
}

test('native gradient starts with a visible fallback and keeps background out of the text row', () => {
  const { render } = fixture('ios');
  const root = render();
  const background = root.props.children[0] as Element;
  assert.equal(background.type, 'View');
  assert.equal(background.props.pointerEvents, 'none');
  assert.equal(background.props.style[0].position, 'absolute');
  assert.equal(background.props.style[1].backgroundColor, '#6C63DF');
  assert.equal(root.props.children[1], '继续');
});

test('native SVG uses measured outer bounds, updates on resize and reuses identical layouts', () => {
  const app = fixture('ios');
  const layout = (width: number, height: number) =>
    app.render().props.onLayout({ nativeEvent: { layout: { width, height } } });
  layout(354, 44);
  const background = app.render().props.children[0] as Element;
  const svg = background.props.children[0] as Element;
  assert.equal(svg.type, 'Svg');
  assert.equal(svg.props.width, 354);
  assert.equal(svg.props.height, 44);
  const size = app.size();
  layout(354, 44);
  assert.equal(app.size(), size, 'unchanged layout must not cause another render');
  layout(228, 64);
  const resized = app.render().props.children[0].props.children[0] as Element;
  assert.equal(resized.props.width, 228);
  assert.equal(resized.props.height, 64);
});

test('web gradient retains immediate percentage sizing without native measurement', () => {
  const root = fixture('web').render();
  assert.equal(root.props.onLayout, undefined);
  const svg = root.props.children[0].props.children[0] as Element;
  assert.equal(svg.type, 'Svg');
  assert.equal(svg.props.width, '100%');
  assert.equal(svg.props.height, '100%');
});
