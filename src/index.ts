import {
  BoxRenderable,
  TextRenderable,
  createCliRenderer,
  createTimeline,
  engine,
  type KeyEvent,
} from "@opentui/core"
import { install, type InstallChoice } from "./installer.ts"

const cliSelection = process.argv.find((arg) => arg.startsWith("--apply="))
if (cliSelection) {
  const choices = cliSelection.slice("--apply=".length).split(",") as InstallChoice[]
  await install({
    choices,
    dryRun: process.argv.includes("--dry-run"),
    onLog: console.log,
  })
  process.exit(0)
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  backgroundColor: "#070912",
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

const shell = new BoxRenderable(renderer, {
  id: "shell",
  position: "absolute",
  left: -18,
  width: 76,
  height: 24,
  borderStyle: "rounded",
  borderColor: "#4055ff",
  backgroundColor: "#0c1020",
  padding: 1,
  flexDirection: "column",
  gap: 1,
})

const eyebrow = new TextRenderable(renderer, {
  content: "  RIFT SYSTEMS  //  macOS LOADOUT",
  fg: "#ff3f70",
})
const title = new TextRenderable(renderer, {
  content: "MACOS  x  WINDOWS  x  LOL",
  fg: "#f4f7ff",
})
const subtitle = new TextRenderable(renderer, {
  content: "Choose the parts of the loadout you want to install.",
  fg: "#8994b8",
})
const accent = new BoxRenderable(renderer, {
  width: 12,
  height: 1,
  backgroundColor: "#ff3f70",
})
const menuText = new TextRenderable(renderer, { content: "", fg: "#dbe2ff" })
const detail = new TextRenderable(renderer, { content: "", fg: "#7f8cb5" })
const status = new TextRenderable(renderer, {
  content: "READY  Select modules, then deploy.",
  fg: "#58e6b2",
})
const footer = new TextRenderable(renderer, {
  content: "UP/DOWN navigate   SPACE toggle   ENTER install   Q quit",
  fg: "#596481",
})

shell.add(eyebrow)
shell.add(title)
shell.add(subtitle)
shell.add(accent)
shell.add(menuText)
shell.add(detail)
shell.add(status)
shell.add(footer)
renderer.root.add(shell)

function renderMenu() {
  menuText.content = choices
    .map((item, index) => {
      const pointer = index === cursor ? ">" : " "
      const check = item.selected ? "x" : " "
      return `${pointer} [${check}]  ${item.title}`
    })
    .join("\n\n")
  detail.content = `// ${choices[cursor]?.description ?? ""}`
}

function cleanup() {
  if (spinnerTimer) clearInterval(spinnerTimer)
  entrance.pause()
  pulse.pause()
  engine.unregister(entrance)
  engine.unregister(pulse)
  engine.detach()
}

async function deploy() {
  const selected = choices.filter((item) => item.selected).map((item) => item.id)
  if (selected.length === 0) {
    status.content = "BLOCKED  Select at least one module."
    status.fg = "#ffb454"
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
    status.fg = "#58e6b2"
  } catch (error) {
    status.content = `FAILED  ${error instanceof Error ? error.message : String(error)}`
    status.fg = "#ff5d7d"
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
  if (key.name === "up" || key.name === "k") cursor = (cursor + choices.length - 1) % choices.length
  else if (key.name === "down" || key.name === "j") cursor = (cursor + 1) % choices.length
  else if (key.name === "space") choices[cursor]!.selected = !choices[cursor]!.selected
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
entrance.add(shell, { left: 2, duration: 550, ease: "outBack" })

const pulse = createTimeline({ duration: 1800, loop: true, autoplay: false })
pulse.add(accent, {
  width: 56,
  duration: 900,
  ease: "inOutSine",
  alternate: true,
  loop: true,
})

renderMenu()
entrance.play()
pulse.play()
