const CONTROL_KEYS = new Set([
  "Space",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "KeyA",
  "KeyD",
  "KeyR",
  "Enter",
]);

// One owner and one listener set for the entire page lifetime.
export class Input {
  constructor({ isActive, onConfirm, onRestart, onSuspend }) {
    this.keys = new Set();
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
      // Repeats restore held movement after a stall clears input. Menu actions
      // remain one-shot, so holding Enter/R cannot skip screens or keep resetting.
      if (event.repeat && (event.code === "Enter" || event.code === "KeyR"))
        return;
      if (event.code === "Enter") {
        if (this.enterHeld) return;
        this.enterHeld = true;
      }
      this.keys.add(event.code);
      if (event.code === "Enter") onConfirm();
      else if (event.code === "KeyR" && isActive()) onRestart();
    };
    this.keyup = (event) => {
      if (event.code === "Enter") {
        this.enterHeld = false;
        event.preventDefault();
      }
      this.keys.delete(event.code);
      if (isActive() && CONTROL_KEYS.has(event.code)) event.preventDefault();
    };
    this.blur = () => {
      this.focused = false;
      this.enterHeld = false;
      this.clear();
      onSuspend(true);
    };
    this.focus = () => {
      this.focused = true;
      this.enterHeld = false;
      this.clear();
      onSuspend(document.hidden);
    };
    this.visibility = () => {
      this.enterHeld = false;
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
      accelerate: this.keys.has("Space") || this.keys.has("ArrowUp"),
      rotate:
        Number(this.keys.has("ArrowRight") || this.keys.has("KeyD")) -
        Number(this.keys.has("ArrowLeft") || this.keys.has("KeyA")),
    };
  }
  clear() {
    // Clearing movement on a screen change must not re-arm a held Enter key.
    this.keys.clear();
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
