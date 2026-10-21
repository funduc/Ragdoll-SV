import { CHARACTERS } from "./characters.js";
import { UPGRADES, normalizeUpgrades } from "./run-config.js";

export const LOADOUT_KEY = "santor-vault:loadout";
export const SLOT_LEVELS = ["orientation-day", "showboating-101", "ice-cream-weather"];
export const slotCount = (save, characterId) => SLOT_LEVELS.filter(id => save.entry(characterId, id).medal >= 1).length;
export const stackCount = counts => Object.values(counts).reduce((sum, n) => sum + n, 0);

// Preserve insertion order: when slots shrink, remove stacks from the end.
export function trimLoadout(raw, slots) {
  const normalized = normalizeUpgrades(raw), result = {};
  for (const id of Object.keys(raw || {})) {
    const count = Math.min(normalized[id] || 0, slots);
    if (count) { result[id] = count; slots -= count; }
  }
  return result;
}

export class LoadoutSave {
  constructor(save, legacyRun, developer = false) {
    this.save = save; this.storage = developer ? null : save.storage;
    this.developer = developer; this.notice = "";
    this.data = { version: 1 };
    try {
      if (!developer && !this.storage) throw new Error("No storage");
      const text = this.storage?.getItem(LOADOUT_KEY);
      if (text == null) {
        if (legacyRun && !developer)
          this.data[legacyRun.characterId] = trimLoadout(legacyRun.upgrades, slotCount(save, legacyRun.characterId));
        // An empty import also prevents future re-imports.
        if (!developer && !this.persist()) this.data = { version: 1 };
      } else {
        const raw = JSON.parse(text);
        if (raw?.version !== 1) throw new Error("Invalid loadout");
        for (const c of CHARACTERS) this.data[c.id] = trimLoadout(raw[c.id], slotCount(save, c.id));
      }
    } catch {
      this.storage = null;
      this.notice = "Garage saving is unavailable. Changes last for this page only.";
    }
  }
  get(characterId) {
    return trimLoadout(this.data[characterId], slotCount(this.save, characterId));
  }
  change(characterId, id, delta) {
    if (!CHARACTERS.some(c => c.id === characterId) || !Object.hasOwn(UPGRADES, id) || ![1, -1].includes(delta)) return false;
    const counts = this.get(characterId), count = counts[id] || 0;
    if (delta > 0 && (count >= UPGRADES[id].limit || stackCount(counts) >= slotCount(this.save, characterId))) return false;
    if (delta < 0 && !count) return false;
    counts[id] = count + delta;
    if (!counts[id]) delete counts[id];
    this.data[characterId] = counts; this.persist(); return true;
  }
  clear(characterId) {
    this.data[characterId] = {}; this.persist();
  }
  persist() {
    if (this.developer) return;
    try {
      if (!this.storage) throw new Error("No storage");
      this.storage.setItem(LOADOUT_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      this.storage = null;
      this.notice = "Garage saving is unavailable. Changes last for this page only.";
      return false;
    }
  }
}
