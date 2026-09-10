#!/usr/bin/env bash
# Run the production Release app on a fresh simulator and retain native screenshots.
set -euo pipefail
ui_workspace="$1"
ui_project="$2"
ui_derived="$3"
ui_logs="$4"
ruby scripts/add-ios-ui-tests.rb "$ui_project"
ui_device_type="$(xcrun simctl list devicetypes -j | node -e '
let raw=""; process.stdin.on("data",chunk=>raw+=chunk).on("end",()=>{
 const devices=JSON.parse(raw).devicetypes;
 const phone=devices.find(d=>d.name==="iPhone 17 Pro") || devices.find(d=>d.name==="iPhone 16 Pro");
 if(!phone) throw new Error("No supported iPhone simulator type");
 process.stdout.write(phone.identifier);
});')"
ui_runtime="$(xcrun simctl list runtimes -j | node -e '
let raw=""; process.stdin.on("data",chunk=>raw+=chunk).on("end",()=>{
 const runtime=JSON.parse(raw).runtimes.filter(r=>r.isAvailable && r.name.startsWith("iOS ")).sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}))[0];
 if(!runtime) throw new Error("No available iOS runtime");
 process.stdout.write(runtime.identifier);
});')"
ui_device="$(xcrun simctl create MoodTracker-UI "$ui_device_type" "$ui_runtime")"
trap 'xcrun simctl shutdown "$ui_device" >/dev/null 2>&1 || true; xcrun simctl delete "$ui_device" >/dev/null 2>&1 || true' EXIT
xcrun simctl boot "$ui_device"
xcrun simctl bootstatus "$ui_device" -b
# Install the exact compiled app and grant only the simulated microphone. This
# avoids a system permission alert obscuring the native stop/playback regression.
ui_app="$(node - "$ui_derived/Build/Products/Release-iphonesimulator" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const folder = process.argv[2];
const apps = fs.readdirSync(folder).filter(name => name.endsWith('.app'));
if (apps.length !== 1) throw new Error(`Expected one compiled app, got ${apps.length}`);
process.stdout.write(path.join(folder, apps[0]));
NODE
)"
xcrun simctl install "$ui_device" "$ui_app"
xcrun simctl privacy "$ui_device" grant microphone com.zhenyu.moodjournal.app
set +e
xcodebuild test -workspace "$ui_workspace" -scheme MoodTrackerUI \
  -configuration Release -destination "platform=iOS Simulator,id=$ui_device" \
  -derivedDataPath "$ui_derived" -resultBundlePath "$ui_logs/NativeUI.xcresult" \
  ONLY_ACTIVE_ARCH=YES ARCHS="$(uname -m)" \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' 2>&1 | tee "$ui_logs/native-ui.log"
ui_status=${PIPESTATUS[0]}
set -e
xcrun xcresulttool export attachments --path "$ui_logs/NativeUI.xcresult" --output-path "$ui_logs/screenshots" || true
xcrun xcresulttool get test-results summary --path "$ui_logs/NativeUI.xcresult" > "$ui_logs/native-ui-summary.json" || true
if [[ "$ui_status" != 0 ]]; then
  xcrun simctl spawn "$ui_device" log show --last 10m --style compact \
    --predicate 'process == "app"' > "$ui_logs/app-runtime.log" 2>&1 || true
  mkdir -p "$ui_logs/crashes"
  while IFS= read -r -d '' ui_crash; do
    if grep -q 'com.zhenyu.moodjournal.app' "$ui_crash"; then
      cp "$ui_crash" "$ui_logs/crashes/"
    fi
  done < <(find "$HOME/Library/Logs/DiagnosticReports" -type f -name '*.ips' -print0 2>/dev/null)
fi
exit "$ui_status"
