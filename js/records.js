// Personal records: bests per level/character, all-time highs and career stats.
// A separate version-1 companion key; it never reads or writes other saves.
// Records come only from finished, valid, launched attempts. Memory-only when
// storage is unavailable or when the page runs in a developer mode.
import { CHARACTERS } from "./characters.js";
import { ALL_LEVELS } from "./campaign-levels.js";

export const RECORDS_SAVE_KEY = "santor-vault:records";
const characterIds = CHARACTERS.map((c) => c.id);
const levelIds = ALL_LEVELS.map((l) => l.id);
const MAX_POINTS = 100000;
const MAX_METRES = 1000;
const MAX_COUNT = 1000000;

const num = (v, max) =>
  Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
const int = (v, max) =>
  Number.isSafeInteger(v) ? Math.min(max, Math.max(0, v)) : 0;
const holder = (raw, key, max) => {
  if (!raw || typeof raw !== "object" || !Number.isFinite(raw[key]))
    return null;
  return {
    [key]: num(raw[key], max),
    characterId: characterIds.includes(raw.characterId)
      ? raw.characterId
      : null,
    mode: raw.mode === "party" ? "party" : "vault",
  };
};
const freshCareer = () => ({
  jumps: 0,
  landings: 0,
  cleanLandings: 0,
  crashes: 0,
  rotations: 0,
  metres: 0,
});
export const freshRecords = () => ({
  version: 1,
  longestJump: null,
  bestScore: null,
  mostRotations: null,
  levels: {},
  careers: Object.fromEntries(characterIds.map((id) => [id, freshCareer()])),
});

