import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMoodHealthBridge, MoodHealthError } from '../src/bridge';
import {
  HEALTH_ASSOCIATIONS,
  MAX_QUERY_DAYS,
  MAX_QUERY_LIMIT,
  MAX_LOCAL_ENTRY_ID_LENGTH,
  MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
  type NativeMoodHealthModule,
  type SaveStateOfMindInput,
  type StateOfMindChangeEvent,
  type StateOfMindSample,
} from '../src/types';

function fixture() {
  const calls: { authorization: number; queries: number; writes: SaveStateOfMindInput[] } = {
    authorization: 0,
    queries: 0,
    writes: [],
  };
  const samples: StateOfMindSample[] = [
    {
      uuid: 'apple-sample',
      timestamp: 1_700_000_000_000,
      kind: 'dailyMood',
      valence: -0.321,
      labels: [13, 27],
      associations: [8],
      sourceName: 'Apple Watch',
      sourceBundleId: 'com.apple.example-health-source',
      isFromThisApp: false,
    },
  ];
  const native: NativeMoodHealthModule = {
    getAvailability: () => ({ available: true, reason: 'available' }),
    getWriteAuthorization: () => 'denied',
    requestAuthorization: async () => {
      calls.authorization++;
      return { requestCompleted: true, writeAuthorization: 'denied' };
    },
    getObservationStatus: () => ({
      enabled: false,
      observing: false,
      backgroundDelivery: 'disabled',
      revision: 0,
    }),
    startObservingStateOfMind: async () => ({
      enabled: true,
      observing: true,
      backgroundDelivery: 'enabled',
      revision: 0,
    }),
    stopObservingStateOfMind: async () => ({
      enabled: false,
      observing: false,
      backgroundDelivery: 'disabled',
      revision: 0,
    }),
    addListener: () => ({ remove() {} }),
    queryStateOfMind: async () => {
      calls.queries++;
      return samples;
    },
    saveStateOfMind: async (input) => {
      calls.writes.push(input);
      return { uuid: 'saved-sample' };
    },
  };
  const input: SaveStateOfMindInput = {
    syncIdentifier: 'moodtracker:entry-1',
    syncVersion: 1,
    timestamp: 1_700_000_000_000,
    valence: 0.5,
    kind: 'momentaryEmotion',
    associations: ['work'],
  };
  return { native, calls, samples, input, bridge: createMoodHealthBridge(native, 'ios') };
}

const invalidCode = (error: unknown) =>
  error instanceof MoodHealthError && error.code === 'ERR_MOOD_HEALTH_INVALID_INPUT';

test('creating the bridge does not request permissions, query, or write', () => {
  const { calls } = fixture();
  assert.deepEqual(calls, { authorization: 0, queries: 0, writes: [] });
});

test('web, Android and missing native iOS module have safe explicit availability', async () => {
  for (const platform of ['web', 'android']) {
    const bridge = createMoodHealthBridge(null, platform);
    assert.deepEqual(bridge.getAvailability(), {
      available: false,
      reason: 'unsupported_platform',
    });
    assert.equal(bridge.getWriteAuthorization(), 'notDetermined');
    assert.deepEqual(await bridge.requestAuthorization(true, true), {
      requestCompleted: false,
      writeAuthorization: 'notDetermined',
    });
    await assert.rejects(bridge.queryStateOfMind(0, 1000, 1), {
      code: 'ERR_MOOD_HEALTH_UNAVAILABLE',
    });
  }
  const bridge = createMoodHealthBridge(null, 'ios');
  assert.deepEqual(bridge.getAvailability(), { available: false, reason: 'native_module_missing' });
  await assert.rejects(bridge.saveStateOfMind(fixture().input), {
    code: 'ERR_MOOD_HEALTH_UNAVAILABLE',
  });
});

test('old iOS and devices without health data do not reach native data operations', async () => {
  for (const reason of ['ios_version', 'health_data_unavailable'] as const) {
    const { native, calls } = fixture();
    native.getAvailability = () => ({ available: false, reason });
    const bridge = createMoodHealthBridge(native, 'ios');
    assert.deepEqual(bridge.getAvailability(), { available: false, reason });
    assert.equal(bridge.getWriteAuthorization(), 'notDetermined');
    assert.deepEqual(await bridge.requestAuthorization(true, true), {
      requestCompleted: false,
      writeAuthorization: 'notDetermined',
    });
    assert.equal(calls.authorization, 0);
  }
});

