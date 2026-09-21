import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import {
  GLOBAL_RULE_DESCRIPTION,
  LOL_RULE_DESCRIPTION,
  globalWindowsRule,
  linearMousePreset,
  lolRule,
} from "./presets.ts"

export type InstallChoice = "mouse" | "lol" | "global"

export interface InstallOptions {
  choices: InstallChoice[]
  dryRun?: boolean
  home?: string
  onLog?: (message: string) => void
  openApps?: boolean
}

type JsonObject = Record<string, unknown>

const legacySimpleModifiers = new Set([
  "left_command:left_control",
  "left_control:left_command",
  "right_command:left_option",
])
const legacyRuleDescriptions = new Set([
  "League of Legends: use Command-position keys as Alt",
])

const appPaths = {
  mouse: "/Applications/LinearMouse.app",
  karabiner: "/Applications/Karabiner-Elements.app",
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

function timestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")
}

async function run(command: string, args: string[], log: (message: string) => void, dryRun: boolean) {
  log(`$ ${[command, ...args].join(" ")}`)
  if (dryRun) return

  const process = Bun.spawn([command, ...args], { stdout: "pipe", stderr: "pipe" })
  const [exitCode, , stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `${command} exited with status ${exitCode}`)
  }
}

async function backup(path: string, backupRoot: string, dryRun: boolean, log: (message: string) => void) {
  if (!(await exists(path))) return

  const target = join(backupRoot, path.split("/").at(-1) ?? "config.json")
  log(`Backup: ${target}`)
  if (dryRun) return
  await mkdir(dirname(target), { recursive: true })
  await cp(path, target)
}

async function ensureApp(
  path: string,
  cask: string,
  dryRun: boolean,
  log: (message: string) => void,
) {
  if (await exists(path)) {
    log(`${cask} is already installed`)
    return
  }

  if (!Bun.which("brew")) {
    throw new Error(`Homebrew is required to install ${cask}: https://brew.sh`)
  }
  await run("brew", ["install", "--cask", cask], log, dryRun)
}

export function mergeKarabinerRules(
  source: unknown,
  choices: InstallChoice[],
): JsonObject {
  const config: JsonObject = isObject(source) ? structuredClone(source) : {}
  const profiles = Array.isArray(config.profiles) ? config.profiles : []
  let profile = profiles.find((item) => isObject(item) && item.selected === true)

  if (!isObject(profile)) {
    profile = { name: "Default profile", selected: true }
    profiles.push(profile)
  }

  if (Array.isArray(profile.simple_modifications)) {
    const simpleModifications: unknown[] = profile.simple_modifications
    profile.simple_modifications = simpleModifications.filter((item) => {
      if (!isObject(item) || !isObject(item.from) || !Array.isArray(item.to)) return true
      const destination = item.to[0]
      if (!isObject(destination)) return true
      return !legacySimpleModifiers.has(`${String(item.from.key_code)}:${String(destination.key_code)}`)
    })
  }

  const complex = isObject(profile.complex_modifications)
    ? profile.complex_modifications
    : {}
  const rules: unknown[] = Array.isArray(complex.rules) ? complex.rules : []
  const managed = new Set<string>()
  if (choices.includes("lol")) managed.add(LOL_RULE_DESCRIPTION)
  if (choices.includes("global")) managed.add(GLOBAL_RULE_DESCRIPTION)
  const nextRules = rules.filter(
    (rule) => !isObject(rule)
      || (!managed.has(String(rule.description ?? ""))
        && !legacyRuleDescriptions.has(String(rule.description ?? ""))),
  )

  if (choices.includes("global")) nextRules.unshift(globalWindowsRule)
  if (choices.includes("lol")) nextRules.unshift(lolRule)

  complex.rules = nextRules
  profile.complex_modifications = complex
  config.profiles = profiles
  return config
}

async function installMouse(
  home: string,
  backupRoot: string,
  dryRun: boolean,
  log: (message: string) => void,
  openApps: boolean,
) {
  log("Installing Windows-like mouse behavior")
  await ensureApp(appPaths.mouse, "linearmouse", dryRun, log)

  const configPath = join(home, ".config/linearmouse/linearmouse.json")
  await backup(configPath, backupRoot, dryRun, log)
  log(`Write: ${configPath}`)
  if (!dryRun) {
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(configPath, `${JSON.stringify(linearMousePreset, null, 2)}\n`)
  }

  if (openApps) {
    await run("pkill", ["-x", "LinearMouse"], log, dryRun).catch(() => undefined)
    await run("open", ["-a", "LinearMouse"], log, dryRun)
  }
}

async function installKeyboard(
  choices: InstallChoice[],
  home: string,
  backupRoot: string,
  dryRun: boolean,
  log: (message: string) => void,
  openApps: boolean,
) {
  log("Installing Karabiner keyboard profiles")
  await ensureApp(appPaths.karabiner, "karabiner-elements", dryRun, log)

  const configPath = join(home, ".config/karabiner/karabiner.json")
  await backup(configPath, backupRoot, dryRun, log)

  let current: unknown = {}
  if (await exists(configPath)) {
    current = JSON.parse(await readFile(configPath, "utf8"))
  }
  const merged = mergeKarabinerRules(current, choices)
  log(`Write: ${configPath}`)
  if (!dryRun) {
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`)
  }

  if (openApps) {
    await run("open", ["-a", "Karabiner-Elements"], log, dryRun)
    log("Authorize every item shown in Karabiner > Setup")
  }
}

export async function install(options: InstallOptions): Promise<void> {
  if (process.platform !== "darwin") throw new Error("This installer only supports macOS")
  if (options.choices.length === 0) throw new Error("Select at least one component")
  const validChoices = new Set<InstallChoice>(["mouse", "lol", "global"])
  const invalidChoice = options.choices.find((choice) => !validChoices.has(choice))
  if (invalidChoice) throw new Error(`Unknown component: ${invalidChoice}`)

  const home = options.home ?? homedir()
  const dryRun = options.dryRun ?? false
  const log = options.onLog ?? (() => undefined)
  const openApps = options.openApps ?? true
  const backupRoot = join(home, ".config/macos-windows-lol-tui/backups", timestamp())

  if (options.choices.includes("mouse")) {
    await installMouse(home, backupRoot, dryRun, log, openApps)
  }
  if (options.choices.includes("lol") || options.choices.includes("global")) {
    await installKeyboard(options.choices, home, backupRoot, dryRun, log, openApps)
  }

  log(dryRun ? "Dry run complete; no changes were made" : "Installation complete")
}
