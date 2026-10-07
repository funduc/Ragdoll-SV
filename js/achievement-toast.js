import { ACHIEVEMENT_RULES, ACHIEVEMENT_TIERS, achievementById } from "./achievement-config.js";
import { achievementIcon } from "./achievement-art.js";
import { escape } from "./ui-content.js";

// One RAF-driven queue. Observes input only: no preventDefault, focus or capture.
export class AchievementToasts {
  constructor(stage, audio, env = window) {
    this.audio = audio; this.env = env; this.queue = []; this.current = null; this.seconds = 0;
    this.host = document.createElement("div");
    this.host.className = "achievement-toast-host"; this.host.hidden = true;
    this.host.setAttribute("aria-live", "polite"); this.host.setAttribute("aria-atomic", "true");
    stage.append(this.host);
    this.skip = event => {
      if (event?.repeat || event?.ctrlKey || event?.metaKey || event?.altKey) return;
      this.current = null; this.seconds = 0; this.host.hidden = true;
    };
    env.addEventListener("keydown", this.skip);
    env.addEventListener("pointerdown", this.skip, { passive: true });
  }
  enqueue(ids) {
    for (const id of ids)
      if (achievementById(id) && this.current !== id && !this.queue.includes(id)) this.queue.push(id);
    return ids.length > 0;
  }
  tick(gapMs, visible = true, reducedMotion = false) {
    this.host.dataset.paused = String(!visible);
    this.host.dataset.reducedMotion = String(reducedMotion);
    if (!visible) return;
    if (this.current && gapMs > 0 && gapMs <= 250) this.seconds += gapMs / 1000;
    if (this.seconds >= ACHIEVEMENT_RULES.toastSeconds) this.skip();
    if (this.current || !this.queue.length) return;
    const item = achievementById(this.queue.shift());
    this.current = item.id; this.seconds = 0;
    this.host.style.setProperty("--tier", ACHIEVEMENT_TIERS[item.tier]);
    this.host.innerHTML = `<aside class="achievement-notice" role="status" data-tier="${item.tier}"><span class="achievement-sparkles" aria-hidden="true">✦ · ✧ · ✦</span>${achievementIcon(item)}<div><small>ACHIEVEMENT UNLOCKED · ${item.tier.toUpperCase()}</small><strong>${escape(item.name)}</strong><span>Any key or tap to skip · keep playing</span></div></aside>`;
    this.host.hidden = false;
    this.audio.play("achievement");
  }
  clear() { this.queue = []; this.skip(); this.host.innerHTML = ""; }
  destroy() {
    this.clear(); this.host.remove();
    this.env.removeEventListener("keydown", this.skip);
    this.env.removeEventListener("pointerdown", this.skip);
  }
}