test('completed authorization request never fabricates read or write permission', async () => {
  const { bridge, calls } = fixture();
  assert.deepEqual(await bridge.requestAuthorization(true, true), {
    requestCompleted: true,
    writeAuthorization: 'denied',
  });
  assert.equal(calls.authorization, 1);
  assert.deepEqual(await bridge.requestAuthorization(false, false), {
    requestCompleted: false,
    writeAuthorization: 'denied',
  });
  assert.equal(calls.authorization, 1);
  await assert.rejects(bridge.requestAuthorization('yes' as never, true), invalidCode);
});

test('reading does not require write permission or relabel external daily moods', async () => {
  const { bridge, samples, calls } = fixture();
  const result = await bridge.queryStateOfMind(1_699_999_000_000, 1_700_001_000_000, 50);
  assert.deepEqual(result, samples);
  assert.notStrictEqual(result, samples);
  assert.equal(result[0].kind, 'dailyMood');
  assert.equal(result[0].valence, -0.321);
  assert.equal(result[0].isFromThisApp, false);
  assert.equal(calls.authorization, 0);
  assert.equal(calls.queries, 1);
});

test('own-source stable local IDs survive reads without modifying or sharing mutable arrays', async () => {
  const { bridge, samples, calls } = fixture();
  samples[0] = {
    ...samples[0],
    sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
    isFromThisApp: true,
    localEntryId: 'existing-local-entry',
  };
  const before = structuredClone(samples);
  const [result] = await bridge.queryStateOfMind(0, 1000, 1);
  assert.deepEqual(result, samples[0]);
  assert.equal(result.localEntryId, 'existing-local-entry');
  assert.notStrictEqual(result.labels, samples[0].labels);
  assert.notStrictEqual(result.associations, samples[0].associations);
  result.labels.push(999);
  result.associations.push(999);
  assert.deepEqual(samples, before);
  assert.equal(calls.authorization, 0);
  assert.equal(calls.writes.length, 0);
});

test('legacy own-source records without a local ID remain readable for unmatched display', async () => {
  const { bridge, samples } = fixture();
  samples[0] = {
    ...samples[0],
    sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
    isFromThisApp: true,
  };
  const [result] = await bridge.queryStateOfMind(0, 1000, 1);
  assert.equal(result.isFromThisApp, true);
  assert.equal(Object.hasOwn(result, 'localEntryId'), false);
  assert.equal(result.uuid, samples[0].uuid);
});

test('foreign identity cannot nominate a local entry even with an ownership flag or forged metadata', async () => {
  const { bridge, samples } = fixture();
  for (const [sourceBundleId, isFromThisApp] of [
    ['com.apple.health', false],
    ['com.apple.health', true],
    [MOOD_HEALTH_APP_BUNDLE_IDENTIFIER, false],
    [MOOD_HEALTH_APP_BUNDLE_IDENTIFIER + '.foreign', true],
  ] as const) {
    samples[0] = {
      ...samples[0],
      sourceBundleId,
      isFromThisApp,
      localEntryId: 'real-local-entry',
      note: 'must never cross this read boundary',
      metadata: { HKMetadataKeySyncIdentifier: 'moodtracker:real-local-entry' },
      unexpected: true,
    } as StateOfMindSample;
    const [result] = await bridge.queryStateOfMind(0, 1000, 1);
    assert.equal(result.isFromThisApp, false);
    assert.equal(Object.hasOwn(result, 'localEntryId'), false);
    assert.equal(Object.hasOwn(result, 'note'), false);
    assert.equal(Object.hasOwn(result, 'metadata'), false);
    assert.equal(Object.hasOwn(result, 'unexpected'), false);
    assert.equal(result.uuid, samples[0].uuid);
    assert.equal(result.kind, 'dailyMood');
  }
});

test('invalid optional local IDs are rejected as match keys without hiding health records', async () => {
  const { bridge, samples } = fixture();
  for (const localEntryId of [
    undefined,
    null,
    false,
    123,
    [],
    {},
    '',
    '   ',
    'x'.repeat(MAX_LOCAL_ENTRY_ID_LENGTH + 1),
    '🙂'.repeat(MAX_LOCAL_ENTRY_ID_LENGTH / 2 + 1),
    'entry\u0000tail',
    'entry\n',
    'entry\u007f',
    'entry\u0085',
    'entry\u200b',
    'entry\u202e',
    'entry\ufeff',
  ]) {
    samples[0] = {
      ...samples[0],
      sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
      isFromThisApp: true,
      localEntryId,
    } as StateOfMindSample;
    const [result] = await bridge.queryStateOfMind(0, 1000, 1);
    assert.equal(Object.hasOwn(result, 'localEntryId'), false);
    assert.equal(result.isFromThisApp, true);
    assert.equal(result.uuid, samples[0].uuid);
  }
});

