#!/bin/bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ha_context="${YUN_HOME_HA_CONTEXT:-colima}"
export YUN_HOME_HA_DATA="${YUN_HOME_HA_DATA:-$HOME/.local/share/yun-home/home-assistant}"
action="${1:-status}"

case "$action" in
  up|stop|restart|status|logs|config) ;;
  *) echo "Usage: $0 {up|stop|restart|status|logs|config}" >&2; exit 2 ;;
esac

if ! command -v docker >/dev/null; then
  echo 'Install Docker CLI and Colima: brew install docker colima docker-compose' >&2
  exit 1
fi
if docker compose version >/dev/null 2>&1; then
  compose=(docker --context "$ha_context" compose)
elif command -v docker-compose >/dev/null; then
  # Homebrew also ships Compose as a standalone executable.
  compose=(env DOCKER_CONTEXT="$ha_context" docker-compose)
else
  echo 'Install Compose: brew install docker-compose' >&2
  exit 1
fi
compose+=(-f "$repo_dir/infra/home-assistant/compose.yaml")

start_callback_alias() {
  if [[ -f "$YUN_HOME_HA_DATA/custom_components/xiaomi_home/manifest.json" ]]; then
    bash "$repo_dir/scripts/home-assistant-local-dns.sh" start
  fi
}

if [[ "$action" == config ]]; then
  "${compose[@]}" config --quiet
  exit
fi
if ! docker --context "$ha_context" info >/dev/null 2>&1; then
  echo "Docker context '$ha_context' is unavailable." >&2
  echo 'For the default Colima VM: colima start --activate=false' >&2
  exit 1
fi

case "$action" in
  up)
    # HA stores accounts, tokens, database and integrations here, outside Git.
    # Do not chmod an existing user-selected directory.
    if [[ ! -d "$YUN_HOME_HA_DATA" ]]; then
      (umask 077; mkdir -p "$YUN_HOME_HA_DATA")
    fi
    "${compose[@]}" up -d
    start_callback_alias
    echo 'Home Assistant: http://127.0.0.1:8123 (first startup may take a minute)'
    echo "Data: $YUN_HOME_HA_DATA"
    ;;
  stop)
    "${compose[@]}" stop
    bash "$repo_dir/scripts/home-assistant-local-dns.sh" stop
    ;;
  restart)
    "${compose[@]}" restart
    start_callback_alias
    ;;
  status)
    "${compose[@]}" ps
    bash "$repo_dir/scripts/home-assistant-local-dns.sh" status
    ;;
  logs) "${compose[@]}" logs --tail 80 --follow ;;
esac
