import {
  BoxRenderable,
  TextRenderable,
  createCliRenderer,
  createTimeline,
  engine,
  type KeyEvent,
} from "@opentui/core"
import { diagnoseSystem, type SystemDiagnostics } from "./diagnostics.ts"
import { install, type InstallChoice } from "./installer.ts"

const cliSelection = process.argv.find((arg) => arg.startsWith("--apply="))
if (cliSelection) {
  const homeArgument = process.argv.find((arg) => arg.startsWith("--home="))
  const choices = cliSelection.slice("--apply=".length).split(",") as InstallChoice[]
  await install({
    choices,
    dryRun: process.argv.includes("--dry-run"),
    openApps: homeArgument === undefined,
    onLog: console.log,
    ...(homeArgument ? { home: homeArgument.slice("--home=".length) } : {}),
  })
  process.exit(0)
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  backgroundColor: "#000000",
})
engine.attach(renderer)

const choices: Array<{
  id: InstallChoice
  title: string
  description: string
  selected: boolean
}> = [
  {
    id: "mouse",
    title: "MOUSE / LinearMouse",
    description: "No acceleration. Direct, predictable pointer movement.",
    selected: true,
  },
  {
    id: "lol",
    title: "RIFT / Karabiner",
    description: "Command-position key becomes Alt only during a LoL match.",
    selected: true,
  },
  {
    id: "global",
    title: "DESKTOP / Windows mode",
    description: "Ctrl-style shortcuts across macOS, excluding the LoL game.",
    selected: false,
  },
]

let cursor = 0
let installing = false
let spinnerTimer: ReturnType<typeof setInterval> | undefined
let selectionTimeline: ReturnType<typeof createTimeline> | undefined
let diagnosticTimeline: ReturnType<typeof createTimeline> | undefined

const shellWidth = Math.max(72, Math.min(112, renderer.width - 4))
const shellHeight = Math.max(22, Math.min(26, renderer.height))
const sidebarWidth = Math.max(24, Math.floor(shellWidth * 0.31))
const mainWidth = shellWidth - sidebarWidth - 6
const gaugeWidth = mainWidth - 4
const settledLeft = Math.max(0, Math.floor((renderer.width - shellWidth) / 2))

const shell = new BoxRenderable(renderer, {
  id: "shell",
  position: "absolute",
  left: -18,
  top: Math.max(0, Math.floor((renderer.height - shellHeight) / 2)),
  width: shellWidth,
  height: shellHeight,
  borderStyle: "double",
  borderColor: "#ffffff",
  backgroundColor: "#050505",
  padding: 1,
  flexDirection: "column",
  gap: 1,
})

const title = new TextRenderable(renderer, {
  content: "ARE YOU NORMAL OR A GAY MACOS USER?",
  fg: "#ffffff",
})
const subtitle = new TextRenderable(renderer, {
  content: "SELECT MORE. LEAVE GAY MACOS BEHIND.",
  fg: "#8c8c8c",
})
const body = new BoxRenderable(renderer, {
  width: "100%",
  flexGrow: 1,
  flexDirection: "row",
  gap: 2,
})
const mainPanel = new BoxRenderable(renderer, {
  width: mainWidth,
  height: "100%",
  borderStyle: "single",
  borderColor: "#686868",
  title: " LOADOUT ",
  titleColor: "#ffffff",
  bottomTitle: " SPACE SELECT / ENTER DEPLOY ",
  bottomTitleAlignment: "right",
  padding: 1,
  flexDirection: "column",
  gap: 1,
})
const gauge = new BoxRenderable(renderer, {
  width: gaugeWidth,
  height: 1,
  backgroundColor: "#242424",
})
const meter = new BoxRenderable(renderer, {
  width: 4,
  height: 1,
  backgroundColor: "#ffffff",
})
gauge.add(meter)
const gaugeLabel = new TextRenderable(renderer, { content: "", fg: "#bdbdbd" })
const menuText = new TextRenderable(renderer, { content: "", fg: "#ffffff" })
const detail = new TextRenderable(renderer, { content: "", fg: "#8c8c8c" })
const status = new TextRenderable(renderer, {
  content: "READY  Build your loadout, then deploy.",
  fg: "#d8d8d8",
})
const sidebar = new BoxRenderable(renderer, {
  width: sidebarWidth,
  height: "100%",
  borderStyle: "single",
  borderColor: "#686868",
  title: " HOST STATE ",
  titleColor: "#ffffff",
  bottomTitle: " R RESCAN ",
  bottomTitleAlignment: "right",
  padding: 1,
  flexDirection: "column",
  gap: 1,
})
const diagnosticSweep = new BoxRenderable(renderer, {
  width: 3,
  height: 1,
  backgroundColor: "#ffffff",
})
const diagnosticText = new TextRenderable(renderer, {
  content: "[??] SCANNING HOST...",
  fg: "#bdbdbd",
})
const footer = new TextRenderable(renderer, {
  content: "UP/DOWN navigate   SPACE toggle   ENTER install   R rescan   Q quit",
  fg: "#666666",
})

mainPanel.add(gauge)
mainPanel.add(gaugeLabel)
mainPanel.add(menuText)
mainPanel.add(detail)
mainPanel.add(status)
sidebar.add(diagnosticSweep)
sidebar.add(diagnosticText)
body.add(mainPanel)
body.add(sidebar)
shell.add(title)
shell.add(subtitle)
shell.add(body)
shell.add(footer)
renderer.root.add(shell)

function mark(value: boolean): string {
  return value ? "[OK]" : "[--]"
}

