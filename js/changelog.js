export const CHANGELOG = [
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
