#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIGURATION="${CONFIGURATION:-release}"
# The native SwiftPM backend looks for resources at the .app root or in the
# build directory. Xcode's accessor also searches Contents/Resources, so the
# signed app works after it is moved away from the build machine.
swift build --build-system xcode -c "$CONFIGURATION"
BIN_DIR="$(swift build --build-system xcode -c "$CONFIGURATION" --show-bin-path)"
APP="$PWD/build/YunHome.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/YunHome" "$APP/Contents/MacOS/YunHome"
# Sandboxed plugin scripts run in this helper, next to the app executable.
cp "$BIN_DIR/YunHomePluginHost" "$APP/Contents/MacOS/YunHomePluginHost"
# Resource bundles: the app's own and CuteACKit's (air conditioner model and font).
for BUNDLE in YunHome_YunHome CuteACKit_CuteACKit; do
  ditto "$BIN_DIR/$BUNDLE.bundle" "$APP/Contents/Resources/$BUNDLE.bundle"
done

# Reuse Home's existing brand artwork for the Dock and Finder icon.
ICONSET="$PWD/build/Home.iconset"
mkdir -p "$ICONSET"
for SIZE in 16 32 128 256 512; do
  sips -z "$SIZE" "$SIZE" ../../public/pwa-512x512.png --out "$ICONSET/icon_${SIZE}x${SIZE}.png" >/dev/null
  DOUBLE=$((SIZE * 2))
  sips -z "$DOUBLE" "$DOUBLE" ../../public/pwa-512x512.png --out "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Home.icns"

# Release tags are macos-v<VERSION>; the update check compares against this.
VERSION="${VERSION:-$(tr -d '[:space:]' < VERSION)}"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>YunHome</string>
  <key>CFBundleIdentifier</key><string>fun.yunle.home</string>
  <key>CFBundleName</key><string>云之彼端</string>
  <key>CFBundleDisplayName</key><string>云之彼端</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleIconFile</key><string>Home</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>NSLocalNetworkUsageDescription</key><string>查找并连接你家中的 Home Assistant，读取和控制已绑定的空调。</string>
  <key>NSBonjourServices</key><array><string>_home-assistant._tcp</string></array>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST

# Sign the helper first so the outer signature seals it.
codesign --force --sign - "$APP/Contents/MacOS/YunHomePluginHost"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
printf 'Built %s\n' "$APP"
