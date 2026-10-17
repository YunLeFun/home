#!/bin/bash
set -euo pipefail

# Official stable release, independently checked against its Git tag.
xiaomi_version=v0.5.0
xiaomi_commit=75b3acb6325a3a8d295688b13904737d6738a6a5
ha_data="${YUN_HOME_HA_DATA:-$HOME/.local/share/yun-home/home-assistant}"
source_dir="${YUN_HOME_XIAOMI_SOURCE:-$HOME/.local/share/yun-home/integrations/ha_xiaomi_home-$xiaomi_version}"

if [[ ! -d "$ha_data" ]]; then
  echo 'Start Home Assistant first: bash scripts/home-assistant.sh up' >&2
  exit 1
fi
if [[ ! -d "$source_dir" ]]; then
  mkdir -p "$(dirname -- "$source_dir")"
  git clone --depth 1 --branch "$xiaomi_version" https://github.com/XiaoMi/ha_xiaomi_home.git "$source_dir"
fi
if [[ "$(git -C "$source_dir" rev-parse HEAD)" != "$xiaomi_commit" ]] ||
   [[ -n "$(git -C "$source_dir" status --porcelain)" ]]; then
  echo 'Xiaomi source does not match the pinned, unmodified official release.' >&2
  exit 1
fi

python3 - "$source_dir" "$ha_data" <<'PY'
import json
from pathlib import Path
import shutil
import sys

source = Path(sys.argv[1]) / "custom_components/xiaomi_home"
target = Path(sys.argv[2]) / "custom_components/xiaomi_home"
manifest = json.loads((source / "manifest.json").read_text())
if manifest["domain"] != "xiaomi_home" or manifest["version"] != "v0.5.0":
    raise SystemExit("Unexpected Xiaomi integration manifest")
if target.exists():
    # Idempotent for this release; leave any other installation untouched.
    expected = {p.relative_to(source): p.read_bytes() for p in source.rglob("*") if p.is_file()}
    installed = {p.relative_to(target): p.read_bytes() for p in target.rglob("*")
                 if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"}
    if expected != installed:
        raise SystemExit("An existing Xiaomi installation differs; back it up before updating")
    print("Official Xiaomi Home v0.5.0 is already installed; no files changed.")
else:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, target)
    print(f"Installed official Xiaomi Home v0.5.0 to {target}")
PY
echo 'Restart HA to load it: bash scripts/home-assistant.sh restart'
