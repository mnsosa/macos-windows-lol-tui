#!/bin/bash

set -euo pipefail

readonly key_prefix="com.apple.keyboard.modifiermapping."

usage() {
  printf 'Usage:\n'
  printf '  %s list\n' "$0"
  printf '  %s reset %sVENDOR-PRODUCT-LOCATION\n' "$0" "$key_prefix"
}

warn_karabiner() {
  local config="$HOME/.config/karabiner/karabiner.json"

  if [[ -f "$config" ]] && grep -Eq '"key_code": "(left|right)_(command|control|option)"' "$config"; then
    printf '\nWarning: Karabiner also remaps modifier keys in:\n  %s\n' "$config" >&2
    printf 'Review its Simple Modifications; they can override this macOS mapping.\n' >&2
  fi
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

  warn_karabiner
}

reset_mapping() {
  local key="${1:-}"
  local answer
  local vendor_id
  local product_id
  local identity_mapping

  if [[ ! "$key" =~ ^com\.apple\.keyboard\.modifiermapping\.([0-9]+)-([0-9]+)-[0-9]+$ ]]; then
    printf 'Invalid mapping key: %s\n' "$key" >&2
    usage >&2
    exit 2
  fi

  vendor_id="${BASH_REMATCH[1]}"
  product_id="${BASH_REMATCH[2]}"

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

  osascript -e 'tell application "System Settings" to quit' 2>/dev/null || true

  identity_mapping='({HIDKeyboardModifierMappingSrc=30064771296;HIDKeyboardModifierMappingDst=30064771296;},{HIDKeyboardModifierMappingSrc=30064771299;HIDKeyboardModifierMappingDst=30064771299;},{HIDKeyboardModifierMappingSrc=30064771300;HIDKeyboardModifierMappingDst=30064771300;},{HIDKeyboardModifierMappingSrc=30064771303;HIDKeyboardModifierMappingDst=30064771303;})'
  defaults -currentHost write NSGlobalDomain "$key" "$identity_mapping"

  hidutil property \
    --matching "{\"VendorID\":$vendor_id,\"ProductID\":$product_id,\"PrimaryUsagePage\":1,\"PrimaryUsage\":6}" \
    --set '{"HIDKeyboardModifierMappingPairs":[]}' >/dev/null

  printf 'Default modifier keys saved and applied to the connected keyboard.\n'
  warn_karabiner
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
