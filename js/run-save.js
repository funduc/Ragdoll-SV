import { CHARACTERS } from "./characters.js";
import { ALL_LEVELS as LEVELS, levelById } from "./campaign-levels.js";
import {
  CONDITION_IDS,
  UPGRADE_IDS,
  OBJECTIVE_IDS,
  UPGRADES,
  normalizeUpgrades,
} from "./run-config.js";
import { newRunSeed, seededShuffle } from "./run-random.js";
import { AchievementManager } from "./achievements.js";
export { ACHIEVEMENT_SAVE_KEY, normalizeAchievements } from "./achievements.js";

// Companion keys preserve the existing version-1 medal save byte-for-byte.
// The central achievement manager migrates the separate badge key to v2.
export const RUN_SAVE_KEY = "santor-vault:run";
const characterExists = (id) => CHARACTERS.some((c) => c.id === id);
const validLevelIds = LEVELS.map((l) => l.id);
const uniqueKnown = (raw, ids) =>
  Array.isArray(raw) ? [...new Set(raw.filter((id) => ids.includes(id)))] : [];
export function availableUpgrades(upgrades) {
  const counts = normalizeUpgrades(upgrades);
  return UPGRADE_IDS.filter((id) => counts[id] < UPGRADES[id].limit);
}
export function upgradeOffer(upgrades, seed, levelId) {
  return seededShuffle(
    availableUpgrades(upgrades),
    seed,
    `reward:${levelId}`,
  ).slice(0, 3);
}
export function normalizeRun(raw) {
  if (
    !raw ||
    raw.version !== 1 ||
    !characterExists(raw.characterId) ||
    !Number.isInteger(raw.seed) ||
    raw.seed < 0 ||
    raw.seed > 0xffffffff
  )
    return null;
  const upgrades = normalizeUpgrades(raw.upgrades);
  const claimed = uniqueKnown(raw.claimed, validLevelIds);
  const cleared = uniqueKnown(raw.cleared, validLevelIds);
  const pendingLevel =
    validLevelIds.includes(raw.pendingLevel) &&
    claimed.includes(raw.pendingLevel)
      ? raw.pendingLevel
      : null;
  const offers = pendingLevel
    ? uniqueKnown(raw.offers, availableUpgrades(upgrades)).slice(0, 3)
    : [];
  return {
    version: 1,
    characterId: raw.characterId,
    seed: raw.seed,
    upgrades,
    claimed,
    cleared,
    pendingLevel: offers.length ? pendingLevel : null,
    offers,
  };
}
export class RunSave {
  constructor(storage, seedFactory = newRunSeed, manager = null) {
    this.storage = storage;
    this.seedFactory = seedFactory;
    this.writeFailures = new Set();
    this.notice = "";
    this.run = normalizeRun(this.read(RUN_SAVE_KEY));
    this.manager = manager || new AchievementManager(storage);
  }
  get achievements() {
    return this.manager.data;
  }
  get notice() {
    return [this._notice, this.manager?.notice].filter(Boolean).join(" ");
  }
  set notice(value) {
    this._notice = value;
  }
  read(key) {
    try {
      const value = this.storage?.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      this.notice =
        "Run data could not be read. Medals are unaffected; this run starts safely.";
      return null;
    }
  }
  write(key, value) {
    try {
      if (!this.storage) throw new Error("No storage");
      this.storage.setItem(key, JSON.stringify(value));
      this.writeFailures.delete(key);
      if (!this.writeFailures.size) this.notice = "";
      return true;
    } catch {
      this.writeFailures.add(key);
      this.notice =
        "Run changes cannot be saved. This page keeps them; after reload, an older run may return.";
      return false;
    }
  }
  begin(characterId, { seed = this.seedFactory(), upgrades = {} } = {}) {
    if (!characterExists(characterId)) return false;
    this.run = {
      version: 1,
      characterId,
      seed: Number.isInteger(seed) ? seed >>> 0 : 1,
      upgrades: normalizeUpgrades(upgrades),
      claimed: [],
      cleared: [],
      pendingLevel: null,
      offers: [],
    };
    this.write(RUN_SAVE_KEY, this.run);
    return true;
  }
  plan(levelId, developer = null, stageIndex = 0) {
    if (!this.run || !validLevelIds.includes(levelId)) return null;
    const index = validLevelIds.indexOf(levelId),
      seed = this.run.seed,
      level = levelById(levelId),
      specification = level.stages?.[stageIndex] || level;
    return {
      condition:
        developer?.condition !== undefined
          ? developer.condition
          : specification.condition !== undefined
            ? specification.condition
            : seededShuffle(CONDITION_IDS, seed, "conditions")[
                index % CONDITION_IDS.length
              ],
      objective:
        developer?.objective ||
        specification.optionalObjective ||
        seededShuffle(OBJECTIVE_IDS, seed, "objectives")[
          index % OBJECTIVE_IDS.length
        ],
      upgrades: { ...this.run.upgrades },
    };
  }
  finishLevel(levelId, bronze, reward) {
    if (!this.run || !validLevelIds.includes(levelId) || !bronze) return false;
    if (!this.run.cleared.includes(levelId)) this.run.cleared.push(levelId);
    if (reward && !this.run.claimed.includes(levelId)) {
      this.run.claimed.push(levelId);
      this.run.offers = upgradeOffer(this.run.upgrades, this.run.seed, levelId);
      this.run.pendingLevel = this.run.offers.length ? levelId : null;
    }
    this.write(RUN_SAVE_KEY, this.run);
    return true;
  }
  choose(id) {
    if (
      !this.run?.pendingLevel ||
      !this.run.offers.includes(id) ||
      !availableUpgrades(this.run.upgrades).includes(id)
    )
      return false;
    this.run.upgrades[id]++;
    this.run.pendingLevel = null;
    this.run.offers = [];
    this.write(RUN_SAVE_KEY, this.run);
    return true;
  }
  skipOffer() {
    if (!this.run?.pendingLevel) return false;
    this.run.pendingLevel = null;
    this.run.offers = [];
    this.write(RUN_SAVE_KEY, this.run);
    return true;
  }
  achieve(characterId, objectiveId) {
    return this.manager.awardObjective(characterId, objectiveId);
  }
  resetProgress() {
    this.run = null;
    // Campaign reset must never erase the separate achievement vault.
    return this.write(RUN_SAVE_KEY, null);
  }
}
