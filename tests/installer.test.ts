import { describe, expect, test } from "bun:test"
import {
  GLOBAL_RULE_DESCRIPTION,
  LOL_RULE_DESCRIPTION,
  linearMousePreset,
} from "../src/presets.ts"
import { install, mergeKarabinerRules } from "../src/installer.ts"
import {
  hasLinearMousePreset,
  inspectKarabinerRules,
  isKarabinerEngineReady,
} from "../src/diagnostics.ts"

describe("mergeKarabinerRules", () => {
  test("preserves unrelated settings and installs selected rules", () => {
    const source = {
      profiles: [
        {
          name: "Main",
          selected: true,
          devices: [{ identifiers: { vendor_id: 123 } }],
          complex_modifications: {
            rules: [{ description: "Keep me", manipulators: [] }],
          },
        },
      ],
    }

    const result = mergeKarabinerRules(source, ["lol", "global"])
    const profile = result.profiles as Array<Record<string, any>>
    const rules = profile[0]!.complex_modifications.rules

    expect(rules.map((rule: Record<string, unknown>) => rule.description)).toEqual([
      LOL_RULE_DESCRIPTION,
      GLOBAL_RULE_DESCRIPTION,
      "Keep me",
    ])
    expect(profile[0]!.devices).toEqual(source.profiles[0]!.devices)
    expect(source.profiles[0]!.complex_modifications.rules).toHaveLength(1)
  })

  test("is idempotent", () => {
    const once = mergeKarabinerRules({}, ["lol"])
    const twice = mergeKarabinerRules(once, ["lol"])
    expect(twice).toEqual(once)
  })

  test("keeps an independently installed managed rule", () => {
    const withLeague = mergeKarabinerRules({}, ["lol"])
    const withBoth = mergeKarabinerRules(withLeague, ["global"])
    const profiles = withBoth.profiles as Array<Record<string, any>>
    const descriptions = profiles[0]!.complex_modifications.rules.map(
      (rule: Record<string, unknown>) => rule.description,
    )
    expect(descriptions).toContain(LOL_RULE_DESCRIPTION)
    expect(descriptions).toContain(GLOBAL_RULE_DESCRIPTION)
  })

  test("global profile excludes the League game client", () => {
    const result = mergeKarabinerRules({}, ["global"])
    const profiles = result.profiles as Array<Record<string, any>>
    const rule = profiles[0]!.complex_modifications.rules[0]
    expect(rule.manipulators.every(
      (item: Record<string, any>) => item.conditions[0].type === "frontmost_application_unless",
    )).toBe(true)
  })

  test("League profile maps Alt-Tab to the macOS application switcher", () => {
    const result = mergeKarabinerRules({}, ["lol"])
    const profiles = result.profiles as Array<Record<string, any>>
    const altTab = profiles[0]!.complex_modifications.rules[0].manipulators[0]
    expect(altTab.from).toEqual({
      key_code: "tab",
      modifiers: { mandatory: ["option"], optional: ["any"] },
    })
    expect(altTab.to).toEqual([{ key_code: "tab", modifiers: ["command"] }])
  })

  test("migrates only the legacy conflicting simple modifiers", () => {
    const source = {
      profiles: [{
        name: "Default",
        selected: true,
        simple_modifications: [
          { from: { key_code: "left_control" }, to: [{ key_code: "left_command" }] },
          { from: { key_code: "caps_lock" }, to: [{ key_code: "escape" }] },
        ],
      }],
    }
    const result = mergeKarabinerRules(source, ["lol"])
    const profiles = result.profiles as Array<Record<string, any>>
    expect(profiles[0]!.simple_modifications).toEqual([
      { from: { key_code: "caps_lock" }, to: [{ key_code: "escape" }] },
    ])
  })

  test("removes the legacy unscoped League rule", () => {
    const source = {
      profiles: [{
        name: "Default",
        selected: true,
        complex_modifications: {
          rules: [{
            description: "League of Legends: use Command-position keys as Alt",
            manipulators: [],
          }],
        },
      }],
    }
    const result = mergeKarabinerRules(source, ["lol"])
    const profiles = result.profiles as Array<Record<string, any>>
    expect(profiles[0]!.complex_modifications.rules).toHaveLength(1)
    expect(profiles[0]!.complex_modifications.rules[0].description).toBe(LOL_RULE_DESCRIPTION)
  })
})

test("LinearMouse preset disables acceleration for mouse devices", () => {
  expect(linearMousePreset.schemes[0]!.if.device.category).toBe("mouse")
  expect(linearMousePreset.schemes[0]!.pointer.disableAcceleration).toBe(true)
})

test("installer rejects unknown components before making changes", async () => {
  await expect(install({ choices: ["invalid" as any], dryRun: true })).rejects.toThrow(
    "Unknown component: invalid",
  )
})

describe("system diagnostics", () => {
  test("detects disabled mouse acceleration", () => {
    expect(hasLinearMousePreset({
      schemes: [{ pointer: { disableAcceleration: true } }],
    })).toBe(true)
    expect(hasLinearMousePreset({ schemes: [] })).toBe(false)
  })

  test("detects managed rules in the selected Karabiner profile", () => {
    const config = mergeKarabinerRules({}, ["lol", "global"])
    expect(inspectKarabinerRules(config)).toEqual({
      lolRuleInstalled: true,
      globalRuleInstalled: true,
    })
  })

  test("detects virtual keyboard readiness", () => {
    expect(isKarabinerEngineReady({
      virtual_hid_devices_state: { virtual_hid_keyboard_ready: true },
    })).toBe(true)
    expect(isKarabinerEngineReady(undefined)).toBe(false)
  })
})
