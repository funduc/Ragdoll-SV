import { CHARACTERS } from "./characters.js";
import { ALL_LEVELS as LEVELS } from "./campaign-levels.js";

// One namespaced, versioned object. Never clear localStorage: audio preferences
// and unrelated applications on the same GitHub Pages origin are not our saves.
export const CAMPAIGN_SAVE_KEY = "santor-vault:campaign";
export const CAMPAIGN_SAVE_VERSION = 1;
const validCharacter = (id) => CHARACTERS.some((c) => c.id === id);
export function emptyCampaignSave() {
  return {
    version: CAMPAIGN_SAVE_VERSION,
    selectedCharacter: null,
    progress: Object.fromEntries(
      CHARACTERS.map((c) => [
        c.id,
        Object.fromEntries(
          LEVELS.map((level) => [level.id, { medal: 0, santor: false }]),
        ),
      ]),
    ),
  };
}
export function normalizeCampaignSave(raw) {
  const clean = emptyCampaignSave();
  if (!raw || raw.version !== CAMPAIGN_SAVE_VERSION) return clean;
  if (validCharacter(raw.selectedCharacter))
    clean.selectedCharacter = raw.selectedCharacter;
  for (const c of CHARACTERS) {
    for (const level of LEVELS) {
      const entry = raw.progress?.[c.id]?.[level.id];
      if (
        Number.isInteger(entry?.medal) &&
        entry.medal >= 0 &&
        entry.medal <= 3
      ) {
        clean.progress[c.id][level.id] = {
          medal: entry.medal,
          santor: Boolean(
            level.santorMedal && entry.medal > 0 && entry.santor === true,
          ),
        };
      }
    }
  }
  return clean;
}
export class CampaignSave {
  constructor(storage) {
    this.data = emptyCampaignSave();
    this.notice = "";
    this.storage = null;
    this.writable = true;
    try {
      this.storage = storage === undefined ? globalThis.localStorage : storage;
      if (!this.storage) throw new Error("No storage");
      const text = this.storage.getItem(CAMPAIGN_SAVE_KEY);
      if (text !== null) {
        const raw = JSON.parse(text);
        this.data = normalizeCampaignSave(raw);
        if (raw?.version !== CAMPAIGN_SAVE_VERSION)
          this.notice =
            "This save version is not supported. A fresh campaign is ready.";
      }
    } catch {
      // JSON corruption is recoverable. A denied storage getter is also harmless.
      this.notice = this.storage
        ? "Campaign save could not be read. A fresh campaign is ready."
        : "Local saving is unavailable. Progress will last for this page only.";
      if (!this.storage) this.writable = false;
    }
  }
  persist() {
    try {
      if (!this.storage) throw new Error("No storage");
      this.storage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(this.data));
      this.writable = true;
      this.notice = "";
      return true;
    } catch {
      this.writable = false;
      this.notice =
        "Local saving is unavailable. Progress will last for this page only.";
      return false;
    }
  }
  select(characterId) {
    if (!validCharacter(characterId)) return false;
    this.data.selectedCharacter = characterId;
    return this.persist();
  }
  entry(characterId, levelId) {
    return {
      ...(this.data.progress[characterId]?.[levelId] || {
        medal: 0,
        santor: false,
      }),
    };
  }
  award(characterId, levelId, earned) {
    const entry = this.data.progress[characterId]?.[levelId];
    if (
      !entry ||
      !Number.isInteger(earned.medal) ||
      earned.medal < 0 ||
      earned.medal > 3
    )
      throw new TypeError("Invalid campaign medal.");
    const before = { ...entry };
    entry.medal = Math.max(entry.medal, earned.medal);
    entry.santor ||=
      earned.santor === true &&
      Boolean(LEVELS.find((l) => l.id === levelId)?.santorMedal);
    const saved = this.persist();
    return {
      before,
      best: { ...entry },
      upgraded: entry.medal > before.medal,
      saved,
    };
  }
  reset() {
    const selectedCharacter = this.data.selectedCharacter;
    this.data = emptyCampaignSave();
    this.data.selectedCharacter = selectedCharacter;
    const saved = this.persist();
    if (!saved)
      this.notice =
        "Campaign reset for this page only. Browser storage could not be updated; saved medals may return after reload.";
    return saved;
  }
}
