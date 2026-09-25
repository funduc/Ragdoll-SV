import { TRICK_CONFIG as C } from "./trick-config.js";

// This display never receives pointer events or focus. Simulation time expires
// popups; reset discards the queue, so no attempt leaves a timeout behind.
export class TrickDisplay {
  constructor(element) {
    this.element = element;
    element.innerHTML =
      '<span class="trick-combo" data-trick-combo>COMBO ×1.00</span><strong class="trick-popup" data-trick-popup role="status" aria-live="polite" aria-atomic="true"></strong>';
    this.label = element.querySelector("[data-trick-combo]");
    this.popup = element.querySelector("[data-trick-popup]");
    this.reset();
  }
  reset() {
    this.queue = [];
    this.popup.textContent = "";
    this.popup.classList.remove("trick-pop");
    this.label.textContent = "COMBO ×1.00";
  }
  observe(world) {
    const before = this.queue.length;
    const notices = world.tricks.drainNotices();
    this.queue = this.queue.filter((e) => e.until > world.elapsed);
    this.queue.push(
      ...notices.map((e) => ({ ...e, until: world.elapsed + C.popup.seconds })),
    );
    this.queue = this.queue.slice(-C.popup.maximumQueue);
    const label = `COMBO ×${world.tricks.combo.toFixed(2)} · ${world.tricks.unique.size} UNIQUE`;
    if (this.label.textContent !== label) this.label.textContent = label;
    if (notices.length || before !== this.queue.length) {
      this.popup.replaceChildren(
        ...this.queue.map((e) => {
          const line = document.createElement("span");
          line.className = "trick-pop";
          line.textContent = e.name;
          return line;
        }),
      );
    }
  }
}

export function trickBreakdown(score) {
  const t = score.tricks;
  const rows = t.details
    .map(
      (e) =>
        `<tr><td>${e.name}${e.occurrence > 1 ? ` #${e.occurrence}` : ""}</td><td>${e.base}</td><td>×${e.repeat.toFixed(2)}</td><td>×${e.combo.toFixed(2)}</td><td data-trick-points>${e.points}</td></tr>`,
    )
    .join("");
  return `<section class="trick-breakdown" aria-label="Trick score breakdown"><p class="tiny"><b>TRICK LOG</b> · ${t.completedRotations} complete rotation${t.completedRotations === 1 ? "" : "s"} · ${t.unique} unique · best combo ×${t.bestCombo.toFixed(2)}</p>${rows ? `<table class="trick-table"><thead><tr><th>Trick</th><th>Base</th><th>Repeat</th><th>Combo</th><th>Points</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="tiny">No completed tricks. Partial spins and small reversals earn no trick points.</p>'}<p class="trick-equation"><b data-trick-subtotal>${t.subtotal}</b> × character <b data-trick-character>${t.characterMultiplier.toFixed(2)}</b> × ${score.landingQuality.toLowerCase()} <b data-trick-landing>${t.landingMultiplier.toFixed(2)}</b>${score.sync ? ` × Sync <b data-trick-sync>${score.sync.reward.style.toFixed(2)}</b>` : ""} = <b data-trick-total>${score.stylePoints}</b> STYLE${t.capped || (score.sync && Math.round(t.subtotal * t.characterMultiplier * t.landingMultiplier * score.sync.reward.style) > C.maximumStylePoints) ? " (style cap)" : ""}</p><p class="tiny">Each occurrence is rounded after its repeat and combo factors; the final style total is rounded once. Double Flip is a pair bonus, not another rotation. Repeats pay ${C.repeatFactors.map((f) => `${Math.round(f * 100)}%`).join(", ")}.</p></section>`;
}
