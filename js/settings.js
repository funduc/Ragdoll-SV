export const SETTINGS_KEY = "santor-vault:settings";
export class Settings {
  constructor(env = globalThis) {
    this.data = { version: 1, sheedy: false, lastSeenChangelog: "" };
    this.newPlayer = true;
    try {
      this.storage = env.localStorage;
      for (let i = 0; i < (this.storage?.length || 0); i++)
        if (this.storage.key(i)?.startsWith("santor-vault:")) this.newPlayer = false;
      const value = JSON.parse(this.storage?.getItem(SETTINGS_KEY) || "null");
      if (value?.version === 1) {
        this.data.sheedy = value.sheedy === true;
        if (typeof value.lastSeenChangelog === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.lastSeenChangelog))
          this.data.lastSeenChangelog = value.lastSeenChangelog;
      }
    } catch { /* Settings are optional. In-memory choices still work this session. */ }
  }
  update(values) {
    this.data = { ...this.data, ...values, version: 1 };
    try { this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.data)); } catch {}
  }
}
