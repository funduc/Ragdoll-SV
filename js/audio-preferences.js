export const AUDIO_SETTINGS_KEY = "santor-vault:audio";
export const MUTE_KEY = "santor-vault:muted";
const volume = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;

// Separate from campaign/achievement saves; only user changes write preferences.
export class AudioPreferences {
  constructor(env = globalThis) {
    this.music = 0.45;
    this.effects = 1;
    this.voices = true;
    this.muted = false;
    this.listeners = new Set();
    this.saved = new Map();
    try {
      this.storage = env.localStorage;
      const raw = this.storage?.getItem(AUDIO_SETTINGS_KEY);
      this.saved.set(AUDIO_SETTINGS_KEY, raw);
      this.saved.set(MUTE_KEY, this.storage?.getItem(MUTE_KEY));
      this.muted = this.saved.get(MUTE_KEY) === "true";
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.version === 1) {
        this.music = volume(parsed.music, this.music);
        this.effects = volume(parsed.effects, this.effects);
        if (typeof parsed.voices === "boolean") this.voices = parsed.voices;
      }
    } catch {
      /* Preferences are optional, including corrupt/denied storage. */
    }
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify() {
    for (const fn of this.listeners) fn();
  }
  setVolume(channel, value, save = true) {
    if (!["music", "effects"].includes(channel) || !Number.isFinite(value))
      return;
    this[channel] = volume(value, this[channel]);
    this.notify();
    if (save) this.persistVolumes();
  }
  persistVolumes() {
    this.write(
      AUDIO_SETTINGS_KEY,
      JSON.stringify({ version: 1, music: this.music, effects: this.effects, voices: this.voices }),
    );
  }
  setVoices(enabled) {
    this.voices = Boolean(enabled);
    this.notify();
    this.persistVolumes();
  }
  setMuted(muted) {
    this.muted = Boolean(muted);
    this.notify();
    this.write(MUTE_KEY, String(this.muted));
  }
  write(key, value) {
    if (this.saved.get(key) === value) return;
    try {
      this.storage?.setItem(key, value);
      if (this.storage) this.saved.set(key, value);
    } catch {}
  }
}

export class AudioControls {
  constructor(root, preferences) {
    this.root = root;
    this.preferences = preferences;
    this.input = (event) => {
      const channel = event.target.dataset.audioVolume;
      if (channel)
        preferences.setVolume(channel, Number(event.target.value) / 100, false);
    };
    this.change = () => preferences.persistVolumes();
    this.click = event => {
      if (event.target.closest?.("[data-audio-voices]")) preferences.setVoices(!preferences.voices);
    };
    // Let native slider keys work without pushing/steering or confirming a menu.
    this.key = (event) => {
      if (event.target.matches("input, [data-audio-voices]"))
        event.stopPropagation();
    };
    root?.addEventListener("click", this.click);
    root?.addEventListener("input", this.input);
    root?.addEventListener("change", this.change);
    root?.addEventListener("keydown", this.key);
    root?.addEventListener("keyup", this.key);
    this.unsubscribe = preferences.subscribe(() => this.paint());
    this.paint();
  }
  paint() {
    const toggle = this.root?.querySelector("[data-audio-voices]");
    if (toggle) {
      toggle.textContent = `Voices: ${this.preferences.voices ? "On" : "Off"}`;
      toggle.setAttribute("aria-pressed", String(this.preferences.voices));
    }
    for (const input of this.root?.querySelectorAll("[data-audio-volume]") ||
      []) {
      const value = Math.round(
        this.preferences[input.dataset.audioVolume] * 100,
      );
      input.value = String(value);
      input.setAttribute("aria-valuetext", `${value} percent`);
      const output = this.root.querySelector(
        `[data-volume-value="${input.dataset.audioVolume}"]`,
      );
      if (output) output.textContent = `${value}%`;
    }
  }
  destroy() {
    this.unsubscribe();
    for (const [name, handler] of [
      ["click", this.click],
      ["input", this.input],
      ["change", this.change],
      ["keydown", this.key],
      ["keyup", this.key],
    ])
      this.root?.removeEventListener(name, handler);
  }
}
