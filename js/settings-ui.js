import { Settings } from "./settings.js";
import { CHANGELOG, changelogEntries } from "./changelog.js";
import { AudioControls } from "./audio-preferences.js";
import { setSheedy } from "./palette.js";
import { escape } from "./ui-content.js";

export class SettingsUI {
  constructor(root, audio, onPause) {
    this.root = root; this.audio = audio; this.onPause = onPause;
    this.settings = new Settings();
    this.dialog = document.createElement("dialog");
    this.dialog.className = "settings-dialog";
    root.append(this.dialog);
    setSheedy(this.settings.data.sheedy, root);
    this.button = document.getElementById("settings-button");
    this.openSettings = () => this.show("settings");
    this.button.addEventListener("click", this.openSettings);
    this.dialog.addEventListener("keydown", event => event.stopPropagation());
    this.dialog.addEventListener("keyup", event => event.stopPropagation());
    this.dialog.addEventListener("cancel", event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener("click", event => {
      if (event.target.closest("[data-settings-close]")) this.close();
      if (event.target.closest("[data-settings-news]")) this.show("history");
      if (event.target.closest("[data-settings-mute]")) audio.setMuted(!audio.muted);
    });
    this.dialog.addEventListener("change", event => {
      if (!event.target.matches("[data-sheedy-toggle]")) return;
      this.settings.update({ sheedy: event.target.checked });
      setSheedy(event.target.checked, root);
    });
    this.unsubscribe = audio.subscribe(() => this.paintMute());
  }
  get open() { return this.dialog.open; }
  paintMute() {
    const button = this.dialog.querySelector("[data-settings-mute]");
    if (button) {
      button.textContent = this.audio.muted ? "Sound: Off" : "Sound: On";
      button.setAttribute("aria-pressed", String(this.audio.muted));
    }
  }
  launch() {
    if (changelogEntries(this.settings).length) this.show("unseen");
  }
  show(view) {
    if (this.view === "unseen") this.markSeen();
    this.view = view;
    this.controls?.destroy();
    const entries = changelogEntries(this.settings, { all: view === "history" });
    const body = view === "settings"
      ? `<label class="sheedy-choice"><input type="checkbox" data-sheedy-toggle ${this.settings.data.sheedy ? "checked" : ""}> Sheedy setting: red-green colour-blind mode (deuteranopia)</label><div class="settings-audio">${["music", "effects"].map(channel => `<label>${channel.toUpperCase()} <input type="range" min="0" max="100" data-audio-volume="${channel}"><output data-volume-value="${channel}"></output></label>`).join("")}<button type="button" class="btn secondary" data-settings-mute></button><button type="button" class="btn secondary" data-audio-voices></button></div><button type="button" class="btn secondary" data-settings-news>What's new</button>`
      : entries.map(entry => `<section><small>${escape(entry.id)}</small><h3>${escape(entry.title)}</h3><ul>${entry.items.map(item => `<li>${escape(item)}</li>`).join("")}</ul></section>`).join("");
    this.dialog.innerHTML = `<h2 id="settings-heading">${view === "settings" ? "SETTINGS" : "WHAT’S NEW"}</h2>${body}<button type="button" class="btn" data-settings-close>Close</button>`;
    this.dialog.setAttribute("aria-labelledby", "settings-heading");
    this.controls = new AudioControls(this.dialog, this.audio);
    this.paintMute();
    if (!this.open) {
      this.returnFocus = document.activeElement;
      this.onPause(true);
      this.dialog.showModal();
    }
    this.dialog.querySelector("[data-settings-close]").focus();
  }
  markSeen() { if (CHANGELOG[0]) this.settings.update({ lastSeenChangelog: CHANGELOG[0].id }); }
  close() {
    if (this.view === "unseen" || this.view === "history") this.markSeen();
    this.dialog.close();
    this.onPause(false);
    this.returnFocus?.focus?.({ preventScroll: true });
  }
  destroy() {
    this.controls?.destroy(); this.unsubscribe();
    this.button.removeEventListener("click", this.openSettings);
    this.dialog.remove();
  }
}
