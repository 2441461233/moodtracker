#!/usr/bin/env bash
# Compile generated native code only. This does not sign, upload, or distribute an app.
set -euo pipefail

ios_verify_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ios_verify_root"

# Prebuild edits the native project. A developer's existing checkout is not disposable.
if [[ -e ios ]]; then
  printf '%s\n' 'Refusing to overwrite an existing ios directory. Run in a fresh checkout.' >&2
  exit 1
fi

for ios_verify_tool in node npx pod xcodebuild xcrun; do
  if ! command -v "$ios_verify_tool" >/dev/null 2>&1; then
    printf 'Missing required tool: %s\n' "$ios_verify_tool" >&2
    exit 1
  fi
done

ios_verify_output="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/moodtracker-ios-verify.XXXXXX")"
ios_verify_logs="$ios_verify_output/logs"
mkdir "$ios_verify_logs"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'logs=%s\n' "$ios_verify_logs" >> "$GITHUB_OUTPUT"
fi

xcodebuild -version | tee "$ios_verify_logs/xcode-version.log"
ios_verify_sdk="$(xcrun --sdk iphonesimulator --show-sdk-version)"
node -e '
  const version = process.argv[1];
  if (!/^\d+(\.\d+)*$/.test(version) || Number(version.split(".")[0]) < 18) {
    throw new Error(`HealthKit State of Mind requires iOS 18+ SDK; found ${version}`);
  }
  console.log(`Simulator SDK: ${version}`);
' "$ios_verify_sdk" | tee "$ios_verify_logs/sdk-version.log"

npx --no-install expo prebuild --platform ios --no-install \
  2>&1 | tee "$ios_verify_logs/prebuild.log"
(
  cd ios
  pod install
) 2>&1 | tee "$ios_verify_logs/pod-install.log"

# Discover the generated project rather than guessing the sanitized Chinese app name.
ios_verify_project="$(node -e '
  const fs = require("node:fs");
  const projects = fs.readdirSync("ios").filter(name => name.endsWith(".xcodeproj"));
  if (projects.length !== 1) throw new Error(`Expected one app project, found ${projects.length}`);
  process.stdout.write(`ios/${projects[0]}`);
')"
ios_verify_workspace="$(node -e '
  const fs = require("node:fs");
  const workspaces = fs.readdirSync("ios").filter(name => name.endsWith(".xcworkspace"));
  if (workspaces.length !== 1) throw new Error(`Expected one workspace, found ${workspaces.length}`);
  process.stdout.write(`ios/${workspaces[0]}`);
')"

xcodebuild -list -json -project "$ios_verify_project" \
  > "$ios_verify_logs/project.json"

# xcode is part of the locked Expo config-plugin dependencies; it parses actual targets.
ios_verify_scheme="$(node - "$ios_verify_project" "$ios_verify_logs/project.json" <<'NODE'
const fs = require('node:fs');
const xcode = require('xcode');
const unquote = value => String(value).replace(/^"(.*)"$/, '$1');
const project = xcode.project(`${process.argv[2]}/project.pbxproj`);
project.parseSync();
const applications = Object.values(project.pbxNativeTargetSection()).filter(
  target => typeof target === 'object' &&
    unquote(target.productType) === 'com.apple.product-type.application'
);
if (applications.length !== 1) {
  throw new Error(`Expected one application target, found ${applications.length}`);
}
const targetName = unquote(applications[0].name);
const schemes = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).project.schemes;
if (!schemes.includes(targetName)) {
  throw new Error(`The application target has no matching shared scheme: ${targetName}`);
}
process.stdout.write(targetName);
NODE
)"

# A passing compile must include the local Swift module, not merely the Expo shell.
node <<'NODE' | tee "$ios_verify_logs/health-autolinking.log"
const fs = require('node:fs');
const path = require('node:path');
const xcode = require('xcode');
const pods = xcode.project('ios/Pods/Pods.xcodeproj/project.pbxproj');
pods.parseSync();
const hasHealthTarget = Object.values(pods.pbxNativeTargetSection()).some(
  target => typeof target === 'object' &&
    String(target.name).replace(/^"(.*)"$/, '$1') === 'MoodHealth'
);
if (!hasHealthTarget) throw new Error('MoodHealth is missing from CocoaPods targets');
function providers(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? providers(location) :
      entry.name === 'ExpoModulesProvider.swift' ? [location] : [];
  });
}
const registered = providers('ios/Pods/Target Support Files').some(file =>
  fs.readFileSync(file, 'utf8').includes('MoodHealthModule.self')
);
if (!registered) throw new Error('MoodHealthModule is missing from Expo module registration');
console.log('Verified MoodHealth pod target and Expo registration.');
NODE

printf 'Building workspace %s, scheme %s\n' "$ios_verify_workspace" "$ios_verify_scheme"
xcodebuild \
  -workspace "$ios_verify_workspace" \
  -scheme "$ios_verify_scheme" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$ios_verify_output/DerivedData" \
  -resultBundlePath "$ios_verify_logs/NativeBuild.xcresult" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  build 2>&1 | tee "$ios_verify_logs/xcodebuild.log"

printf '%s\n' 'Unsigned iOS Simulator native compilation succeeded. No TestFlight build was uploaded.'
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '%s\n' \
    '### Native verification passed' \
    '' \
    'The app and MoodHealth Swift module compiled for the iOS Simulator without signing.' \
    'This is a compile check, not a signed device build, TestFlight upload, or HealthKit device test.' \
    >> "$GITHUB_STEP_SUMMARY"
fi
