#!/usr/bin/env bash
# Pack a plugin source folder (manifest.json, state.js, controls.json) into a
# reproducible .yunplugin and print its SHA-256 for catalog.json.
#   bash apps/macos/scripts/pack-plugin.sh apps/macos/PluginSources/electric-fan apps/macos/Sources/YunHome/Resources/Plugins/electric-fan.yunplugin
set -euo pipefail
source_dir=$(cd "$1" && pwd)
output=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
for file in manifest.json state.js controls.json; do cp "$source_dir/$file" "$staging/$file"; done
TZ=UTC touch -t 202001010000 "$staging"/*
rm -f "$output"
(cd "$staging" && TZ=UTC zip -X -D -q "$output" manifest.json state.js controls.json)
shasum -a 256 "$output" | cut -d' ' -f1
