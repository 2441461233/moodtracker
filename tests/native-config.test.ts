import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(eas.build.simulator.ios.simulator, true);
  assert.equal(eas.build.production.env.EXPO_PUBLIC_BASE_URL, '');
  assert.equal(eas.submit.production.ios.appleId, undefined);
  assert.equal(eas.submit.production.ios.ascApiKeyPath, undefined);
});

test('normal CI test command includes the optional native bridge regression suite', () => {
  assert.match(pkg.scripts.test, /modules\/mood-health\/tests\/\*\.test\.ts/);
});
