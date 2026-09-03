import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { URL } from 'node:url';

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const moduleConfig = JSON.parse(
  readFileSync(new URL('../modules/mood-health/expo-module.config.json', import.meta.url), 'utf8'),
);

test('native release retains the verified existing app, team and version identity', () => {
  assert.equal(app.ios.bundleIdentifier, 'com.zhenyu.moodjournal.app');
  assert.equal(app.ios.appleTeamId, '9PB9F396XQ');
  assert.equal(eas.submit.production.ios.ascAppId, '6776595613');
  assert.equal(eas.submit.production.ios.appleTeamId, app.ios.appleTeamId);
  assert.equal(app.version, pkg.version);
  assert.equal(app.owner, 'zhen2yu');
  assert.equal(app.extra.eas.projectId, '427558a5-13db-42e4-a992-8a5167b5bffe');
  assert.ok(Number(app.ios.buildNumber) > 1);
});

test('HealthKit capability is scoped and both explicit permission purposes are present', () => {
  assert.deepEqual(app.ios.entitlements, { 'com.apple.developer.healthkit': true });
  assert.match(app.ios.infoPlist.NSHealthShareUsageDescription, /选择读取/);
  assert.match(app.ios.infoPlist.NSHealthUpdateUsageDescription, /确认写入/);
  assert.match(app.ios.infoPlist.NSHealthUpdateUsageDescription, /文字日记不会写入/);
  assert.equal(app.ios.infoPlist.UIBackgroundModes, undefined);
  assert.equal(app.ios.infoPlist.NSHealthClinicalHealthRecordsShareUsageDescription, undefined);
});

test('the local module is registered for Apple without raising journal minimum to iOS 18', () => {
  assert.deepEqual(moduleConfig.platforms, ['apple']);
  assert.deepEqual(moduleConfig.apple.modules, ['MoodHealthModule']);
  const properties = app.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  );
  assert.equal(properties[1].ios.deploymentTarget, '15.1');
});

test('production and simulator profiles are distinct and do not embed account credentials', () => {
  assert.equal(eas.build.production.distribution, 'store');
  assert.equal(eas.build.production.credentialsSource, 'local');
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(eas.build.simulator.ios.simulator, true);
  assert.equal(eas.build.production.env.MOODTRACKER_BUILD_TARGET, 'native');
  assert.equal(eas.build.simulator.env.MOODTRACKER_BUILD_TARGET, 'native');
  for (const profile of Object.values(eas.build) as { env: Record<string, string> }[]) {
    assert.ok(Object.values(profile.env).every((value) => value.length > 0));
  }
  assert.equal(eas.submit.production.ios.appleId, undefined);
  assert.equal(eas.submit.production.ios.ascApiKeyPath, undefined);
});

test('release uses system encryption only and keeps local signing files out of Git', () => {
  assert.equal(app.ios.config.usesNonExemptEncryption, false);
  const ignored = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.ok(ignored.split('\n').includes('/credentials.json'));
  for (const profile of [eas.build.production, eas.build.simulator]) {
    assert.equal(profile.node, '22.23.1');
    assert.equal(profile.ios.image, 'macos-sequoia-15.6-xcode-26.2');
  }
});

test('native EAS config cannot inherit the GitHub Pages asset prefix', () => {
  const configure = createRequire(import.meta.url)('../app.config.js');
  const previousTarget = process.env.MOODTRACKER_BUILD_TARGET;
  const previousBase = process.env.EXPO_PUBLIC_BASE_URL;
  try {
    process.env.EXPO_PUBLIC_BASE_URL = '/moodtracker';
    process.env.MOODTRACKER_BUILD_TARGET = 'native';
    assert.equal(configure({ config: {} }).experiments.baseUrl, '');
    delete process.env.MOODTRACKER_BUILD_TARGET;
    assert.equal(configure({ config: {} }).experiments.baseUrl, '/moodtracker');
  } finally {
    if (previousTarget === undefined) delete process.env.MOODTRACKER_BUILD_TARGET;
    else process.env.MOODTRACKER_BUILD_TARGET = previousTarget;
    if (previousBase === undefined) delete process.env.EXPO_PUBLIC_BASE_URL;
    else process.env.EXPO_PUBLIC_BASE_URL = previousBase;
  }
});

test('normal CI test command includes the optional native bridge regression suite', () => {
  assert.match(pkg.scripts.test, /modules\/mood-health\/tests\/\*\.test\.ts/);
});
