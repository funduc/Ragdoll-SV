import { CHARACTERS } from "./characters.js";
import { State } from "./tournament.js";
import { ATTEMPT_LIMIT } from "./physics.js";
import { rankQualifiers } from "./scoring.js";
import { Commentator } from "./commentary.js";
import { SkillMeter, worldSkillView } from "./skill-ui.js";
import { tutorialMarkup } from "./tutorial.js";
import { TrickDisplay } from "./trick-ui.js";
import { TRICK_CONFIG } from "./trick-config.js";
import {
  escape,
  portrait,
  unavailablePortraits,
  scoreDetails,
} from "./ui-content.js";
import { renderCampaign, updateCampaignCoach } from "./campaign-ui.js";
const button = (label) =>
  `<div class="actions"><button class="btn" data-action="confirm">${label} <small class="keyboard-note">ENTER ↵</small></button></div>`;
const roster = (characters) =>
  `<div class="roster-strip">${characters.map((c) => `<div class="roster-person" style="--person:${c.primaryColor}">${portrait(c)}<div><strong>${escape(c.name)}</strong><small>“${escape(c.nickname)}”</small></div></div>`).join("")}</div>`;

export class UI {
  constructor(onConfirm, onPractice = () => {}, onMenu = () => {}) {
    this.root = document.getElementById("game");
    this.overlay = document.getElementById("overlay");
    this.hud = document.getElementById("hud");
    this.standings = document.getElementById("standings");
    this.commentary = document.getElementById("commentary");
    this.hint = document.getElementById("play-hint");
    this.skillHud = document.getElementById("skill-hud");
    this.skillMeter = new SkillMeter(this.skillHud);
    this.trickHud = document.getElementById("trick-hud");
    this.trickDisplay = new TrickDisplay(this.trickHud);
    this.touchMedia = globalThis.matchMedia?.(
      "(pointer: coarse), (hover: none)",
    );
    this.roundLabel = document.getElementById("round-label");
    this.pauseBanner = document.getElementById("pause-banner");
    this.commentator = new Commentator();
    this.resetAttempt();
    this.onClick = (event) => {
      const menu = event.target.closest(
        "button[data-mode], button[data-campaign]",
      );
      if (menu && !menu.disabled) {
        onMenu(menu);
        return;
      }
      if (event.target.closest('[data-action="confirm"]')) onConfirm();
      const practice = event.target.closest("[data-practice]");
      if (practice) onPractice(practice.dataset.practice);
    };
    this.overlay.addEventListener("click", this.onClick);
    // Capture once; an absent replacement portrait leaves labeled initials underneath.
    this.onImageError = (event) => {
      if (event.target.tagName === "IMG") {
        unavailablePortraits.add(event.target.getAttribute("src"));
        event.target.hidden = true;
      }
    };
    this.root.addEventListener("error", this.onImageError, true);
    this.hudName = document.getElementById("hud-name");
    this.hudPhase = document.getElementById("hud-phase");
    this.hudDistance = document.getElementById("hud-distance");
    this.hudRotation = document.getElementById("hud-rotation");
    this.hudTime = document.getElementById("hud-time");
    this.passiveStatus = document.getElementById("passive-status");
  }
  say(text) {
    if (!text) return;
    this.commentary.textContent = text;
    this.commentator.lastLine = text;
  }
  caption(type, character = null, round = "qualifying") {
    this.say(this.commentator.pick(type, character, round));
  }
  resetAttempt() {
    this.commentator.resetAttempt();
    this.announced = new Set();
    this.trickDisplay?.reset();
  }
  observeAttempt(world, tournament) {
    this.trickDisplay.observe(world);
    const queue = (type) =>
      this.commentator.enqueue(
        type,
        world.character,
        tournament.round,
        world.elapsed,
      );
    for (const event of world.drainEvents()) {
      if (["launch", "crash", "wrateWarning"].includes(event)) queue(event);
    }
    for (const [type, eligible] of [
      ["rotation", world.launched && world.airRotation >= Math.PI / 2],
      ["longJump", world.launched && world.distancePixels >= 1200],
    ]) {
      if (eligible && !this.announced.has(type)) {
        this.announced.add(type);
        queue(type);
      }
    }
    this.say(this.commentator.tick(world.elapsed));
  }
  showIntroduction(t) {
    const c = t.current;
    const john = this.commentator.pick("introduction", c, t.round);
    this.root.dataset.introduction = "true";
    this.overlay.classList.add("intro-overlay");
    const keepsake =
      c.keepsake?.kind === "censored"
        ? `<span class="censored-keepsake"><span class="censored-icon" role="img" aria-label="Black-bar-censored novelty item">CENSORED</span><span>${escape(c.keepsake.label)}</span></span>`
        : "";
    this.overlay.innerHTML = `<section class="menu-panel intro-card" style="--person:${c.primaryColor}" aria-label="Character introduction">
      <p class="eyebrow">MEET THE COMPETITOR <span class="intro-countdown">PRESS ENTER WHEN READY.</span></p>
      <div class="handoff">${portrait(c)}<div><h2>${escape(c.fullName)}</h2><p class="tiny">${t.round.toUpperCase()} · JUMP ${t.turn + 1} OF ${t.roster.length}</p></div></div>
      <p class="intro-bio">${escape(c.biography)}</p>
      ${c.associatedPhrase ? `<p class="tiny intro-phrase">“${escape(c.associatedPhrase)}”</p>` : ""}
      ${keepsake}
      <div class="intro-traits"><p><b>STRENGTH</b>${escape(c.strength)}</p><p><b>WEAKNESS</b>${escape(c.weakness)}</p></div>
      <dl class="intro-stats">${c.statistics
        .slice(0, 3)
        .map(
          ([label, value]) =>
            `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`,
        )
        .join("")}</dl>
      <p class="intro-passive"><b>${escape(c.passive.name)}</b> · ${escape(c.passive.description)}</p>
      <p class="intro-john"><b>JOHN SANTOR:</b> ${escape(john || "The Vault is ready.")}</p>
      ${button("Continue to Ready")}
    </section>`;
    this.say(john);
    this.overlay
      .querySelector('[data-action="confirm"]')
      ?.focus({ preventScroll: true });
  }
  render(t) {
    this.root.dataset.state = t.state;
    this.root.dataset.introduction = "false";
    this.overlay.classList.remove("intro-overlay");
    if (!t.active) this.commentator.resetAttempt();
    this.overlay.hidden = t.active;
    this.hud.hidden = !t.active;
    this.hint.hidden = !t.active;
    this.skillHud.hidden = !t.active;
    this.trickHud.hidden = !t.active;
    this.overlay.classList.toggle("title-overlay", t.state === State.TITLE);
    this.campaignSession = null;
    document.getElementById("campaign-coach").hidden = true;
    if (t.kind === "campaign") {
      renderCampaign(this, t);
      return;
    }
    this.root.dataset.mode = t.state === State.TITLE ? "menu" : "party";
    document.getElementById("session-mode").textContent =
      t.state === State.TITLE ? "CHOOSE YOUR MODE" : "LOCAL PASS & PLAY";
    document.getElementById("session-players").textContent =
      t.state === State.TITLE ? "1–3 PLAYERS" : "3 PLAYERS";
    document.getElementById("standings-title").textContent = "THE COMPETITORS";
    document.getElementById("standings-subtitle").textContent =
      "QUALIFYING → TOP TWO → CHAMPIONSHIP";
    this.roundLabel.textContent = [State.TITLE, State.INSTRUCTIONS].includes(
      t.state,
    )
      ? "TOURNAMENT STANDBY"
      : t.state === State.FINAL
        ? "TOURNAMENT COMPLETE"
        : `${t.round.toUpperCase()} · ${t.turn + 1} / ${t.roster.length}`;
    this.renderStandings(t);
    if (t.active) {
      this.hudName.textContent = t.current.name.toUpperCase();
      this.passiveStatus.textContent = t.current.passive.name;
      this.passiveStatus.dataset.warning = "false";
      return;
    }
    let html = "";
    switch (t.state) {
      case State.TITLE:
        html = `<section class="menu-panel title-panel"><p class="eyebrow">EVENT 01 / CHOOSE YOUR MODE</p><h1>RAGDOLL<br><span>OLYMPICS</span></h1><strong class="vault-title">THE SANTOR VAULT</strong><p>One shopping cart with something to prove.<br>A solo campaign or a local pass-and-play tournament.</p><div class="actions mode-choices"><button type="button" class="btn" data-mode="vault">Vault Run <small>1 PLAYER</small></button><button type="button" class="btn secondary" data-mode="party">Party Tournament <small>3 PLAYERS</small></button></div><div class="title-meta"><span>1 DEVICE</span><span>SHOPPING-CART LONG JUMP</span></div></section>`;
        this.say("John Santor, live from The Santor Vault. Choose your event.");
        break;
      case State.INSTRUCTIONS:
        html = `<section class="menu-panel"><p class="eyebrow">BEFORE YOU SEND IT</p><h2>THE RULES OF THE VAULT</h2><div class="rules-grid"><div class="rule-box"><h3>01 / DRIVE & FLY</h3><p>Tap <kbd>SPACE</kbd> or <kbd>↑</kbd> at the green centre of the rhythm meter. Release each time; holding gives one push. Spam adds wobble.</p><p>In the air, use <kbd>←</kbd> / <kbd>A</kbd> to lean back, <kbd>→</kbd> / <kbd>D</kbd> to lean forward. Aim for wheels down. Tap <kbd>↓</kbd> / <kbd>S</kbd> once just before contact to brace. Too early reduces air control; too late gives no benefit.</p><p>At TAKEOFF, wait for the cart marker in the green boost zone and tap once. Early spends the bonus; Late pitches forward. Touch: tap PUSH / BRACE; hold LEFT / RIGHT.</p><p><kbd>R</kbd> returns to Ready before takeoff. Once airborne, your attempt counts.</p></div><div class="rule-box"><h3>02 / MAKE IT COUNT</h3><p><b>Distance:</b> 10 points per metre from ramp edge to cart centre at first ground contact.</p><p><b>Landing:</b> clean 150 · scrappy 75 · rough / crash 0.</p><p><b>Style:</b> Complete flips and controlled-flight tricks build unique-trick combos. Repeats pay ${TRICK_CONFIG.repeatFactors.map((f) => `${Math.round(f * 100)}%`).join(", ")}. Clean landings multiply trick style ×${TRICK_CONFIG.landingFactors.Clean.toFixed(2)}; crashes retain ×${TRICK_CONFIG.landingFactors.Crash.toFixed(2)}. Partial spins earn no trick points.</p><p><b>Attached:</b> 100 if the rider stays attached through a completed landing.</p></div></div><p class="tiny">One qualifying jump each; the lowest score is out. Qualifying ties use distance, then roster order. The top two get one fresh championship jump; tied championship scores share the win. Qualifying scores do not carry over.</p><p class="tiny">A jump ends at rest or after 20 active seconds (12 seconds without takeoff). Switching tabs pauses play. Keyboard or on-screen touch controls.</p>${tutorialMarkup()}${button("Meet the competitors")}</section>`;
        break;
      case State.QUALIFYING_INTRO:
        html = `<section class="menu-panel"><p class="eyebrow">ROUND 01 / THREE IN, TWO THROUGH</p><h2>QUALIFYING</h2><p>One jump each. Pass the controls in this order.</p>${roster(CHARACTERS)}<p class="tiny">Lowest total is eliminated. Tied totals use distance, then the order above.</p>${button("Go to first hand-off")}</section>`;
        this.caption("introduction");
        break;
      case State.READY:
        html = `<section class="menu-panel"><p class="eyebrow">PASS THE CONTROLS</p><span class="turn-number">${t.round.toUpperCase()} · JUMP ${t.turn + 1} OF ${t.roster.length}</span><div class="handoff" style="--person:${t.current.primaryColor}">${portrait(t.current)}<div><h2>${escape(t.current.name)}</h2><span class="nickname">“${escape(t.current.nickname)}”</span></div></div><p>Ready, ${t.current.name.split(" ")[0]}? Confirm, then tap <kbd>SPACE</kbd> or <kbd>↑</kbd> on the green rhythm zone. One timed push at takeoff, then <kbd>↓</kbd> / <kbd>S</kbd> to brace before landing.</p><p class="tiny touch-note">Touch: tap PUSH on the beat; hold LEFT / RIGHT to rotate; tap BRACE once near landing.</p><p class="subline">${t.next ? `ON DECK: ${escape(t.next.fullName)}` : t.round === "qualifying" ? "UP NEXT: QUALIFYING RESULTS & ELIMINATION" : "UP NEXT: THE FINAL RESULTS"}</p><p class="tiny"><b>${escape(t.current.passive.name)}</b> · Style ×${t.current.styleMultiplier.toFixed(2)} · Air control ×${t.current.rotationControl.toFixed(2)} · Stability ×${t.current.landingStability.toFixed(2)}</p><p class="tiny">${t.current.statistics
          .slice(3)
          .map(([label, value]) => `${escape(label)}: ${escape(value)}`)
          .join(" · ")}</p>${button("Begin jump")}</section>`;
        this.say(
          `${t.current.name.split(" ")[0]}, the runway is yours. When you are ready.`,
        );
        break;
      case State.RESULTS: {
        const s = t.lastScore;
        const c = t.current;
        const literary =
          s.crashed && c.crashDescriptions
            ? c.crashDescriptions[s.quarterTurns % c.crashDescriptions.length]
            : "";
        const flavor = s.crashed
          ? `${literary ? `<p class="character-flavor">${escape(literary)}</p>` : ""}<p class="crash-quote">${escape(c.name.split(" ")[0])}: “${escape(c.crashQuote)}”</p>`
          : "";
        this.caption(
          s.crashed
            ? "crash"
            : s.landingQuality === "Clean"
              ? "goodLanding"
              : s.distanceMetres >= 30
                ? "longJump"
                : "weakJump",
          c,
          t.round,
        );
        html = `<section class="menu-panel"><p class="eyebrow">${t.round.toUpperCase()} / ATTEMPT COMPLETE</p><h2>${escape(t.current.name.toUpperCase())}</h2><p class="subline">${escape(s.reason)} · ${s.landingQuality.toUpperCase()} · ${s.attached ? "RIDER ATTACHED" : "RIDER DETACHED"}</p>${flavor}${scoreDetails(s)}<p class="tiny">${t.next ? `Next: ${escape(t.next.fullName)}. Confirm to hand off the controls.` : t.round === "qualifying" ? "All three qualifying jumps are in. Find out who advances." : "Both championship jumps are in. Time to crown the winner."}</p>${button(t.next ? "Next competitor" : t.round === "qualifying" ? "Qualifying results" : "Crown the champion")}</section>`;
        break;
      }
      case State.ELIMINATION:
        html = `<section class="menu-panel"><p class="eyebrow orange">THE CUT / QUALIFYING RESULTS</p><h2>${escape(t.eliminated.name.toUpperCase())} IS OUT</h2>${this.table(CHARACTERS, t.qualifying, t.eliminated.id)}<p>${escape(t.finalists[0].name)} and ${escape(t.finalists[1].name)} advance. All championship scores start from zero.</p><p class="tiny">Ties resolve by distance, then roster order. Runner-up jumps first; the top qualifier jumps last.</p>${button("To the championship")}</section>`;
        this.caption("elimination", t.eliminated, t.round);
        break;
      case State.CHAMPIONSHIP_INTRO:
        html = `<section class="menu-panel championship-panel"><div class="championship-ribbon" aria-hidden="true">MAXIMUM RETAIL GLORY</div><p class="eyebrow orange">ROUND 02 / WINNER TAKES THE CART</p><h2>THE CHAMPIONSHIP</h2><p>Two competitors. One new jump each. Highest championship score wins.</p>${roster(t.finalists)}<p class="tiny">Qualifying scores do not carry over. Tied championship scores share the title.</p>${button("Go to championship hand-off")}</section>`;
        this.caption("championship", null, t.round);
        break;
      case State.FINAL: {
        const tie = t.winners.length > 1;
        html = `<section class="menu-panel championship-panel winner-panel"><div class="championship-ribbon" aria-hidden="true">OFFICIALLY EXCESSIVE CHAMPIONSHIP</div><div class="championship-seal" aria-hidden="true"><span>★</span> CERTIFIED CART LEGEND</div><p class="eyebrow orange">THE SANTOR VAULT / FINAL RESULTS</p><h2>${tie ? "A SHARED VICTORY!" : `${escape(t.winners[0].name.toUpperCase())} WINS!`}</h2><p>${tie ? t.winners.map((c) => escape(c.fullName)).join(" & ") : escape(t.winners[0].fullName)}${tie ? " finish level on points." : " takes the championship."}</p>${this.table(t.finalists, t.championship)}<p class="tiny">Eliminated in qualifying: ${escape(t.eliminated.fullName)} · ${t.qualifying[t.eliminated.id].total} points.</p>${button("Restart tournament")}</section>`;
        this.caption(tie ? "tie" : "victory", t.winners[0], t.round);
        break;
      }
    }
    this.overlay.innerHTML = html;
    this.overlay
      .querySelector('[data-action="confirm"], [data-mode]')
      ?.focus({ preventScroll: true });
  }
  table(characters, scores, eliminatedId = null) {
    const ordered = eliminatedId
      ? rankQualifiers(characters, scores)
      : [...characters].sort((a, b) => scores[b.id].total - scores[a.id].total);
    return `<table class="results-table"><thead><tr><th>COMPETITOR</th><th>DISTANCE</th><th>POINTS</th></tr></thead><tbody>${ordered
      .map(
        (c) =>
          `<tr class="${c.id === eliminatedId ? "eliminated" : ""}"><td>${escape(c.name)}${c.id === eliminatedId ? '<span class="status-chip">OUT</span>' : ""}</td><td>${scores[c.id].distanceMetres.toFixed(1)} m</td><td>${scores[c.id].total}</td></tr>`,
      )
      .join("")}</tbody></table>`;
  }
  renderStandings(t) {
    this.standings.innerHTML = CHARACTERS.map((c) => {
      const current =
        ![
          State.TITLE,
          State.INSTRUCTIONS,
          State.QUALIFYING_INTRO,
          State.ELIMINATION,
          State.CHAMPIONSHIP_INTRO,
          State.FINAL,
        ].includes(t.state) && t.current.id === c.id;
      return `<article class="competitor ${current ? "current" : ""} ${t.eliminated?.id === c.id ? "out" : ""}" style="--person:${c.primaryColor}">${portrait(c)}<div class="person-info"><div class="person-name">${escape(c.name)}</div><div class="person-nick">“${escape(c.nickname)}”</div><div class="score-line"><span>QUAL <b>${t.qualifying[c.id]?.total ?? "—"}</b></span><span>FINAL <b>${t.championship[c.id]?.total ?? "—"}</b></span></div></div>${t.eliminated?.id === c.id ? '<span class="person-status">ELIMINATED</span>' : current ? '<span class="person-status">CURRENT TURN</span>' : t.winners.includes(c) ? '<span class="person-status">CHAMPION</span>' : ""}</article>`;
    }).join("");
  }
  update(world) {
    updateCampaignCoach(world, this.campaignSession);
    this.skillMeter.update(worldSkillView(world));
    if (this.passiveStatus.textContent !== world.passiveStatus)
      this.passiveStatus.textContent = world.passiveStatus;
    this.passiveStatus.dataset.warning = String(world.passiveWarning);
    this.hudPhase.textContent = world.landed
      ? "LANDING"
      : world.launched
        ? "AIRBORNE"
        : "RUN-UP";
    this.hudDistance.innerHTML = `${(world.distancePixels / 40).toFixed(1)} <small>m</small>`;
    this.hudRotation.textContent = `${Math.round((world.airRotation * 180) / Math.PI)}°`;
    this.hudTime.innerHTML = `${Math.max(0, (world.launched ? ATTEMPT_LIMIT : 12) - world.elapsed).toFixed(1)} <small>s</small>`;
    this.hint.textContent = world.landed
      ? world.attached
        ? "RIDER ATTACHED · Waiting for the cart to settle"
        : "RIDER DETACHED · Distance and style still count"
      : world.launched
        ? this.touchMedia?.matches
          ? "LEFT / RIGHT TO ROTATE · TAP BRACE NEAR LANDING"
          : "← / A BACK · → / D FORWARD · ↓ / S BRACE"
        : this.touchMedia?.matches
          ? `TAP PUSH ON THE BEAT · ${Math.round(world.cart.speed * 1.5)} km/h`
          : `TAP SPACE / ↑ ON THE BEAT    ·    R TO RESET    ·    ${Math.round(world.cart.speed * 1.5)} km/h`;
  }
  setPaused(value) {
    this.pauseBanner.hidden = !value;
  }
  destroy() {
    this.overlay.removeEventListener("click", this.onClick);
    this.root.removeEventListener("error", this.onImageError, true);
  }
}