export class Records {
  constructor(storage) {
    this.storage = storage ?? null;
    this.data = freshRecords();
    this.protected = false;
    this.last = null;
    try {
      const raw = JSON.parse(this.storage?.getItem(RECORDS_SAVE_KEY) || "null");
      // A newer schema is preserved untouched; this page then plays in memory.
      this.protected = raw?.version > 1;
      if (raw?.version === 1) this.load(raw);
    } catch {
      /* Corrupt or denied storage starts with empty records. */
    }
  }
  load(raw) {
    this.data.longestJump = holder(raw.longestJump, "metres", MAX_METRES);
    this.data.bestScore = holder(raw.bestScore, "points", MAX_POINTS);
    this.data.mostRotations = holder(raw.mostRotations, "rotations", 100);
    for (const c of characterIds) {
      const career = raw.careers?.[c];
      if (career && typeof career === "object")
        for (const key of Object.keys(freshCareer()))
          this.data.careers[c][key] =
            key === "metres"
              ? num(career[key], MAX_METRES * MAX_COUNT)
              : int(career[key], MAX_COUNT);
      const levels = raw.levels?.[c];
      if (!levels || typeof levels !== "object") continue;
      for (const id of levelIds) {
        const entry = levels[id];
        if (!entry || !Number.isFinite(entry.points)) continue;
        (this.data.levels[c] ||= {})[id] = {
          points: int(Math.round(entry.points), MAX_POINTS),
          metres: num(entry.metres, MAX_METRES),
        };
      }
    }
  }
  write() {
    if (this.protected || !this.storage) return false;
    try {
      this.storage.setItem(RECORDS_SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }
  levelBest(characterId, levelId) {
    return this.data.levels[characterId]?.[levelId] || null;
  }
  career(characterId) {
    return this.data.careers[characterId] || freshCareer();
  }
  /**
   * Record one finished attempt. Returns the flags shown on the results
   * scorecard. Idle, invalid or unlaunched attempts return no flags.
   */
  submit({
    mode,
    characterId,
    levelId = null,
    score,
    launched = false,
    landed = false,
    valid = true,
  }) {
    this.last = null;
    if (
      !valid ||
      !score ||
      !launched ||
      !characterIds.includes(characterId) ||
      !Number.isFinite(score.total) ||
      !Number.isFinite(score.distanceMetres)
    )
      return null;
    const flags = {
      longestJump: false,
      bestScore: false,
      mostRotations: false,
      levelBest: false,
      previousLevelBest: null,
    };
    const metres = num(score.distanceMetres, MAX_METRES),
      points = int(Math.round(score.total), MAX_POINTS),
      rotations = int(score.tricks?.completedRotations ?? 0, 100),
      who = { characterId, mode: mode === "party" ? "party" : "vault" };
    const beats = (current, key, value) =>
      value > 0 && (!current || value > current[key]);
    if (beats(this.data.longestJump, "metres", metres)) {
      flags.longestJump = Boolean(this.data.longestJump);
      this.data.longestJump = { metres, ...who };
    }
    if (beats(this.data.bestScore, "points", points)) {
      flags.bestScore = Boolean(this.data.bestScore);
      this.data.bestScore = { points, ...who };
    }
    if (beats(this.data.mostRotations, "rotations", rotations)) {
      flags.mostRotations = Boolean(this.data.mostRotations);
      this.data.mostRotations = { rotations, ...who };
    }
    if (levelId && levelIds.includes(levelId)) {
      const previous = this.levelBest(characterId, levelId);
      flags.previousLevelBest = previous ? previous.points : null;
      if (!previous || points > previous.points) {
        flags.levelBest = Boolean(previous);
        (this.data.levels[characterId] ||= {})[levelId] = { points, metres };
      }
    }
    const career = this.data.careers[characterId];
    career.jumps = Math.min(MAX_COUNT, career.jumps + 1);
    if (landed) career.landings = Math.min(MAX_COUNT, career.landings + 1);
    if (!score.crashed && score.landingQuality === "Clean")
      career.cleanLandings = Math.min(MAX_COUNT, career.cleanLandings + 1);
    if (score.crashed) career.crashes = Math.min(MAX_COUNT, career.crashes + 1);
    career.rotations = Math.min(MAX_COUNT, career.rotations + rotations);
    career.metres = Math.round((career.metres + metres) * 10) / 10;
    this.write();
    this.last = flags;
    return flags;
  }
  // Multi-heat levels store their combined ledger as the level best.
  submitLevelTotal(characterId, levelId, points) {
    if (
      !characterIds.includes(characterId) ||
      !levelIds.includes(levelId) ||
      !Number.isFinite(points)
    )
      return false;
    const value = int(Math.round(points), MAX_POINTS),
      previous = this.levelBest(characterId, levelId);
    if (this.last) this.last.previousLevelBest = previous?.points ?? null;
    if (previous && value <= previous.points) return false;
    (this.data.levels[characterId] ||= {})[levelId] = {
      points: value,
      metres: 0,
    };
    if (this.last && previous) this.last.levelBest = true;
    this.write();
    return true;
  }
  reset() {
    this.data = freshRecords();
    this.last = null;
    return this.write();
  }
}

const nameOf = (id) => CHARACTERS.find((c) => c.id === id)?.name || "—";
export function recordFlagsMarkup(flags) {
  if (!flags) return "";
  const items = [];
  if (flags.longestJump) items.push("NEW LONGEST JUMP");
  if (flags.bestScore) items.push("NEW HIGH SCORE");
  if (flags.mostRotations) items.push("MOST ROTATIONS EVER");
  if (flags.levelBest) items.push("LEVEL PERSONAL BEST");
  return items.map((t) => `<span data-flag="record">★ ${t}</span>`).join("");
}
export function recordsPanel(records, characterId = null) {
  const d = records.data;
  const cell = (label, value) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const career = characterId ? records.career(characterId) : null;
  return `<section class="records-panel" aria-label="Vault records"><h3>VAULT RECORDS</h3><dl>${cell(
    "LONGEST JUMP",
    d.longestJump
      ? `${d.longestJump.metres.toFixed(1)} m · ${nameOf(d.longestJump.characterId)}`
      : "—",
  )}${cell(
    "HIGHEST SCORE",
    d.bestScore
      ? `${d.bestScore.points.toLocaleString("en-US")} · ${nameOf(d.bestScore.characterId)}`
      : "—",
  )}${cell(
    "MOST ROTATIONS",
    d.mostRotations
      ? `${d.mostRotations.rotations} · ${nameOf(d.mostRotations.characterId)}`
      : "—",
  )}${
    career
      ? cell(
          `${nameOf(characterId).split(" ")[0].toUpperCase()} CAREER`,
          `${career.jumps} jumps · ${career.cleanLandings} clean · ${career.crashes} crashes`,
        )
      : ""
  }</dl></section>`;
}
