import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const plugin = require('../plugins/with-plain-splash.js');
const {
  getTemplateAsync,
} = require('@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/withIosSplashScreenStoryboard');
const {
  removeImageFromSplashScreen,
} = require('@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/InterfaceBuilder');

test('an image-free Expo storyboard uses adaptive background color and has no dangling image references', async () => {
  const source = await getTemplateAsync();
  const view = source.document.scenes[0].scene[0].objects[0].viewController[0].view[0];
  view.color = [{ $: { key: 'backgroundColor', systemColor: 'systemBackgroundColor' } }];
  removeImageFromSplashScreen(source, { imageName: 'SplashScreenLogo' });
  // Reproduce the SDK template IDs which the normal removal path does not clean up.
  assert.ok(view.constraints[0].constraint.length);
  plugin.applyPlainSplash(source, '#F4F5FB');
  assert.equal(view.subviews[0].imageView.length, 0);
  assert.equal(view.constraints[0].constraint.length, 0);
  assert.deepEqual(view.color, [{ $: { key: 'backgroundColor', name: 'SplashScreenBackground' } }]);
  assert.equal(source.document.resources[0].image.length, 0);
  assert.equal(source.document.resources[0].namedColor[0].color[0].$.red, 244 / 255);
  assert.deepEqual(plugin.applyPlainSplash(structuredClone(source), '#F4F5FB'), source);
});

test('adding an approved image later leaves Expo in charge of its image storyboard', () => {
  const config = {
    plugins: [['expo-splash-screen', { image: './approved-mark.png', backgroundColor: '#F4F5FB' }]],
  };
  assert.equal(plugin(config), config);
});
