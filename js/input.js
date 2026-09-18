import { SKILL_CONFIG } from "./skill-config.js";
const CONTROL_KEYS = new Set([
  "Space",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "KeyA",
  "KeyD",
  "ArrowDown",
  "KeyS",
  "KeyR",
  "Enter",
]);

// One owner and one listener set for the entire page lifetime.
export class Input {
  constructor({ isActive, onConfirm, onRestart, onSuspend }) {
    this.keys = new Set();
    this.downKeys = new Set();
    this.blockedKeys = new Set();
    this.pushes = 0;
    this.brace = false;
    this.enterHeld = false;
    this.focused = true;
    this.isActive = isActive;
    this.onConfirm = onConfirm;
    this.onRestart = onRestart;
    this.onSuspend = onSuspend;
    this.keydown = (event) => {
      if (
        !CONTROL_KEYS.has(event.code) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (isActive() || event.code === "Enter") event.preventDefault();
      const held = this.downKeys.has(event.code);
      this.downKeys.add(event.code);
      // Every intentional action requires a new physical press. Keep this state
      // across menu/attempt clears, so an old hold cannot leak into a new screen.
      if (event.repeat || held || this.blockedKeys.has(event.code)) return;
      if (event.code === "Enter") {
        if (this.enterHeld) return;
        this.enterHeld = true;
      }
      if (event.code === "Enter") onConfirm(event);
      else if (event.code === "KeyR" && isActive()) onRestart();
      else if (isActive()) {
        if (["Space", "ArrowUp"].includes(event.code))
          this.pushes = Math.min(
            SKILL_CONFIG.maximumQueuedPushes,
            this.pushes + 1,
          );
        else if (["ArrowDown", "KeyS"].includes(event.code)) this.brace = true;
        else this.keys.add(event.code);
      }
    };
    this.keyup = (event) => {
      if (event.code === "Enter") {
        this.enterHeld = false;
        event.preventDefault();
      }
      this.keys.delete(event.code);
      this.downKeys.delete(event.code);
      this.blockedKeys.delete(event.code);
      if (isActive() && CONTROL_KEYS.has(event.code)) event.preventDefault();
    };
    this.blur = () => {
      this.focused = false;
      this.enterHeld = false;
      this.downKeys.clear();
      this.clear();
      onSuspend(true);
    };
    this.focus = () => {
      this.focused = true;
      this.enterHeld = false;
      this.downKeys.clear();
      this.clear();
      onSuspend(document.hidden);
    };
    this.visibility = () => {
      this.enterHeld = false;
      this.downKeys.clear();
      this.clear();
      onSuspend(document.hidden || !this.focused);
    };
    window.addEventListener("keydown", this.keydown);
    window.addEventListener("keyup", this.keyup);
    window.addEventListener("blur", this.blur);
    window.addEventListener("focus", this.focus);
    document.addEventListener("visibilitychange", this.visibility);
  }
  get controls() {
    return {
      pushes: this.pushes,
      brace: this.brace,
      rotate:
        Number(this.keys.has("ArrowRight") || this.keys.has("KeyD")) -
        Number(this.keys.has("ArrowLeft") || this.keys.has("KeyA")),
    };
  }
  clear() {
    // Clearing movement on a screen change must not re-arm a held Enter key.
    this.keys.clear();
    this.blockedKeys = new Set(this.downKeys);
    this.pushes = 0;
    this.brace = false;
  }
  consume() {
    const controls = this.controls;
    this.pushes = 0;
    this.brace = false;
    return controls;
  }
  destroy() {
    window.removeEventListener("keydown", this.keydown);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.blur);
    window.removeEventListener("focus", this.focus);
    document.removeEventListener("visibilitychange", this.visibility);
    this.clear();
  }
}
