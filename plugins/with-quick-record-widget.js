const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const TARGET = 'QuickRecordWidget';
const APP_GROUP = 'group.com.zhenyu.moodjournal.app.widgets';
const unquote = (value) => String(value).replace(/^"(.*)"$/, '$1');

function configureWidget(project, config) {
  const objects = project.hash.project.objects;
  // The Expo template has no target dependencies. node-xcode silently skips the
  // dependency unless both sections exist before addTarget/addTargetDependency.
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};
  const bundleIdentifier = `${config.ios.bundleIdentifier}.${TARGET}`;
  let target = Object.entries(project.pbxNativeTargetSection()).find(
    ([key, value]) => !key.endsWith('_comment') && unquote(value.name) === TARGET,
  );
  if (!target) {
    // xcode's extension helper creates the product, embed phase and host dependency.
    const added = project.addTarget(TARGET, 'app_extension', TARGET, bundleIdentifier);
    target = [added.uuid, added.pbxNativeTarget];
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', added.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', added.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', added.uuid);
    for (const framework of ['SwiftUI.framework', 'WidgetKit.framework']) {
      project.addFramework(framework, { target: added.uuid, link: true });
    }
    const productBuildFile = Object.values(project.pbxBuildFileSection()).find(
      (file) => typeof file === 'object' && file.fileRef === added.pbxNativeTarget.productReference,
    );
    productBuildFile.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
  }
  const host = project.getFirstTarget();
  if (
    !host.firstTarget.dependencies.some(
      ({ value }) => objects.PBXTargetDependency[value]?.target === target[0],
    )
  )
    project.addTargetDependency(host.uuid, [target[0]]);

  let group = Object.entries(project.hash.project.objects.PBXGroup).find(
    ([key, value]) => !key.endsWith('_comment') && unquote(value.name) === TARGET,
  );
  if (!group) {
    const added = project.addPbxGroup([], TARGET, TARGET);
    project.addToPbxGroup(added.uuid, project.getFirstProject().firstProject.mainGroup);
    group = [added.uuid, added.pbxGroup];
  }
  for (const file of [`${TARGET}.swift`, 'MoodCalendarWidget.swift'])
    if (!project.hasFile(file)) project.addSourceFile(file, { target: target[0] }, group[0]);
  for (const file of ['Info.plist', 'Widget.entitlements'])
    if (!group[1].children.some((child) => child.comment === file)) project.addFile(file, group[0]);

  const configurations = project.pbxXCBuildConfigurationSection();
  const lists = project.hash.project.objects.XCConfigurationList;
  for (const { value } of lists[target[1].buildConfigurationList].buildConfigurations) {
    const configuration = configurations[value];
    Object.assign(configuration.buildSettings, {
      PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}"`,
      PRODUCT_NAME: '"$(TARGET_NAME)"',
      INFOPLIST_FILE: `"${TARGET}/Info.plist"`,
      GENERATE_INFOPLIST_FILE: 'NO',
      CODE_SIGN_ENTITLEMENTS: `"${TARGET}/Widget.entitlements"`,
      SWIFT_VERSION: '5.0',
      SWIFT_OPTIMIZATION_LEVEL: configuration.name === 'Debug' ? '"-Onone"' : '"-O"',
      IPHONEOS_DEPLOYMENT_TARGET: '15.1',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      SDKROOT: 'iphoneos',
      SUPPORTED_PLATFORMS: '"iphoneos iphonesimulator"',
      APPLICATION_EXTENSION_API_ONLY: 'YES',
      SKIP_INSTALL: 'YES',
      // Expo writes these config values directly to the host Info.plist; template
      // host build settings still say 1.0 / 1 and must not be copied to the widget.
      MARKETING_VERSION: config.version,
      CURRENT_PROJECT_VERSION: config.ios.buildNumber ?? '1',
      DEVELOPMENT_TEAM: config.ios.appleTeamId,
      CODE_SIGN_STYLE: 'Automatic',
      CLANG_ENABLE_MODULES: 'YES',
    });
  }
  // node-xcode includes optional undefined file attributes in newly created records.
  for (const section of Object.values(project.hash.project.objects))
    for (const record of Object.values(section))
      if (record && typeof record === 'object')
        for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key];
  return project;
}

function withQuickRecordWidget(config) {
  const extension = {
    targetName: TARGET,
    bundleIdentifier: `${config.ios.bundleIdentifier}.${TARGET}`,
    entitlements: { 'com.apple.security.application-groups': [APP_GROUP] },
  };
  const eas = ((config.extra ??= {}).eas ??= {});
  const ios = (((eas.build ??= {}).experimental ??= {}).ios ??= {});
  ios.appExtensions = [
    ...(ios.appExtensions ?? []).filter((item) => item.targetName !== TARGET),
    extension,
  ];
  return withXcodeProject(config, (mod) => {
    const destination = path.join(mod.modRequest.platformProjectRoot, TARGET);
    fs.mkdirSync(destination, { recursive: true });
    for (const file of [
      `${TARGET}.swift`,
      'MoodCalendarWidget.swift',
      'Info.plist',
      'Widget.entitlements',
    ]) {
      fs.copyFileSync(
        path.join(mod.modRequest.projectRoot, 'native', TARGET, file),
        path.join(destination, file),
      );
    }
    mod.modResults = configureWidget(mod.modResults, mod);
    return mod;
  });
}

module.exports = withQuickRecordWidget;
