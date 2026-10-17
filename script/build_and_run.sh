#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "$0")/.." && pwd)"
mode="${1:-run}"
case "$mode" in run|--verify|--debug|--logs|--telemetry) ;; *) echo "Usage: $0 [--verify|--debug|--logs|--telemetry]" >&2; exit 2 ;; esac
pkill -x YunHome >/dev/null 2>&1 || true
CONFIGURATION=debug bash "$root_dir/apps/macos/scripts/bundle.sh"
app_bundle="$root_dir/apps/macos/build/YunHome.app"
if [[ "$mode" == --debug ]]; then
  exec lldb -- "$app_bundle/Contents/MacOS/YunHome"
fi
/usr/bin/open -n "$app_bundle"
case "$mode" in
  --verify) sleep 1; pgrep -x YunHome >/dev/null; echo 'YunHome launched successfully.' ;;
  --logs) /usr/bin/log stream --info --style compact --predicate 'process == "YunHome"' ;;
  --telemetry) /usr/bin/log stream --info --style compact --predicate 'subsystem == "fun.yunle.home"' ;;
esac
