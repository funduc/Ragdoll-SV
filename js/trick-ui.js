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
    this.chain = 0;
    this.popup.textContent = "";
    this.popup.classList.remove("trick-pop");
    this.label.textContent = "COMBO ×1.00";
  }
  observe(world) {
    const before = this.queue.length;
    const notices = world.tricks.drainNotices();
    this.queue = this.queue.filter((e) => e.until > world.elapsed);
    for (const notice of notices) this.chain = notice.points === undefined ? 0 : this.chain + 1;
    this.queue.push(
      ...notices.map((e) => ({ ...e, at: world.elapsed, until: world.elapsed + C.popup.seconds })),
    );
    this.queue = this.queue.slice(-C.popup.maximumQueue);
    const label = `COMBO ×${world.tricks.combo.toFixed(2)} · ${world.tricks.unique.size} UNIQUE`;
    if (this.label.textContent !== label) this.label.textContent = label;
    if (notices.length || before !== this.queue.length) {
      this.popup.replaceChildren(
        ...this.queue.map((e) => {
          const line = document.createElement("span");
          line.className = "trick-pop";
          line.textContent = e.points === undefined ? e.name : `STUNT! ${e.name}! +${e.points}`;
          return line;
        }),
      );
    }
  }
  draw(renderer, world, hudHeight = 100) {
    const entries = this.queue.filter(e => e.until > world.elapsed).slice(-2);
    if (!entries.length) return;
    const { ctx: c, camera, width: w, height: h, dpr } = renderer;
    const age = world.elapsed - entries.at(-1).at;
    const reduced = renderer.motionPreference?.matches;
    const pop = reduced ? 1 : 1 + 0.12 * Math.max(0, 1 - age / 0.18);
    const half = Math.min(175, w / 2 - 24);
    const x = Math.max(half + 24, Math.min(w - half - 24, (world.cart.position.x - camera.x) * camera.scale));
    const y = Math.max(hudHeight + 55, Math.min(h - 110, (world.cart.position.y - camera.y) * camera.scale - 90));
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.translate(x, y); c.scale(pop, pop);
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = !reduced && age < .12 ? "#34532b" : "rgba(10,20,28,.88)";
    c.fillRect(-half, -25, half * 2, entries.length * 30 + 58);
    c.strokeStyle = "#b4ef4b"; c.lineWidth = 2;
    c.strokeRect(-half, -25, half * 2, entries.length * 30 + 58);
    c.font = "bold 14px Arial"; c.fillStyle = "#fff";
    c.fillText(entries.some(e => e.points !== undefined) ? "STUNT!" : "COMBO BROKEN", 0, -10);
    entries.forEach((e, i) => {
      c.font = "900 28px Impact, Arial Narrow, sans-serif"; c.fillStyle = "#b4ef4b";
      c.fillText(e.points === undefined ? e.name : e.name.toUpperCase() + "! +" + e.points, 0, 18 + i * 30, half * 2 - 16);
    });
    c.font = "bold " + Math.min(24, 16 + this.chain * 2) + "px Arial"; c.fillStyle = "#52cefa";
    c.fillText("x" + this.chain + " COMBO", 0, entries.length * 30 + 18);
    c.restore();
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
  return `<section class="trick-breakdown" aria-label="Trick score breakdown"><p class="tiny"><b>TRICK LOG</b> · ${t.completedRotations} complete rotation${t.completedRotations === 1 ? "" : "s"} · ${t.unique} unique · best combo ×${t.bestCombo.toFixed(2)}</p>${rows ? `<table class="trick-table"><thead><tr><th>Trick</th><th>Base</th><th>Repeat</th><th>Combo</th><th>Points</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="tiny">No completed tricks. Partial spins and small reversals earn no trick points.</p>'}<p class="trick-equation"><b data-trick-subtotal>${t.subtotal}</b> × character <b data-trick-character>${t.characterMultiplier.toFixed(2)}</b> × ${score.landingQuality.toLowerCase()} <b data-trick-landing>${t.landingMultiplier.toFixed(2)}</b>${score.sync ? ` + Sync <b data-trick-sync>${score.sync.reward.points}</b>` : ""} = <b data-trick-total>${score.stylePoints}</b> STYLE${t.capped || (score.sync && t.points + score.sync.reward.points > C.maximumStylePoints) ? " (style cap)" : ""}</p><p class="tiny">Each occurrence is rounded after its repeat and combo factors; the final style total is rounded once. Double Flip is a pair bonus, not another rotation. Repeats pay ${C.repeatFactors.map((f) => `${Math.round(f * 100)}%`).join(", ")}.</p></section>`;
}