test('validated local IDs retain exact spelling and the 160 UTF-16 limit', async () => {
  const { bridge, samples } = fixture();
  for (const localEntryId of ['x', ' entry ', '心情-记录', 'x'.repeat(160), '🙂'.repeat(80)]) {
    samples[0] = {
      ...samples[0],
      sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
      isFromThisApp: true,
      localEntryId,
    };
    const [result] = await bridge.queryStateOfMind(0, 1000, 1);
    assert.equal(result.localEntryId, localEntryId);
  }
});

test('query accepts at most 366 days and 5000 samples', async () => {
  const { bridge, calls } = fixture();
  const maximumRange = MAX_QUERY_DAYS * 86_400_000;
  await bridge.queryStateOfMind(0, maximumRange, MAX_QUERY_LIMIT);
  for (const [start, end, limit] of [
    [0, maximumRange + 1, 1],
    [0, 1000, 5001],
    [0, 1000, 0],
    [0, 1000, 1.5],
    [0, 1000, NaN],
    [-1, 1000, 1],
    [1000, 1000, 1],
    [1001, 1000, 1],
    [NaN, 1000, 1],
    [0, Infinity, 1],
    [8.64e15 - 100, 8.64e15 + 1, 1],
  ])
    await assert.rejects(bridge.queryStateOfMind(start, end, limit), invalidCode);
  assert.equal(calls.queries, 1);
});

test('only explicit save writes; bridge excludes notes and unrecognized properties', async () => {
  const { bridge, calls, input } = fixture();
  const withExtraFields = {
    ...input,
    associations: ['work', 'work'] as const,
    note: 'private journal',
    metadata: { sensitive: true },
  };
  const result = await bridge.saveStateOfMind(withExtraFields as unknown as SaveStateOfMindInput);
  assert.deepEqual(result, { uuid: 'saved-sample' });
  assert.deepEqual(calls.writes, [input]);
  assert.equal(calls.authorization, 0);
});

test('write payload requires namespaced identity and safe monotonic-version input', async () => {
  const { bridge, input, calls } = fixture();
  for (const override of [
    { syncIdentifier: '' },
    { syncIdentifier: 'other:1' },
    { syncIdentifier: 'moodtracker:' },
    { syncIdentifier: 'moodtracker:\nentry' },
    { syncIdentifier: 'moodtracker:' + 'x'.repeat(200) },
    { syncVersion: 0 },
    { syncVersion: -1 },
    { syncVersion: 1.5 },
    { syncVersion: Infinity },
    { syncVersion: Number.MAX_SAFE_INTEGER + 1 },
  ])
    await assert.rejects(bridge.saveStateOfMind({ ...input, ...override }), invalidCode);
  assert.equal(calls.writes.length, 0);
});

test('write rejects invalid or future timestamps, valences and dailyMood synthesis', async () => {
  const { bridge, input, calls } = fixture();
  for (const override of [
    { timestamp: NaN },
    { timestamp: -1 },
    { timestamp: Date.now() + 60_000 },
    { valence: NaN },
    { valence: -1.01 },
    { valence: 1.01 },
    { kind: 'dailyMood' },
  ])
    await assert.rejects(
      bridge.saveStateOfMind({ ...input, ...override } as SaveStateOfMindInput),
      invalidCode,
    );
  for (const valence of [-1, 0, 1]) await bridge.saveStateOfMind({ ...input, valence });
  assert.equal(calls.writes.length, 3);
});

test('association allowlist never invents Apple sleep, finances or dailyTasks cases', async () => {
  const { bridge, input } = fixture();
  for (const name of ['sleep', 'finances', 'dailyTasks', 'unknown']) {
    assert.equal((HEALTH_ASSOCIATIONS as readonly string[]).includes(name), false);
    await assert.rejects(
      bridge.saveStateOfMind({ ...input, associations: [name] } as SaveStateOfMindInput),
      invalidCode,
    );
  }
  for (const association of HEALTH_ASSOCIATIONS)
    await bridge.saveStateOfMind({ ...input, associations: [association] });
});

test('native failures are not converted into successful empty reads or writes', async () => {
  const { bridge, input, native } = fixture();
  const failure = Object.assign(new Error('Native operation did not finish'), {
    code: 'ERR_MOOD_HEALTH_SAVE_UNVERIFIED',
  });
  native.saveStateOfMind = async () => {
    throw failure;
  };
  native.queryStateOfMind = async () => {
    throw failure;
  };
  await assert.rejects(bridge.saveStateOfMind(input), (error) => error === failure);
  await assert.rejects(bridge.queryStateOfMind(0, 1000, 1), (error) => error === failure);
});

