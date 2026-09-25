import { SYNC_CONFIG as C, syncResult } from "./sync-config.js";
import { hashSeed } from "./run-random.js";
import { ALL_LEVELS } from "./campaign-levels.js";
export const SYNC_SAVE_KEY = "santor-vault:sync";
const ids = ALL_LEVELS.map((l) => l.id);
const fresh = () => ({
  version: 1,
  scope: "",
  pity: 0,
  occurrences: 0,
  levels: {},
});
const count = (v, max) =>
  Number.isSafeInteger(v) ? Math.min(max, Math.max(0, v)) : 0;
export const syncRoll = (seed, levelId, serial) =>
  hashSeed(`${seed}:santor-sync:${levelId}:${serial}`) / 4294967296;
export class SyncSave {
  constructor(storage) {
    this.storage = storage;
    this.data = fresh();
    this.protected = false;
    try {
      const raw = JSON.parse(storage?.getItem(SYNC_SAVE_KEY) || "null");
      this.protected = raw?.version > 1;
      if (raw?.version === 1 && typeof raw.scope === "string") {
        this.data.scope = raw.scope.slice(0, 100);
        this.data.pity = count(raw.pity, C.pity);
        this.data.occurrences = count(raw.occurrences, ids.length);
        for (const id of ids) {
          const old = raw.levels?.[id];
          if (!old || typeof old !== "object") continue;
          const pending = old.pending;
          this.data.levels[id] = {
            used: old.used === true,
            serial: count(old.serial, 1000000),
            pending:
              pending && typeof pending.triggered === "boolean"
                ? {
                    stage: count(pending.stage, 2),
                    triggered: pending.triggered,
                    result: pending.result
                      ? syncResult(
                          pending.result.perfect,
                          pending.result.good,
                          pending.result.extra,
                        )
                      : null,
                  }
                : null,
          };
          if (this.data.levels[id].pending?.triggered)
            this.data.levels[id].used = true;
        }
      }
    } catch {
      /* Corrupt/missing companion data never affects other saves. */
    }
  }
  write() {
    if (this.protected) return false;
    try {
      if (!this.storage) return false;
      this.storage.setItem(SYNC_SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }
  begin(run, levelId, stage = 0, force = false) {
    if (!run || !ids.includes(levelId) || this.protected) return null;
    const before = JSON.stringify(this.data);
    const scope = `${run.characterId}:${run.seed}`;
    if (this.data.scope !== scope) {
      const pity = this.data.pity;
      this.data = fresh();
      this.data.scope = scope;
      this.data.pity = pity;
    }
    const entry = (this.data.levels[levelId] ||= {
      used: false,
      serial: 0,
      pending: null,
    });
    // Commit every decision before displaying it. Reload reuses it, including
    // an already completed rhythm result. Explicit R cancels the opportunity.
    if (entry.pending?.stage === stage) return entry.pending;
    if (entry.used) return null;
    const triggered =
      force ||
      this.data.pity >= C.pity ||
      syncRoll(run.seed, levelId, ++entry.serial) < C.chance;
    entry.pending = { stage, triggered, result: null };
    if (triggered) {
      entry.used = true;
      this.data.pity = 0;
      this.data.occurrences++;
    } else this.data.pity = Math.min(C.pity, this.data.pity + 1);
    if (!this.write() && !force) {
      this.data = JSON.parse(before);
      return null;
    }
    return entry.pending;
  }
  result(levelId, result) {
    const pending = this.data.levels[levelId]?.pending;
    if (!pending?.triggered || pending.result) return;
    pending.result = syncResult(result.perfect, result.good, result.extra);
    this.write();
  }
  finish(levelId) {
    const entry = this.data.levels[levelId];
    if (entry?.pending) {
      entry.pending = null;
      this.write();
    }
  }
  resetRun() {
    const pity = this.data.pity;
    this.data = fresh();
    this.data.pity = pity;
    this.write();
  }
}
