import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CAPABILITIES,
  COSMETIC_REWARDS,
  COSMETIC_SLOTS,
} from "./achievement-config.js";
import { CHARACTERS } from "./characters.js";
import { LEVELS } from "./campaign-levels.js";
import { OBJECTIVE_IDS } from "./run-config.js";

export const ACHIEVEMENT_SAVE_KEY = "santor-vault:achievements";
export const ACHIEVEMENT_SAVE_VERSION = 2;
const characterIds = CHARACTERS.map((c) => c.id);
const emptyRecord = () => ({
  progress: 0,
  unlocked: false,
  unlockedAt: null,
  values: [],
});
export const emptyAchievements = () => ({
  version: ACHIEVEMENT_SAVE_VERSION,
  // Retain the v1 objective flags without changing their character attribution.
  characters: Object.fromEntries(characterIds.map((id) => [id, {}])),
  objectiveDates: Object.fromEntries(characterIds.map((id) => [id, {}])),
  records: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, emptyRecord()])),
  equipped: Object.fromEntries(COSMETIC_SLOTS.map((slot) => [slot, null])),
  sequence: 0,
});
const safeCount = (n, maximum = 1_000_000) =>
  Number.isSafeInteger(n) && n >= 0 ? Math.min(n, maximum) : 0;
const validTimestamp = (n) =>
  Number.isSafeInteger(n) && n > 0 && n <= 8_640_000_000_000_000;
export function normalizeAchievements(raw) {
  const clean = emptyAchievements();
  if (![1, ACHIEVEMENT_SAVE_VERSION].includes(raw?.version)) return clean;
  for (const character of characterIds)
    for (const id of OBJECTIVE_IDS)
      if (raw.characters?.[character]?.[id] === true)
        clean.characters[character][id] = true;
  if (raw.version === 1) return clean;
  for (const character of characterIds)
    for (const id of OBJECTIVE_IDS)
      if (
        clean.characters[character][id] &&
        validTimestamp(raw.objectiveDates?.[character]?.[id])
      )
        clean.objectiveDates[character][id] = raw.objectiveDates[character][id];
  clean.sequence = safeCount(raw.sequence, Number.MAX_SAFE_INTEGER - 1);
  for (const item of ACHIEVEMENTS) {
    const old = raw.records?.[item.id];
    if (!old || typeof old !== "object") continue;
    const values =
      item.values && Array.isArray(old.values)
        ? [
            ...new Set(
              old.values.filter((value) => item.values.includes(value)),
            ),
          ]
        : [];
    const unlocked = old.unlocked === true;
    clean.records[item.id] = {
      progress: unlocked
        ? item.target
        : item.aggregation === "unique"
          ? values.length
          : safeCount(old.progress, item.target),
      unlocked,
      unlockedAt:
        unlocked && validTimestamp(old.unlockedAt) ? old.unlockedAt : null,
      values,
    };
  }
  for (const slot of COSMETIC_SLOTS) {
    const id = raw.equipped?.[slot];
    if (
      COSMETIC_REWARDS[id]?.slot === slot &&
      ACHIEVEMENTS.some((a) => a.reward === id && clean.records[a.id].unlocked)
    )
      clean.equipped[slot] = id;
  }
  return clean;
}

// Normalized events are flat facts. Invalid/missing numeric data is never zero
// for predicate purposes (e.g. missing target distance cannot mean a bullseye).
const numberFields = [
  "syncOccurrences",
  "rotations",
  "uniqueTricks",
  "stylePoints",
  "distancePoints",
  "landingPoints",
  "attachmentPoints",
  "objectivePoints",
  "targetError",
  "lostComponents",
  "lostWheels",
  "medalPointGap",
  "conditionChanges",
  "seconds",
  "firstLevel",
  "completedLevels",
  "goldLevels",
  "upgradeCount",
];
const booleanFields = [
  "syncCompleted",
  "syncPerfect",
  "syncBoosted",
  "syncAllMiss",
  "valid",
  "launched",
  "landed",
  "severeCrash",
  "objectivePassed",
  "levelCompleted",
  "cleanLanding",
  "successfulLanding",
  "mechanicalFailure",
  "mechanicalRecovered",
  "runwayCapReached",
  "soleWinner",
  "styleMajority",
  "runComplete",
  "riderAttached",
];
const stringFields = [
  "levelId",
  "takeoff",
  "brace",
  "crashClass",
  "condition",
  "sponsorHit",
  "objectiveId",
];
const eventTypes = new Set([
  "attempt-ended",
  "campaign-progress",
  "biography-read",
  "tournament-won",
  "objective-completed",
]);
export function normalizeAchievementEvent(raw) {
  if (
    !raw ||
    !eventTypes.has(raw.type) ||
    !characterIds.includes(raw.characterId) ||
    !Number.isSafeInteger(raw.id) ||
    raw.id <= 0
  )
    return null;
  const event = { id: raw.id, type: raw.type, characterId: raw.characterId };
  for (const key of numberFields)
    event[key] =
      Number.isFinite(raw[key]) && raw[key] >= 0
        ? Math.min(raw[key], 1_000_000)
        : null;
  for (const key of booleanFields) event[key] = raw[key] === true;
  for (const key of stringFields)
    event[key] = typeof raw[key] === "string" ? raw[key].slice(0, 80) : null;
  return Object.freeze(event);
}
const predicates = {
  eq: (a, b) => a === b,
  gt: (a, b) => Number.isFinite(a) && a > b,
  gte: (a, b) => Number.isFinite(a) && a >= b,
  lte: (a, b) => Number.isFinite(a) && a <= b,
  in: (a, b) => b.includes(a),
  gtField: (a, b, e) => Number.isFinite(a) && Number.isFinite(e[b]) && a > e[b],
};
const aggregators = {
  once: (record, item) => item.target,
  count: (record) => record.progress + 1,
  max: (record, item, event) =>
    Math.max(
      record.progress,
      Number.isFinite(event[item.field]) ? event[item.field] : 0,
    ),
  unique: (record, item, event) => {
    const value = event[item.field];
    if (item.values.includes(value) && !record.values.includes(value))
      record.values.push(value);
    return record.values.length;
  },
};

