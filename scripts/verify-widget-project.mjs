import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const plist = require('@expo/plist').default;
const location = process.argv[2];
if (!location) throw new Error('Pass the generated .xcodeproj path after expo prebuild.');
const ios = dirname(resolve(location));
const project = xcode.project(join(location, 'project.pbxproj'));
project.parseSync();
const objects = project.hash.project.objects;
const unquote = (value) => String(value).replace(/^"(.*)"$/, '$1');
const records = (section) =>
  Object.entries(section ?? {}).filter(([key]) => !key.endsWith('_comment'));
const targets = records(objects.PBXNativeTarget);
const widgets = targets.filter(([, target]) => unquote(target.name) === 'QuickRecordWidget');
assert.equal(widgets.length, 1, 'Exactly one widget extension, including after repeated prebuild');
const [widgetId, widget] = widgets[0];
assert.equal(unquote(widget.productType), 'com.apple.product-type.app-extension');
const [hostId, host] = targets.find(
  ([, target]) => unquote(target.productType) === 'com.apple.product-type.application',
);
const configurations = (target) =>
  objects.XCConfigurationList[target.buildConfigurationList].buildConfigurations.map(
    ({ value }) => objects.XCBuildConfiguration[value].buildSettings,
  );
const hostSettings = configurations(host)[0];
const hostPlist = plist.parse(
  readFileSync(join(ios, unquote(hostSettings.INFOPLIST_FILE)), 'utf8'),
);
const hostEntitlements = plist.parse(
  readFileSync(join(ios, unquote(hostSettings.CODE_SIGN_ENTITLEMENTS)), 'utf8'),
);
assert.ok(
  hostPlist.CFBundleURLTypes.some((item) => item.CFBundleURLSchemes.includes('moodjournal')),
);
assert.ok(
  hostEntitlements['com.apple.security.application-groups'].includes(
    'group.com.zhenyu.moodjournal.app.widgets',
  ),
);
for (const settings of configurations(widget)) {
  const extensionPlist = plist.parse(
    readFileSync(join(ios, unquote(settings.INFOPLIST_FILE)), 'utf8'),
  );
  const entitlements = plist.parse(
    readFileSync(join(ios, unquote(settings.CODE_SIGN_ENTITLEMENTS)), 'utf8'),
  );
  assert.equal(unquote(settings.MARKETING_VERSION), hostPlist.CFBundleShortVersionString);
  assert.equal(unquote(settings.CURRENT_PROJECT_VERSION), hostPlist.CFBundleVersion);
  assert.equal(unquote(settings.IPHONEOS_DEPLOYMENT_TARGET), '15.1');
  assert.equal(
    unquote(settings.PRODUCT_BUNDLE_IDENTIFIER),
    `${unquote(hostSettings.PRODUCT_BUNDLE_IDENTIFIER)}.QuickRecordWidget`,
  );
  assert.equal(settings.APPLICATION_EXTENSION_API_ONLY, 'YES');
  assert.equal(settings.SKIP_INSTALL, 'YES');
  assert.equal(
    extensionPlist.NSExtension.NSExtensionPointIdentifier,
    'com.apple.widgetkit-extension',
  );
  assert.deepEqual(
    { ...entitlements },
    {
      'com.apple.security.application-groups': ['group.com.zhenyu.moodjournal.app.widgets'],
    },
  );
}
const sources = widget.buildPhases
  .map(({ value }) => objects.PBXSourcesBuildPhase[value])
  .filter(Boolean);
assert.equal(sources.length, 1);
const filenames = sources[0].files.map(({ value }) =>
  unquote(objects.PBXFileReference[objects.PBXBuildFile[value].fileRef].path),
);
assert.deepEqual(filenames.sort(), ['MoodCalendarWidget.swift', 'QuickRecordWidget.swift']);
for (const file of filenames) assert.ok(existsSync(join(ios, 'QuickRecordWidget', file)));
const embed = host.buildPhases
  .map(({ value }) => objects.PBXCopyFilesBuildPhase[value])
  .filter(Boolean);
assert.equal(
  embed
    .flatMap((phase) => phase.files)
    .filter(({ value }) => objects.PBXBuildFile[value].fileRef === widget.productReference).length,
  1,
  'The host must embed the extension exactly once',
);
assert.ok(embed.some((phase) => Number(phase.dstSubfolderSpec) === 13));
assert.ok(
  host.dependencies.some(({ value }) => objects.PBXTargetDependency[value].target === widgetId),
);
assert.notEqual(hostId, widgetId);
console.log(
  'Widget project verified: both Swift sources, one embedded extension, matching versions, URL scheme and App Group.',
);
