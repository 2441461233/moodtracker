import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';

const native = readFileSync(new URL('../ios/MoodHealthModule.swift', import.meta.url), 'utf8');
const helper = native.slice(
  native.indexOf('private func localEntryIdentifier('),
  native.indexOf('private func findOwnSample('),
);

test('native read identity inspects sync metadata only after checking the actual current source', () => {
  assert.ok(helper.length > 0);
  assert.match(
    helper,
    /guard sample\.sourceRevision\.source\.bundleIdentifier == ownBundle,\s*let syncIdentifier = sample\.metadata\?\[HKMetadataKeySyncIdentifier\] as\? String/,
  );
  assert.match(helper, /syncIdentifier\.hasPrefix\("moodtracker:"\)/);
  assert.match(helper, /String\(syncIdentifier\.dropFirst\("moodtracker:"\.count\)\)/);
  assert.equal((helper.match(/sample\.metadata/g) ?? []).length, 1);
  assert.doesNotMatch(helper, /\.save\(|\.delete\(|HKMetadataKeySyncVersion|"note"|"metadata"/);
});

test('native local identity uses exact bounded non-control IDs and exposes only the optional suffix', () => {
  assert.match(helper, /!identifier\.isEmpty, identifier\.utf16\.count <= 160/);
  assert.match(helper, /trimmingCharacters\(in: \.whitespacesAndNewlines\)\.isEmpty/);
  assert.match(helper, /generalCategory == \.control/);
  assert.match(helper, /generalCategory == \.format/);
  assert.match(
    native,
    /if let localEntryId = self\.localEntryIdentifier\(for: sample, ownBundle: ownBundle\) \{\s*record\["localEntryId"\] = localEntryId/,
  );
  assert.doesNotMatch(native, /record\["metadata"\]|record\["notes?"\]|record\["syncIdentifier"\]/);
});