test('automatic observation is explicit and never requests permissions by itself', async () => {
  const { bridge, native, calls } = fixture();
  let starts = 0;
  let stops = 0;
  const enabled = {
    enabled: true,
    observing: true,
    backgroundDelivery: 'enabled' as const,
    revision: 3,
  };
  native.startObservingStateOfMind = async () => {
    starts++;
    return enabled;
  };
  native.stopObservingStateOfMind = async () => {
    stops++;
    return { ...enabled, enabled: false, observing: false, backgroundDelivery: 'disabled' };
  };
  assert.equal(bridge.getObservationStatus().enabled, false);
  assert.equal(starts, 0);
  assert.equal(stops, 0);
  assert.deepEqual(await bridge.startObservingStateOfMind(), enabled);
  assert.equal((await bridge.stopObservingStateOfMind()).enabled, false);
  assert.deepEqual({ starts, stops }, { starts: 1, stops: 1 });
  assert.deepEqual(calls, { authorization: 0, queries: 0, writes: [] });
});

test('background delivery failure does not falsely disable working foreground observation', async () => {
  const { bridge, native } = fixture();
  const status = {
    enabled: true,
    observing: true,
    backgroundDelivery: 'unavailable' as const,
    revision: 0,
    errorCode: 'ERR_MOOD_HEALTH_BACKGROUND_DELIVERY',
  };
  native.startObservingStateOfMind = async () => status;
  assert.deepEqual(await bridge.startObservingStateOfMind(), status);
});

test('first connection read-request guard is actionable and not retried as silent authorization', async () => {
  const { bridge, native, calls } = fixture();
  const failure = Object.assign(new Error('Reconnect once'), {
    code: 'ERR_MOOD_HEALTH_READ_REQUEST_REQUIRED',
  });
  native.startObservingStateOfMind = async () => {
    throw failure;
  };
  await assert.rejects(bridge.startObservingStateOfMind(), (error) => error === failure);
  assert.equal(calls.authorization, 0);
});

test('observation on unsupported binaries stays unavailable without touching native operations', async () => {
  for (const platform of ['web', 'android', 'ios']) {
    const bridge = createMoodHealthBridge(null, platform);
    assert.deepEqual(bridge.getObservationStatus(), {
      enabled: false,
      observing: false,
      backgroundDelivery: 'unavailable',
      revision: 0,
      errorCode: 'ERR_MOOD_HEALTH_UNAVAILABLE',
    });
    await assert.rejects(bridge.startObservingStateOfMind(), {
      code: 'ERR_MOOD_HEALTH_UNAVAILABLE',
    });
    await assert.rejects(bridge.stopObservingStateOfMind(), {
      code: 'ERR_MOOD_HEALTH_UNAVAILABLE',
    });
    assert.throws(() => bridge.addStateOfMindChangeListener(() => {}), {
      code: 'ERR_MOOD_HEALTH_UNAVAILABLE',
    });
  }
});

test('state-of-mind notifications carry only safe invalidations and unsubscribe cleanly', () => {
  const { bridge, native, calls } = fixture();
  let callback: ((event: StateOfMindChangeEvent) => void) | undefined;
  let removed = false;
  native.addListener = (name, listener) => {
    assert.equal(name, 'onStateOfMindChange');
    callback = listener;
    return {
      remove: () => {
        removed = true;
        callback = undefined;
      },
    };
  };
  const received: StateOfMindChangeEvent[] = [];
  const subscription = bridge.addStateOfMindChangeListener((event) => received.push(event));
  assert.ok(callback);
  callback({ reason: 'changed', revision: 1, sample: { note: 'never forward' } } as never);
  callback({ reason: 'foreground', revision: 2 });
  callback({
    reason: 'error',
    revision: 3,
    errorCode: 'ERR_MOOD_HEALTH_PROTECTED_DATA_UNAVAILABLE',
  });
  callback({ reason: 'error', revision: 4, errorCode: 'An error containing arbitrary metadata' });
  callback({ reason: 'unknown', revision: 5 } as never);
  callback({ reason: 'changed', revision: NaN });
  assert.deepEqual(received, [
    { reason: 'changed', revision: 1 },
    { reason: 'foreground', revision: 2 },
    { reason: 'error', revision: 3, errorCode: 'ERR_MOOD_HEALTH_PROTECTED_DATA_UNAVAILABLE' },
    { reason: 'error', revision: 4 },
  ]);
  subscription.remove();
  assert.equal(removed, true);
  assert.equal(callback, undefined);
  assert.deepEqual(calls, { authorization: 0, queries: 0, writes: [] });
  assert.throws(() => bridge.addStateOfMindChangeListener(null as never), invalidCode);
});
