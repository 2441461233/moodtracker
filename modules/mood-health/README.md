# MoodHealth (local Expo module)

Private iOS bridge for `HKStateOfMind`. Importing the JavaScript bridge does not request permission, query or write samples, or enable observation. After a person explicitly enables automatic sync, the app delegate restores the native observer on later launches, before JavaScript runs. There is no analytics, logging, note transfer, or deletion. This module does not read or write `mindfulSession`.

## Runtime and app configuration

- Native deployment target is iOS 15.1, matching Expo SDK 54 / React Native 0.81. The State of Mind API itself is guarded by iOS 18 availability. Older devices retain the journal UI and return `ios_version`.
- The native JS name is `MoodHealth`; the Swift class is `MoodHealthModule`; the CocoaPod/Swift module is `MoodHealth`.
- Expo's local module discovery finds `modules/mood-health/expo-module.config.json`. Import from the module directory; no npm publication is required.
- The host application must enable `com.apple.developer.healthkit` and `com.apple.developer.healthkit.background-delivery`, and provide accurate `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` strings. The distribution provisioning profile must include both entitlements. These values belong to the host app, not this pod.
- Compile with an Xcode SDK containing iOS 18 HealthKit APIs. Expo Go cannot acquire the native module through a JS update; use a development or production native build.
- Web and Android report `unsupported_platform`. iOS binaries without the native module report `native_module_missing`; the optional bridge does not fail at import.

## Public interface

The default object and named exports have the same methods:

| Method                                    | Behavior                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAvailability()`                       | Synchronous `{ available, reason }`; does not request permission.                                                                                                                                                                                                                       |
| `getWriteAuthorization()`                 | Synchronous `notDetermined`, `denied`, or `authorized`. This says nothing about read permission. On unavailable platforms, returns `notDetermined`.                                                                                                                                     |
| `requestAuthorization(read, write)`       | Explicit system prompt for the State of Mind type. `{ requestCompleted, writeAuthorization }` never claims read access. Unavailable platforms / no requested types return `requestCompleted: false`.                                                                                    |
| `getObservationStatus()`                  | Synchronous enabled/observing/background-delivery state, in-memory revision, and optional safe error code. Unavailable platforms return an explicit unavailable status.                                                                                                                 |
| `startObservingStateOfMind()`             | Enables notifications and requests `.immediate` background delivery without prompting for permission. Requires a previously completed explicit read-authorization request. Background registration failure retains foreground observation and returns an unavailable background status. |
| `stopObservingStateOfMind()`              | Immediately stops the observer and prevents its callbacks from emitting; disables background delivery for State of Mind. Concurrent start/stop calls settle to the latest choice.                                                                                                       |
| `addStateOfMindChangeListener(listener)`  | Receives only `{reason, revision, errorCode?}` invalidations; returns a removable subscription. It does not enable observation, prompt, fetch, or transfer samples. Call only when availability is true.                                                                                |
| `queryStateOfMind(startMs, endMs, limit)` | Reads `[startMs, endMs)`, newest first; 1–5000 samples and at most 366 elapsed days. Returns original Apple `valence`, `kind`, numeric labels/associations, UUID, and source identity. An empty query does not prove there are no records or that read access was granted.              |
| `saveStateOfMind(input)`                  | Explicit write of one `momentaryEmotion`; returns the UUID of the persisted sample. Requires write authorization. No automatic prompt.                                                                                                                                                  |

Unavailable query/save calls reject with `ERR_MOOD_HEALTH_UNAVAILABLE` instead of pretending to succeed. Invalid inputs, denied authorization, sync conflicts, and unverifiable save results also reject. The caller must keep local data and show a retryable state on failure.

### Automatic observation and lifecycle

The caller first asks the person to enable automatic sync and explicitly calls `requestAuthorization(true, true)`. A completed **read request** is remembered, not a claim that Apple granted read access. `startObservingStateOfMind()` never opens a permission sheet itself. Installations upgrading from the manual-sync build need one explicit reconnection before enabling the new observer.

`MoodHealthAppDelegateSubscriber` restores an opted-in `HKObserverQuery` during `didFinishLaunchingWithOptions`, as Apple requires for background wakeups. It never starts for an installation that has not opted in. Native persistence is limited to two Boolean preferences: explicit observation enabled and read request completed. Sample contents and the invalidation revision are not persisted. The native callback acknowledges every delivery after recording an in-memory invalidation, including when JavaScript has not started or an old query was stopped. It does not run a sample query in the background.

The foreground application is responsible for refreshing visible Apple records on notifications and every return to the app, and for exporting newly saved local entries through the existing idempotent writer. Removing a JavaScript listener does not disable a person's ongoing opt-in; call `stopObservingStateOfMind()` to disconnect. `.immediate` requests the earliest delivery the system permits; it is not a guaranteed real-time background schedule. Background delivery must be tested on a physical device, not a simulator.

Observation errors stop the failed query; an explicit start or the next active lifecycle event recreates it. Safe error codes distinguish denied permission, a locked/inaccessible health database, device restrictions, and background-registration failure. No native error descriptions or sample-bearing error metadata cross the bridge. The caller should preserve local records and retry temporary errors without silently requesting permission again.

### Write payload and deduplication

- `syncIdentifier`: stable `moodtracker:<local entry id>`, nonempty suffix, at most 200 UTF-16 code units, no control characters.
- `syncVersion`: positive safe integer, monotonically increasing for edits. **Retries retain the same version.** The module validates the version against an existing sample as well as checking integer bounds.
- `timestamp`: finite Unix milliseconds from 1970 through the current time.
- `valence`: finite `[-1, 1]`; never remapped by the native bridge.
- `kind`: `momentaryEmotion` only. Do not synthesize a daily mood from multiple momentary records.
- `associations`: an allowlisted subset of official enum names. `sleep`, `finances`, and `dailyTasks` are intentionally unsupported; Apple's relevant enum names are `money`/`tasks`, and sleep has no matching association. Those alternate names are not part of this release's requested allowlist.
- `labels` is empty on writes because this API does not collect specific Apple feeling labels. Journal notes and arbitrary input properties are excluded by the TS allowlist and never passed into metadata.

Only `HKMetadataKeySyncIdentifier` and `HKMetadataKeySyncVersion` are written into metadata. Native writes are serialized. An existing identical version/content returns the existing UUID; an older or conflicting version is rejected. Higher versions use HealthKit's replacement semantics. After a new save, the module reads its own persisted sample to avoid reporting the UUID of an in-memory duplicate that HealthKit discarded.

The existing-sample predicate is scoped to the current HealthKit source. External samples are returned with their source and `isFromThisApp: false`, but the module has no interface that edits or deletes them. Local deletion does not remove a HealthKit sample; the UI must say so explicitly.

## Validation

From the repository root:

```sh
npx tsx --test modules/mood-health/tests/*.test.ts
swiftc -frontend -parse modules/mood-health/ios/*.swift
ruby -c modules/mood-health/ios/MoodHealth.podspec
npx expo-modules-autolinking search --platform apple
```

These checks do not replace compilation against a real iOS SDK. The implementation host only has Command Line Tools, not Xcode. A signed physical-device test must separately verify the real permission sheet, write denial/revocation, original sample kinds/sources, repeated-write deduplication, higher-version replacement, and Health app visibility. No personal health records were accessed during implementation.

## Primary references

- [Apple HKStateOfMind](https://developer.apple.com/documentation/healthkit/hkstateofmind)
- [Apple State of Mind associations](https://developer.apple.com/documentation/healthkit/hkstateofmind/association)
- [Apple HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Apple authorizationStatus only reports write authorization](<https://developer.apple.com/documentation/healthkit/hkhealthstore/authorizationstatus(for:)>)
- [Apple sync identifier and version replacement](https://developer.apple.com/documentation/healthkit/hkmetadatakeysyncidentifier)
- [Apple observer queries and background startup](https://developer.apple.com/documentation/healthkit/executing-observer-queries)
- [Apple HealthKit background-delivery entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.healthkit.background-delivery)
- [Apple WWDC24 wellbeing APIs](https://developer.apple.com/videos/play/wwdc2024/10109/)
- [Expo local modules](https://docs.expo.dev/modules/get-started/)
- [Expo Modules API](https://docs.expo.dev/modules/module-api/)
- [Expo app delegate subscribers](https://docs.expo.dev/modules/appdelegate-subscribers/)
