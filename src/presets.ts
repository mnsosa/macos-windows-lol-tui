export const LEAGUE_BUNDLE_PATTERN = "^com\\.riotgames\\.LeagueofLegends\\.GameClient$"

export const LOL_RULE_DESCRIPTION = "League of Legends: Command-position keys act as Alt"
export const GLOBAL_RULE_DESCRIPTION = "Outside League: Windows-style modifier positions"

const leagueCondition = {
  type: "frontmost_application_if",
  bundle_identifiers: [LEAGUE_BUNDLE_PATTERN],
}

const outsideLeagueCondition = {
  type: "frontmost_application_unless",
  bundle_identifiers: [LEAGUE_BUNDLE_PATTERN],
}

function modifier(from: string, to: string, condition: Record<string, unknown>) {
  return {
    type: "basic",
    from: { key_code: from, modifiers: { optional: ["any"] } },
    to: [{ key_code: to }],
    conditions: [condition],
  }
}

export const lolRule = {
  description: LOL_RULE_DESCRIPTION,
  manipulators: [
    modifier("left_command", "left_option", leagueCondition),
    modifier("right_command", "right_option", leagueCondition),
  ],
}

export const globalWindowsRule = {
  description: GLOBAL_RULE_DESCRIPTION,
  manipulators: [
    modifier("left_control", "left_command", outsideLeagueCondition),
    modifier("left_command", "left_control", outsideLeagueCondition),
    modifier("right_command", "left_option", outsideLeagueCondition),
  ],
}

export const linearMousePreset = {
  $schema: "https://schema.linearmouse.app/0.10.4",
  schemes: [
    {
      if: { device: { category: "mouse" } },
      pointer: { disableAcceleration: true },
    },
  ],
}
