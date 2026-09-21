#!/bin/bash

set -euo pipefail

readonly key_prefix="com.apple.keyboard.modifiermapping."

usage() {
  printf 'Usage:\n'
  printf '  %s list\n' "$0"
  printf '  %s reset %sVENDOR-PRODUCT-LOCATION\n' "$0" "$key_prefix"
}

list_mappings() {
  local preferences
  local keys

  preferences="$(defaults -currentHost read NSGlobalDomain 2>/dev/null || true)"
  keys="$(printf '%s\n' "$preferences" | sed -n 's/^    "\(com\.apple\.keyboard\.modifiermapping\.[^"]*\)" =.*/\1/p')"

  if [[ -z "$keys" ]]; then
    printf 'No custom per-device modifier mappings found.\n'
    return
  fi

  printf 'Custom per-device modifier mappings:\n'
  while IFS= read -r key; do
    printf '\n%s\n' "$key"
    defaults -currentHost read NSGlobalDomain "$key"
  done <<< "$keys"
}

reset_mapping() {
  local key="${1:-}"
  local answer

  if [[ ! "$key" =~ ^com\.apple\.keyboard\.modifiermapping\.[0-9]+-[0-9]+-[0-9]+$ ]]; then
    printf 'Invalid mapping key: %s\n' "$key" >&2
    usage >&2
    exit 2
  fi

  if ! defaults -currentHost read NSGlobalDomain "$key" >/dev/null 2>&1; then
    printf 'Mapping not found: %s\n' "$key" >&2
    exit 1
  fi

  printf 'This will restore the default modifier keys for:\n  %s\n' "$key"
  printf 'Continue? [y/N] '
  IFS= read -r answer
  if [[ ! "$answer" =~ ^[Yy]$ ]]; then
    printf 'Cancelled.\n'
    return
  fi

  defaults -currentHost delete NSGlobalDomain "$key"
  printf 'Mapping removed. Reconnect the keyboard if the change is not immediate.\n'
}

case "${1:-}" in
  list)
    list_mappings
    ;;
  reset)
    reset_mapping "${2:-}"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
