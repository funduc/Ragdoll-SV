// Companion data now stores only run achievement counts and pattern history.
// Version 1 random decisions/pity/pending boosts are discarded, never replayed.
export const SYNC_SAVE_KEY = "santor-vault:sync";
const fresh = () => ({ version: 2, scope: "", occurrences: 0, lastPattern: "" });
export class SyncSave {
  constructor(storage) {
    this.storage = storage; this.data = fresh(); this.protected = false;
    try {
      const raw = JSON.parse(storage?.getItem(SYNC_SAVE_KEY) || "null");
      this.protected = raw?.version > 2;
      if ([1, 2].includes(raw?.version)) {
        this.data.scope = typeof raw.scope === "string" ? raw.scope.slice(0, 100) : "";
        this.data.occurrences = Number.isSafeInteger(raw.occurrences) ? Math.max(0, Math.min(1000000, raw.occurrences)) : 0;
        if (raw.version === 2 && typeof raw.lastPattern === "string" && /^[0-3]{3,5}$/.test(raw.lastPattern)) this.data.lastPattern = raw.lastPattern;
        if (raw.version === 1) this.write();
      }
    } catch { /* Optional companion data cannot invalidate campaign progress. */ }
  }
  write() {
    if (this.protected || !this.storage) return false;
    try { this.storage.setItem(SYNC_SAVE_KEY, JSON.stringify(this.data)); return true; }
    catch { return false; }
  }
  recordMoment(run, pattern) {
    if (run) {
      const scope = run.characterId + ":" + run.seed;
      if (this.data.scope !== scope) { this.data.scope = scope; this.data.occurrences = 0; }
      this.data.occurrences = Math.min(1000000, this.data.occurrences + 1);
    }
    this.data.lastPattern = pattern.join("");
    this.write(); // Blocked storage still allows the current session to play.
  }
  resetRun() {
    this.data = { ...fresh(), lastPattern: this.data.lastPattern }; this.write();
  }
}
