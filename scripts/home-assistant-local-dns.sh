#!/bin/bash
set -euo pipefail

# Xiaomi's registered OAuth callback uses homeassistant.local:8123.
# Register it only with macOS's LocalOnly interface, never on the LAN.
[[ "$(uname -s)" == Darwin ]] || exit 0
dns_label=fun.yunle.home.ha-local-dns
dns_domain="gui/$(id -u)"
runtime_dir="$HOME/.local/share/yun-home/runtime"
dns_plist="$runtime_dir/$dns_label.plist"
dns_helper="$runtime_dir/home-assistant-local-dns.py"
source_helper="$(cd "$(dirname "$0")" && pwd)/home-assistant-local-dns.py"

case "${1:-status}" in
  start)
    if launchctl print "$dns_domain/$dns_label" >/dev/null 2>&1; then
      if cmp -s "$source_helper" "$dns_helper" && /usr/bin/python3 "$dns_helper" --check; then
        echo 'Local callback DNS verified (IPv4 and IPv6).'
        exit
      fi
      launchctl bootout "$dns_domain/$dns_label"
    fi
    (umask 077; mkdir -p "$runtime_dir")
    cp "$source_helper" "$dns_helper"
    chmod 600 "$dns_helper"
    python3 - "$dns_plist" "$dns_label" "$runtime_dir" <<'PY'
from pathlib import Path
import plistlib
import sys

target, label, runtime = sys.argv[1:]
Path(target).write_bytes(plistlib.dumps({
    "Label": label,
    "ProgramArguments": [
        "/usr/bin/python3", f"{runtime}/home-assistant-local-dns.py",
    ],
    "RunAtLoad": True,
    "KeepAlive": True,
    "ThrottleInterval": 10,
    "StandardOutPath": f"{runtime}/ha-local-dns.log",
    "StandardErrorPath": f"{runtime}/ha-local-dns-error.log",
}))
PY
    # This plist is outside Library/LaunchAgents: no automatic login item.
    launchctl bootstrap "$dns_domain" "$dns_plist"
    sleep 1
    if ! /usr/bin/python3 "$dns_helper" --check; then
      echo "Local callback DNS is not ready; see $runtime_dir/ha-local-dns-error.log" >&2
      exit 1
    fi
    echo 'Verified homeassistant.local → 127.0.0.1 / ::1, on this Mac only.'
    ;;
  stop)
    if launchctl print "$dns_domain/$dns_label" >/dev/null 2>&1; then
      launchctl bootout "$dns_domain/$dns_label"
    fi
    ;;
  status)
    if launchctl print "$dns_domain/$dns_label" >/dev/null 2>&1 && /usr/bin/python3 "$source_helper" --check; then
      echo 'Local callback alias: http://homeassistant.local:8123 (IPv4/IPv6 verified)'
    else
      echo 'Local callback alias: stopped or unhealthy; run start to repair.'
      exit 1
    fi
    ;;
  *) echo "Usage: $0 {start|stop|status}" >&2; exit 2 ;;
esac
