import { TRICK_CONFIG as C } from "./trick-config.js";

// This display never receives pointer events or focus. Frame time expires
// popups even during Sync; reset leaves no timers or pending callouts.
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
    if (notices.length) {
      this.queue = [{ ...notices.at(-1), at: world.elapsed, until: world.elapsed + C.popup.seconds }];
    }
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
  draw(renderer, world, hudHeight = 100, dt = 0) {
    const entry = this.queue.at(-1);
    if (!entry) return;
    const age = entry.age = Math.max(entry.age || 0, world.elapsed - entry.at) + dt;
    if (age >= C.popup.seconds) return;
    const { ctx: c, camera, width: w, height: h, dpr } = renderer;
    const reduced = renderer.motionPreference?.matches;
    const pop = reduced ? 1 : 1 + .12 * Math.max(0, 1 - age / .12);
    const drift = reduced ? 0 : 8 * Math.min(1, age / C.popup.seconds);
    const half = Math.min(100, (w - 32) / 2);
    // Reserve the entire animated footprint, including outline and drift.
    // The preferred slot is fixed below the HUD, not attached to the cart.
    const rx = half * 1.12 + 4, ry = 24;
    const top = hudHeight + 12 + ry + 8;
    const bodies = world.dynamic || [world.cart];
    const bounds = bodies.map(body => {
      const b = body.bounds || { min: body.position, max: body.position };
      return { left: (b.min.x - camera.x) * camera.scale - 16,
        right: (b.max.x - camera.x) * camera.scale + 16,
        top: (b.min.y - camera.y) * camera.scale - 16,
        bottom: (b.max.y - camera.y) * camera.scale + 16 };
    });
    const clear = ([x, y]) => x - rx >= 0 && x + rx <= w && y + ry <= h - 12 &&
      bounds.every(b => x + rx < b.left || x - rx > b.right || y + ry < b.top || y - ry - 8 > b.bottom);
    const slots = [[w / 2, top], [w - rx - 8, top], [rx + 8, top]];
    // Retain the chosen slot while safe, avoiding needless side-to-side jumps.
    const order = [entry.slot ?? 0, ...slots.map((_, i) => i)];
    const slot = order.find(i => clear(slots[i]));
    // An unusually large/ejected ragdoll can fill the top band. Keep the text
    // clear below it; if no space remains, protect visibility of the bodies.
    const fallback = [w / 2, Math.max(top, ...bounds.map(b => b.bottom + ry + 9))];
    if (slot === undefined && !clear(fallback)) return;
    if (slot !== undefined) entry.slot = slot;
    const [x, y] = slot === undefined ? fallback : slots[slot];
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.translate(x, y - drift); c.scale(pop, pop);
    c.globalAlpha = Math.min(1, (C.popup.seconds - age) / .35);
    c.textAlign = "center"; c.textBaseline = "middle";
    c.strokeStyle = "#101820"; c.lineWidth = 3; c.lineJoin = "round";
    const text = (value, y, font, color) => {
      c.font = font; c.fillStyle = color;
      c.strokeText(value, 0, y, half * 2);
      c.fillText(value, 0, y, half * 2);
    };
    text(entry.points === undefined ? "COMBO BROKEN" : "STUNT!", -14, "bold 9px Arial", "#fff");
    text(entry.points === undefined ? entry.name : entry.name.toUpperCase() + "! +" + entry.points,
      0, "900 14px Impact, Arial Narrow, sans-serif", "#b4ef4b");
    text("x" + this.chain + " COMBO", 14, "bold 11px Arial", "#52cefa");
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
