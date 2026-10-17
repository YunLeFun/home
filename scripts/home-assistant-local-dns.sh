#!/bin/bash
set -euo pipefail

# Xiaomi's registered OAuth callback uses homeassistant.local:8123.
# Register it only with macOS's LocalOnly interface, never on the LAN.
[[ "$(uname -s)" == Darwin ]] || exit 0
dns_label=fun.yunle.home.ha-local-dns
dns_domain="gui/$(id -u)"
runtime_dir="$HOME/.local/share/yun-home/runtime"
dns_plist="$runtime_dir/$dns_label.plist"

case "${1:-status}" in
  start)
    if launchctl print "$dns_domain/$dns_label" >/dev/null 2>&1; then
      echo 'Local HA callback name is registered for this login session.'
      exit
    fi
    (umask 077; mkdir -p "$runtime_dir")
    python3 - "$dns_plist" "$dns_label" "$runtime_dir" <<'PY'
from pathlib import Path
import plistlib
import sys

target, label, runtime = sys.argv[1:]
Path(target).write_bytes(plistlib.dumps({
    "Label": label,
    "ProgramArguments": [
        "/usr/bin/dns-sd", "-lo", "-P", "Yun Home HA (This Mac)",
        "_home-assistant._tcp", "local", "8123", "homeassistant.local", "127.0.0.1",
        "internal_url=http://127.0.0.1:8123",
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
    echo 'Registered homeassistant.local → 127.0.0.1, on this Mac only.'
    ;;
  stop)
    if launchctl print "$dns_domain/$dns_label" >/dev/null 2>&1; then
      launchctl bootout "$dns_domain/$dns_label"
    fi
    ;;
  status)
    if launchctl print "$dns_domain/$dns_label" >/dev/null 2>&1; then
      echo 'Local callback alias: http://homeassistant.local:8123 (this login session)'
    else
      echo 'Local callback alias: stopped'
    fi
    ;;
  *) echo "Usage: $0 {start|stop|status}" >&2; exit 2 ;;
esac
