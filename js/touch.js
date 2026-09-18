import { SKILL_CONFIG } from "./skill-config.js";
// Push/brace fire on pointerdown once. Rotation holds never alter keyboard state.
export class TouchControls {
  constructor(bar, isActive, env = globalThis) {
    this.bar = bar;
    this.isActive = isActive;
    this.env = env;
    this.holds = new Map();
    this.pushes = 0;
    this.brace = false;
    this.buttons = [...bar.querySelectorAll("[data-control]")];
    this.down = (event) => {
      const button = event.target.closest("[data-control]");
      if (
        !button ||
        !bar.contains(button) ||
        button.disabled ||
        !isActive() ||
        event.button > 0 ||
        this.holds.has(event.pointerId)
      )
        return;
      event.preventDefault();
      if (button.dataset.control === "push")
        this.pushes = Math.min(
          SKILL_CONFIG.maximumQueuedPushes,
          this.pushes + 1,
        );
      if (button.dataset.control === "brace") this.brace = true;
      this.holds.set(event.pointerId, {
        button,
        action: button.dataset.control,
      });
      try {
        button.setPointerCapture(event.pointerId);
      } catch {}
      this.paint();
    };
    this.up = (event) => {
      if (!this.holds.has(event.pointerId)) return;
      const { button } = this.holds.get(event.pointerId);
      this.holds.delete(event.pointerId);
      try {
        button.releasePointerCapture(event.pointerId);
      } catch {}
      this.paint();
    };
    this.contextMenu = (event) => event.preventDefault();
    bar.addEventListener("pointerdown", this.down);
    bar.addEventListener("lostpointercapture", this.up);
    bar.addEventListener("contextmenu", this.contextMenu);
    env.addEventListener("pointerup", this.up);
    env.addEventListener("pointercancel", this.up);
    this.sync();
  }
  get controls() {
    const actions = new Set(
      [...this.holds.values()].map((hold) => hold.action),
    );
    return {
      pushes: this.isActive() ? this.pushes : 0,
      brace: this.isActive() && this.brace,
      rotate: this.isActive()
        ? Number(actions.has("right")) - Number(actions.has("left"))
        : 0,
    };
  }
  merge(keyboard) {
    const touch = this.controls;
    this.pushes = 0;
    this.brace = false;
    return {
      pushes: Math.min(
        SKILL_CONFIG.maximumQueuedPushes,
        keyboard.pushes + touch.pushes,
      ),
      brace: keyboard.brace || touch.brace,
      rotate: Math.max(-1, Math.min(1, keyboard.rotate + touch.rotate)),
    };
  }
  paint() {
    const pressed = new Set(
      [...this.holds.values()].map((hold) => hold.button),
    );
    for (const button of this.buttons)
      button.setAttribute("aria-pressed", String(pressed.has(button)));
  }
  clear() {
    const held = [...this.holds];
    this.holds.clear();
    this.pushes = 0;
    this.brace = false;
    for (const [id, { button }] of held) {
      try {
        button.releasePointerCapture(id);
      } catch {}
    }
    this.paint();
  }
  sync() {
    const active = this.isActive();
    if (!active) this.clear();
    for (const button of this.buttons) button.disabled = !active;
  }
  destroy() {
    this.clear();
    this.bar.removeEventListener("pointerdown", this.down);
    this.bar.removeEventListener("lostpointercapture", this.up);
    this.bar.removeEventListener("contextmenu", this.contextMenu);
    this.env.removeEventListener("pointerup", this.up);
    this.env.removeEventListener("pointercancel", this.up);
  }
}