function renderDiagnostics(result: SystemDiagnostics) {
  diagnosticText.content = [
    `${mark(result.linearMouseInstalled)} LINEARMOUSE`,
    `${mark(result.linearMouseConfigured)} NO ACCEL`,
    "",
    `${mark(result.karabinerInstalled)} KARABINER`,
    `${mark(result.karabinerReady)} ENGINE READY`,
    "",
    `${mark(result.lolRuleInstalled)} LOL PROFILE`,
    `${mark(result.globalRuleInstalled)} DESKTOP PROFILE`,
    "",
    `HOST  ${process.arch.toUpperCase()}`,
    "R     RESCAN",
  ].join("\n")
}

async function refreshDiagnostics() {
  diagnosticText.content = "[>>] SCANNING HOST..."
  if (diagnosticTimeline) {
    diagnosticTimeline.pause()
    engine.unregister(diagnosticTimeline)
  }
  diagnosticSweep.width = 3
  diagnosticTimeline = createTimeline({ duration: 420, autoplay: false })
  diagnosticTimeline.add(diagnosticSweep, {
    width: sidebarWidth - 4,
    duration: 420,
    ease: "outExpo",
  })
  diagnosticTimeline.play()
  renderDiagnostics(await diagnoseSystem())
}

function updateGauge(animate: boolean) {
  const selectedCount = choices.filter((item) => item.selected).length
  const stockRemaining = Math.round(100 - (selectedCount / choices.length) * 100)
  const labels = [
    "100% GAY MACOS  //  FACTORY CONDITION",
    " 67% GAY MACOS  //  FIRST SIGNS OF RECOVERY",
    " 33% GAY MACOS  //  ALMOST NORMAL",
    "  0% GAY MACOS  //  NORMAL MODE UNLOCKED",
  ]
  const targetWidth = Math.max(3, Math.round((selectedCount / choices.length) * gaugeWidth))
  const meterColor = stockRemaining === 100
    ? "#ff4fa3"
    : stockRemaining > 50
      ? "#9457eb"
      : "#2684ff"
  gaugeLabel.content = labels[selectedCount] ?? labels[0]!
  meter.backgroundColor = meterColor

  if (!animate) {
    meter.width = targetWidth
    return
  }

  if (selectionTimeline) {
    selectionTimeline.pause()
    engine.unregister(selectionTimeline)
  }
  selectionTimeline = createTimeline({ duration: 360, autoplay: false })
  selectionTimeline.add(meter, {
    width: targetWidth,
    duration: 360,
    ease: "outBack",
  })
  selectionTimeline.play()
  status.content = `${stockRemaining}% GAY MACOS REMAINING`
  status.fg = "#d8d8d8"
}

function renderMenu(animateGauge?: boolean) {
  menuText.content = choices
    .map((item, index) => {
      const pointer = index === cursor ? ">" : " "
      const check = item.selected ? "ON " : "OFF"
      return `${pointer} [${check}]  ${item.title}`
    })
    .join("\n\n")
  detail.content = `// ${choices[cursor]?.description ?? ""}`
  if (animateGauge !== undefined) updateGauge(animateGauge)
}

function cleanup() {
  if (spinnerTimer) clearInterval(spinnerTimer)
  if (selectionTimeline) {
    selectionTimeline.pause()
    engine.unregister(selectionTimeline)
  }
  if (diagnosticTimeline) {
    diagnosticTimeline.pause()
    engine.unregister(diagnosticTimeline)
  }
  entrance.pause()
  engine.unregister(entrance)
  engine.detach()
}

async function deploy() {
  const selected = choices.filter((item) => item.selected).map((item) => item.id)
  if (selected.length === 0) {
    status.content = "BLOCKED  Select at least one module."
    status.fg = "#ffffff"
    return
  }

  installing = true
  let frame = 0
  const spinner = ["|", "/", "-", "\\"]
  spinnerTimer = setInterval(() => {
    status.content = `${spinner[frame++ % spinner.length]}  DEPLOYING LOADOUT...`
  }, 90)

  try {
    await install({
      choices: selected,
      onLog(message) {
        status.content = `> ${message}`
      },
    })
    status.content = "ONLINE  Loadout installed. Open Karabiner Setup if prompted."
    status.fg = "#ffffff"
    await refreshDiagnostics()
  } catch (error) {
    status.content = `FAILED  ${error instanceof Error ? error.message : String(error)}`
    status.fg = "#ffffff"
  } finally {
    if (spinnerTimer) clearInterval(spinnerTimer)
    spinnerTimer = undefined
    installing = false
  }
}

const onKeyPress = (key: KeyEvent) => {
  if (installing) return
  if (key.name === "q" || key.name === "escape") {
    renderer.destroy()
    return
  }
  if (key.name === "r") {
    void refreshDiagnostics()
    return
  }
  if (key.name === "up" || key.name === "k") cursor = (cursor + choices.length - 1) % choices.length
  else if (key.name === "down" || key.name === "j") cursor = (cursor + 1) % choices.length
  else if (key.name === "space") {
    choices[cursor]!.selected = !choices[cursor]!.selected
    renderMenu(true)
    return
  }
  else if (key.name === "return") void deploy()
  else return
  renderMenu()
}

renderer.keyInput.on("keypress", onKeyPress)
renderer.once("destroy", () => {
  renderer.keyInput.off("keypress", onKeyPress)
  cleanup()
})

const entrance = createTimeline({ duration: 550, autoplay: false })
entrance.add(shell, { left: settledLeft, duration: 550, ease: "outExpo" })

renderMenu(false)
entrance.play()
await refreshDiagnostics()
