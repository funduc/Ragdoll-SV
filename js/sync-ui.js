import { SYNC_CONFIG as C, syncReward } from "./sync-config.js";
const arrows = ["←", "↓", "↑", "→"];
const names = ["Left / A", "Down / S", "Up / W", "Right / D"];
// One delegated pointer/click listener set for the lifetime of the game.
export class SyncUI {
  constructor(onHit) {
    this.overlay = document.getElementById("sync-overlay");
    this.bar = document.getElementById("sync-controls");
    this.active = false;
    this.holds = new Set();
    this.reduced =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      false;
    this.bar.innerHTML = arrows
      .map(
        (a, i) =>
          `<button type="button" class="btn" data-sync-lane="${i}" aria-label="${names[i]} rhythm lane">${a}<small>${names[i]}</small></button>`,
      )
      .join("");
    this.down = (e) => {
      const button = e.target.closest("[data-sync-lane]");
      if (
        !this.active ||
        !button ||
        e.button > 0 ||
        this.holds.has(e.pointerId)
      )
        return;
      e.preventDefault();
      this.holds.add(e.pointerId);
      onHit(Number(button.dataset.syncLane));
      try {
        button.setPointerCapture(e.pointerId);
      } catch {}
    };
    this.up = (e) => this.holds.delete(e.pointerId);
    this.click = (e) => {
      const b = e.target.closest("[data-sync-lane]");
      if (this.active && e.detail === 0 && b) onHit(Number(b.dataset.syncLane));
    };
    this.bar.addEventListener("pointerdown", this.down);
    this.bar.addEventListener("pointerup", this.up);
    this.bar.addEventListener("pointercancel", this.up);
    this.bar.addEventListener("lostpointercapture", this.up);
    this.bar.addEventListener("click", this.click);
    this.hide();
  }
  show(sequence, warning = false) {
    this.active = true;
    this.serial = -1;
    this.overlay.hidden = this.bar.hidden = false;
    this.overlay.classList.toggle("sync-reduced", this.reduced);
    this.overlay.innerHTML = `<section class="sync-panel" aria-label="Santor Sync rhythm challenge"><p class="eyebrow">BONUS BROADCAST · PHYSICS PAUSED</p><h2>SANTOR SYNC DETECTED</h2><p class="tiny">Tap the matching arrow at the green line. A / S / W / D also work. Release between taps.</p><div class="sync-track" aria-label="Six-note rhythm sequence">${arrows.map((a, i) => `<div class="sync-lane" data-lane="${i}"><b>${a}</b></div>`).join("")}<div class="sync-line">HIT HERE</div>${sequence.notes.map((n, i) => `<span class="sync-note" data-note="${i}" style="left:${n.lane * 25 + 12.5}%" aria-hidden="true">${arrows[n.lane]}</span>`).join("")}</div><p class="sync-feedback" role="status" aria-live="polite"></p><p class="tiny sync-count"></p><progress class="sync-charge" max="1" value="0" aria-label="Sync charge"></progress><p class="tiny sync-john">JOHN SANTOR: ${warning ? C.lines.wrate + " Wrate Issue: cosmetic diagnostic only." : C.lines.intro}</p></section>`;
    this.update(sequence);
  }
  update(sequence) {
    if (!this.active) return;
    const panel = this.overlay.querySelector(".sync-panel");
    panel.classList.toggle(
      "sync-perfect",
      sequence.result?.grade === "PERFECT SYNC",
    );
    for (const [i, note] of sequence.notes.entries()) {
      const el = this.overlay.querySelector(`[data-note="${i}"]`);
      const lead = note.at - sequence.time;
      el.hidden =
        Boolean(note.grade) || lead > C.preview || lead < -sequence.goodWindow;
      el.style.top = `${this.reduced ? 58 : Math.max(0, Math.min(86, (1 - lead / C.preview) * 78))}%`;
      el.style.opacity = this.reduced
        ? String(Math.max(0.25, 1 - Math.max(0, lead) / C.preview))
        : "1";
    }
    for (const [i, el] of [
      ...this.overlay.querySelectorAll(".sync-lane"),
    ].entries())
      el.classList.toggle(
        "sync-beat",
        sequence.notes.some(
          (n) =>
            n.lane === i &&
            sequence.time >= n.at &&
            sequence.time - n.at < C.beatFlashSeconds,
        ),
      );
    const feedback = this.overlay.querySelector(".sync-feedback");
    if (sequence.result) {
      const r = syncReward(sequence.result, sequence.characterId);
      feedback.textContent = `${sequence.result.grade} · ${sequence.result.accuracy.toFixed(0)}%`;
      this.overlay.querySelector(".sync-count").textContent =
        r.speed > 1
          ? `Speed +${Math.round((r.speed - 1) * 100)}% · lift height +${Math.round((r.height - 1) * 100)}% · style ×${r.style.toFixed(2)}`
          : "No penalty. Ordinary jump begins next.";
      this.overlay.querySelector(".sync-john").textContent =
        `JOHN SANTOR: ${C.lines[sequence.result.grade]}`;
    } else {
      if (this.serial !== sequence.serial)
        feedback.textContent = sequence.feedback;
      this.overlay.querySelector(".sync-count").textContent =
        `COMBO ${sequence.combo} · ${sequence.notes.filter((n) => n.grade).length} / ${C.notes} NOTES · runway follows automatically`;
    }
    this.serial = sequence.serial;
    this.overlay.querySelector("progress").value = sequence.charge;
  }
  releaseHolds() {
    for (const id of this.holds)
      for (const button of this.bar.querySelectorAll("button")) {
        try {
          if (button.hasPointerCapture?.(id)) button.releasePointerCapture(id);
        } catch {}
      }
    this.holds.clear();
  }
  hide() {
    this.active = false;
    this.releaseHolds();
    this.overlay.hidden = this.bar.hidden = true;
    this.overlay.replaceChildren();
  }
  destroy() {
    this.hide();
    for (const [name, fn] of [
      ["pointerdown", this.down],
      ["pointerup", this.up],
      ["pointercancel", this.up],
      ["lostpointercapture", this.up],
      ["click", this.click],
    ])
      this.bar.removeEventListener(name, fn);
  }
}
export function syncBreakdown(score) {
  if (!score.sync) return "";
  const s = score.sync;
  return `<div class="skill-result sync-breakdown"><b>SANTOR SYNC: ${s.grade} · ${s.accuracy.toFixed(0)}%</b><span>${s.perfect} Perfect / ${s.good} Good / ${s.miss} Miss · ${s.extra} off-beat inputs</span><span>Launch speed +${Math.round((s.reward.speed - 1) * 100)}% · lift height +${Math.round((s.reward.height - 1) * 100)}% · style ×${s.reward.style.toFixed(2)}</span></div>`;
}
