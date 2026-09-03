import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const native = read('../ios/MoodHealthModule.swift');
const observer = read('../ios/MoodHealthObserver.swift');
const subscriber = read('../ios/MoodHealthAppDelegateSubscriber.swift');
const config = JSON.parse(read('../expo-module.config.json'));

test('cold-start observation is registered as an Expo app delegate subscriber after explicit opt-in', () => {
  assert.deepEqual(config.apple.appDelegateSubscribers, ['MoodHealthAppDelegateSubscriber']);
  assert.match(subscriber, /didFinishLaunchingWithOptions/);
  assert.match(
    subscriber,
    /#available\(iOS 18\.0, \*\), HKHealthStore\.isHealthDataAvailable\(\), MoodHealthObserver\.shouldRestoreAtLaunch/,
  );
  assert.match(observer, /bool\(forKey: observationEnabledKey\) && wasReadAuthorizationRequested/);
  assert.match(
    native,
    /if completed && read\s*\{\s*MoodHealthObserver\.markReadAuthorizationRequested\(\)/,
  );
  assert.match(native, /ERR_MOOD_HEALTH_READ_REQUEST_REQUIRED/);
  assert.doesNotMatch(observer + subscriber, /requestAuthorization\(/);
});

test('native observer invalidates without querying, persisting, exporting, or logging health samples', () => {
  assert.match(observer, /HKObserverQuery\(sampleType: HKObjectType\.stateOfMindType\(\)/);
  assert.doesNotMatch(
    observer + subscriber,
    /HKSampleQuery|HKAnchoredObjectQuery|\.save\(|\.delete\(|print\(|NSLog\(/,
  );
  assert.match(observer, /defer \{ completion\(\) \}/);
  assert.match(observer, /"reason": reason, "revision": NSNumber\(value: revision\)/);
  assert.doesNotMatch(observer, /"valence"|"labels"|"associations"|"uuid"|"timestamp"/);
  const preferenceWrites = [
    ...observer.matchAll(/(?:defaults|UserDefaults\.standard)\.set\(([^\n]+)/g),
  ];
  assert.equal(preferenceWrites.length, 3);
  assert.ok(
    preferenceWrites.every((match) =>
      /(?:true|false), forKey: (?:readRequestCompletedKey|observationEnabledKey)/.test(match[1]),
    ),
  );
});

test('observer shutdown rejects stale query callbacks and serializes conflicting background registrations', () => {
  assert.match(
    observer,
    /defaults\.bool\(forKey: observationEnabledKey\), self\.observerQuery === query/,
  );
  assert.match(observer, /defaults\.set\(false, forKey: observationEnabledKey\)/);
  assert.match(observer, /healthStore\.stop\(observerQuery\)/);
  assert.match(observer, /guard !configurationInProgress else \{ return \}/);
  assert.match(observer, /guard stillEnabled == enabled else \{/);
  assert.match(observer, /enableBackgroundDelivery\(for: type, frequency: \.immediate/);
  assert.match(observer, /disableBackgroundDelivery\(for: type/);
  assert.doesNotMatch(observer, /disableAllBackgroundDelivery/);
  assert.match(observer, /snapshotLock\.lock\(\)/);
  assert.doesNotMatch(native + observer, /DispatchQueue\.main\.sync/);
});

test('permission, locked-device, and health restrictions remain distinguishable without NSError contents', () => {
  for (const code of [
    'AUTHORIZATION_REQUIRED',
    'PROTECTED_DATA_UNAVAILABLE',
    'RESTRICTED',
    'UNAVAILABLE',
  ]) {
    assert.match(observer, new RegExp(`ERR_MOOD_HEALTH_${code}`));
    assert.match(native, new RegExp(`ERR_MOOD_HEALTH_${code}`));
  }
  assert.doesNotMatch(native + observer, /localizedDescription|\.userInfo|NSLog\(/);
  assert.match(
    native,
    /self\.rejectHealthError\(error, operation: "SAVE_UNVERIFIED", promise: promise\)/,
  );
});