// No DOM, screen names, physics objects, event listeners, intervals or timers.
export class AchievementManager {
  constructor(
    storage,
    {
      medals = null,
      clock = Date.now,
      capabilities = ACHIEVEMENT_CAPABILITIES,
    } = {},
  ) {
    this.storage = storage;
    this.clock = clock;
    this.capabilities = capabilities;
    this.pending = [];
    this.notice = "";
    this.unsupported = false;
    let raw = null;
    try {
      const text = storage?.getItem(ACHIEVEMENT_SAVE_KEY);
      if (text) raw = JSON.parse(text);
    } catch {
      this.notice =
        "Achievement data could not be read. Safe defaults are active.";
    }
    this.unsupported =
      Number.isInteger(raw?.version) && raw.version > ACHIEVEMENT_SAVE_VERSION;
    this.data = normalizeAchievements(raw);
    if (this.unsupported)
      this.notice =
        "This achievement save is from a newer version. It is preserved; this page cannot overwrite it.";
    if (!this.unsupported && raw?.version !== ACHIEVEMENT_SAVE_VERSION) {
      // Import only facts the old medal records prove. Do not invent dates,
      // brace counts, clean runs, wins, or historical upgrade choices.
      for (const characterId of characterIds) {
        const entries = LEVELS.map((l) => {
          const n = medals?.progress?.[characterId]?.[l.id]?.medal;
          return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
        });
        const event = normalizeAchievementEvent({
          id: 1,
          type: "campaign-progress",
          characterId,
          firstLevel: entries[0] >= 1 ? 1 : 0,
          completedLevels: entries.filter((n) => n >= 1 && n <= 3).length,
          goldLevels: entries.filter((n) => n === 3).length,
        });
        this.apply(event, null, false);
      }
      // Fresh/old/corrupt installs receive v2. Campaign/run keys are never written.
      this.persist();
    }
  }
  available(item) {
    return !item.requires || this.capabilities[item.requires] === true;
  }
  persist() {
    if (this.unsupported) return false;
    try {
      if (!this.storage) throw new Error("No storage");
      this.storage.setItem(ACHIEVEMENT_SAVE_KEY, JSON.stringify(this.data));
      this.notice = "";
      return true;
    } catch {
      this.notice =
        "Achievement changes cannot be saved. This page keeps them; older progress may return after reload.";
      return false;
    }
  }
  apply(event, timestamp, notify = true) {
    const unlocked = [];
    for (const item of ACHIEVEMENTS) {
      const record = this.data.records[item.id];
      if (
        record.unlocked ||
        item.event !== event.type ||
        !this.available(item) ||
        !item.rules.every(([field, op, value]) =>
          predicates[op](event[field], value, event),
        )
      )
        continue;
      record.progress = Math.min(
        item.target,
        aggregators[item.aggregation](record, item, event),
      );
      if (record.progress >= item.target) {
        record.unlocked = true;
        record.unlockedAt = validTimestamp(timestamp) ? timestamp : null;
        unlocked.push(item.id);
        if (notify) this.pending.push(item.id);
      }
    }
    return unlocked;
  }
  receive(raw) {
    const event = normalizeAchievementEvent(raw);
    // A persisted monotonic high-water mark rejects duplicates across refresh,
    // without a growing array of every attempt ever played. Events are ordered.
    if (!event || event.id <= this.data.sequence || this.unsupported) return [];
    this.data.sequence = event.id;
    if (
      event.type === "objective-completed" &&
      OBJECTIVE_IDS.includes(event.objectiveId) &&
      !this.data.characters[event.characterId][event.objectiveId]
    ) {
      this.data.characters[event.characterId][event.objectiveId] = true;
      const timestamp = this.clock();
      if (validTimestamp(timestamp))
        this.data.objectiveDates[event.characterId][event.objectiveId] =
          timestamp;
    }
    const unlocked = this.apply(event, this.clock());
    this.persist();
    return unlocked;
  }
  send(type, facts) {
    return this.receive({ ...facts, type, id: this.data.sequence + 1 });
  }
  awardObjective(characterId, objectiveId) {
    if (
      !characterIds.includes(characterId) ||
      !OBJECTIVE_IDS.includes(objectiveId) ||
      this.data.characters[characterId][objectiveId]
    )
      return false;
    this.send("objective-completed", { characterId, objectiveId });
    return this.data.characters[characterId][objectiveId] === true;
  }
  drainUnlocks() {
    return this.pending.splice(0);
  }
  equip(id, slot = COSMETIC_REWARDS[id]?.slot) {
    if (!COSMETIC_SLOTS.includes(slot)) return false;
    if (
      id !== null &&
      (COSMETIC_REWARDS[id]?.slot !== slot ||
        !ACHIEVEMENTS.some(
          (a) => a.reward === id && this.data.records[a.id].unlocked,
        ))
    )
      return false;
    this.data.equipped[slot] = id;
    this.persist();
    return true;
  }
  cosmeticValues() {
    return Object.fromEntries(
      COSMETIC_SLOTS.map((slot) => [
        slot,
        COSMETIC_REWARDS[this.data.equipped[slot]]?.value || null,
      ]),
    );
  }
  reset() {
    const sequence = this.data.sequence;
    this.data = emptyAchievements();
    this.data.sequence = sequence;
    this.pending = [];
    this.unsupported = false;
    return this.persist();
  }
}
