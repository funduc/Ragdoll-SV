import { ACHIEVEMENTS } from "./achievement-config.js";

// Opt-in only, documented console hooks. The Game creates a memory-only campaign
// and achievement manager before installing these hooks. No normal-play globals.
export function installAchievementHooks(manager, refresh, search) {
  if (new URLSearchParams(search).get("achievementdev") !== "1")
    return () => {};
  const hooks = Object.freeze({
    definitions: () => JSON.parse(JSON.stringify(ACHIEVEMENTS)),
    snapshot: () => JSON.parse(JSON.stringify(manager.data)),
    emit(type, facts) {
      const ids = manager.send(type, facts);
      refresh();
      return ids;
    },
    receive(event) {
      const ids = manager.receive(event);
      refresh();
      return ids;
    },
    equip(id, slot) {
      const result = manager.equip(id, slot);
      refresh();
      return result;
    },
    reset() {
      manager.reset();
      refresh();
    },
  });
  window.__vaultAchievements = hooks;
  return () => {
    if (window.__vaultAchievements === hooks) delete window.__vaultAchievements;
  };
}
