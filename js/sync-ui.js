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
  show(sequence) {
    this.active = true;
    this.serial = -1;
    this.overlay.hidden = this.bar.hidden = false;
    this.overlay.classList.toggle("sync-reduced", this.reduced);
    this.overlay.innerHTML = `<section class="sync-panel" aria-label="Sync Moment rhythm challenge"><p class="eyebrow sync-phase"></p><h2>SANTOR SYNC!</h2><p class="tiny">Tap at the line: arrows or A/S/W/D. Optional bonus; no miss penalty.</p><div class="sync-track" aria-label="${sequence.notes.length}-note rhythm sequence">${arrows.map((a, i) => `<div class="sync-lane" data-lane="${i}"><b>${a}</b></div>`).join("")}<div class="sync-line">HIT HERE</div>${sequence.notes.map((n, i) => `<span class="sync-note" data-note="${i}" style="left:${n.lane * 25 + 12.5}%" aria-hidden="true">${arrows[n.lane]}</span>`).join("")}</div><p class="sync-feedback" role="status" aria-live="polite"></p><p class="tiny sync-count"></p><progress class="sync-charge" max="1" value="0" aria-label="Sync charge"></progress><p class="tiny sync-john">JOHN SANTOR: ${C.lines.intro}</p></section>`;
    this.update(sequence);
  }
  update(sequence) {
    if (!this.active) return;
    const panel = this.overlay.querySelector(".sync-panel");
    const phase = sequence.phase, preparing = phase === "enter" || phase === "intro";
    this.overlay.dataset.phase = phase;
    const flash = this.reduced ? 0 : Math.max(0, 1 - sequence.time / C.flashSeconds) * 0.28;
    this.overlay.style.backgroundColor = `rgba(210, 240, 255, ${flash})`;
    const slide = Math.max(0, Math.min(1, (sequence.time - sequence.introStart) / C.laneSlideSeconds));
    const track = this.overlay.querySelector(".sync-track");
    track.style.transform = this.reduced ? "none" : `translateX(${(1 - slide) * 24}px)`;
    track.style.opacity = this.reduced ? "1" : String(slide);
    this.overlay.querySelector(".sync-phase").textContent = preparing ? "GET READY · OPTIONAL STYLE BONUS"
      : phase === "count-in" ? "COUNT IN · GET READY"
      : phase === "exit" ? "BACK TO THE LANDING" : phase === "result" ? "SYNC RESULT" : "FOLLOW THE BEAT";
    panel.classList.toggle(
      "sync-perfect",
      sequence.result?.grade === "PERFECT SYNC",
    );
    for (const [i, note] of sequence.notes.entries()) {
      const el = this.overlay.querySelector(`[data-note="${i}"]`);
      const lead = note.at - Math.max(sequence.time, sequence.countInStart);
      const queuedBehind = sequence.notes.slice(0, i).some(n => n.lane === note.lane && !n.grade);
      el.hidden = Boolean(note.grade) || queuedBehind || lead < -note.goodWindow;
      el.style.top = `${this.reduced ? 58 : Math.max(16, Math.min(86, 16 + (1 - lead / C.preview) * 62))}%`;
      el.style.opacity = this.reduced
        ? String(Math.max(0.65, 1 - Math.max(0, lead - C.preview / 2) / C.preview)) : "1";
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
      const r = syncReward(sequence.result);
      const message = `${sequence.result.grade} · ${sequence.result.accuracy.toFixed(0)}%`;
      if (feedback.textContent !== message) feedback.textContent = message;
      this.overlay.querySelector(".sync-count").textContent =
        r.points > 0 ? `+${r.points} style · controls returning` : "No penalty. Back to the landing.";
      this.overlay.querySelector(".sync-john").textContent =
        `JOHN SANTOR: ${C.lines[sequence.result.grade]}`;
    } else {
      const message = preparing ? "Watch the arrows. Wait for the ticks."
        : phase === "count-in" ? String(Math.max(1, C.countInTicks - Math.floor((sequence.time - sequence.countInStart) / (C.countInSeconds / C.countInTicks))))
        : sequence.feedback;
      if (feedback.textContent !== message) feedback.textContent = message;
      this.overlay.querySelector(".sync-count").textContent =
        `COMBO ${sequence.combo} · ${sequence.notes.filter((n) => n.grade).length} / ${sequence.notes.length} NOTES · air control returns after notes`;
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
  return `<div class="skill-result sync-breakdown"><b>SYNC MOMENT: ${s.grade} · ${s.accuracy.toFixed(0)}%</b><span>${s.perfect} Perfect / ${s.good} Good / ${s.miss} Miss · ${s.extra} off-beat inputs</span><span>+${s.reward.points} style points · no distance or landing bonus</span></div>`;
}
