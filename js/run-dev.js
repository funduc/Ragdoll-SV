import {
  CONDITION_IDS,
  OBJECTIVE_IDS,
  UPGRADE_IDS,
  normalizeUpgrades,
} from "./run-config.js";

// Explicit opt-in URL mode. It changes only Vault Run and uses memory-only saves.
// Example: ?vaultdev=1&seed=42&condition=crosswind&upgrades=impact-harness:1
export function readRunDeveloperSettings(search = "") {
  const query = new URLSearchParams(search);
  if (query.get("vaultdev") !== "1") return null;
  const rawSeed = Number(query.get("seed") ?? 1);
  const condition = query.get("condition");
  const objective = query.get("objective");
  const upgrades = {};
  for (const token of (query.get("upgrades") || "").split(",")) {
    const [id, count = "1"] = token.split(":");
    if (UPGRADE_IDS.includes(id)) upgrades[id] = Number(count);
  }
  return Object.freeze({
    seed: Number.isInteger(rawSeed) ? rawSeed >>> 0 : 1,
    condition: CONDITION_IDS.includes(condition)
      ? condition
      : condition === "none"
        ? null
        : undefined,
    objective: OBJECTIVE_IDS.includes(objective) ? objective : undefined,
    upgrades: Object.freeze(normalizeUpgrades(upgrades)),
  });
}
