export const CHANGELOG = [
  {
    id: "2026-10-21",
    title: "Your cart, your Garage",
    items: [
      "Open the Garage from the map or briefing to equip any of the 13 upgrades.",
      "Bronze in Orientation Day, Showboating 101 and Ice Cream Weather unlocks one slot each.",
      "Each stack uses a slot. Swap freely between levels; three-heat loadouts stay locked until the level ends.",
      "Your character keeps their Garage across new runs. Random upgrade rewards have retired.",
      "Hunt Factory Settings by clearing all ten main levels with an empty Garage on every attempt.",
    ],
  },
  {
    id: "2026-10-20",
    title: "More control, clearer jumps",
    items: [
      "Vault Run: press R or tap RESTART anytime to retry the current heat from Ready.",
      "Owned upgrade details now open above the map and close with Escape or a tap outside.",
      "Open Settings for sound controls and Sheedy’s blue/orange colour-blind mode.",
      "What’s new keeps the latest changes here whenever you want to catch up.",
      "Big jumps stay below the HUD, and Rocket Booster gives a more useful kick.",
      "Achievement notices sit in the corner and stay visible when you skip a replay.",
    ],
  },
];
export function changelogEntries(settings, { all = false, entries = CHANGELOG } = {}) {
  if (all) return entries;
  if (!settings.data.lastSeenChangelog && settings.newPlayer) return entries.slice(0, 1);
  return entries.filter(entry => entry.id > settings.data.lastSeenChangelog);
}
