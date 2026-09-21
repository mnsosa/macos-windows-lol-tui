import { readFile, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { GLOBAL_RULE_DESCRIPTION, LOL_RULE_DESCRIPTION } from "./presets.ts"

type JsonObject = Record<string, unknown>

export interface SystemDiagnostics {
  linearMouseInstalled: boolean
  linearMouseConfigured: boolean
  karabinerInstalled: boolean
  karabinerReady: boolean
  lolRuleInstalled: boolean
  globalRuleInstalled: boolean
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch {
    return undefined
  }
}

export function hasLinearMousePreset(source: unknown): boolean {
  if (!isObject(source) || !Array.isArray(source.schemes)) return false
  return source.schemes.some((scheme) => {
    if (!isObject(scheme) || !isObject(scheme.pointer)) return false
    return scheme.pointer.disableAcceleration === true
  })
}

export function inspectKarabinerRules(source: unknown) {
  if (!isObject(source) || !Array.isArray(source.profiles)) {
    return { lolRuleInstalled: false, globalRuleInstalled: false }
  }

  const profile = source.profiles.find((item) => isObject(item) && item.selected === true)
  if (!isObject(profile) || !isObject(profile.complex_modifications)) {
    return { lolRuleInstalled: false, globalRuleInstalled: false }
  }
  const rules = Array.isArray(profile.complex_modifications.rules)
    ? profile.complex_modifications.rules
    : []
  const descriptions = new Set(
    rules.filter(isObject).map((rule) => String(rule.description ?? "")),
  )
  return {
    lolRuleInstalled: descriptions.has(LOL_RULE_DESCRIPTION),
    globalRuleInstalled: descriptions.has(GLOBAL_RULE_DESCRIPTION),
  }
}

export function isKarabinerEngineReady(source: unknown): boolean {
  if (!isObject(source) || !isObject(source.virtual_hid_devices_state)) return false
  return source.virtual_hid_devices_state.virtual_hid_keyboard_ready === true
}

export async function diagnoseSystem(home = homedir()): Promise<SystemDiagnostics> {
  const linearConfig = await readJson(join(home, ".config/linearmouse/linearmouse.json"))
  const karabinerConfig = await readJson(join(home, ".config/karabiner/karabiner.json"))
  const karabinerState = await readJson(
    "/Library/Application Support/org.pqrs/tmp/karabiner_grabber_manipulator_environment.json",
  )
  const rules = inspectKarabinerRules(karabinerConfig)

  return {
    linearMouseInstalled: await exists("/Applications/LinearMouse.app"),
    linearMouseConfigured: hasLinearMousePreset(linearConfig),
    karabinerInstalled: await exists("/Applications/Karabiner-Elements.app"),
    karabinerReady: isKarabinerEngineReady(karabinerState),
    ...rules,
  }
}
