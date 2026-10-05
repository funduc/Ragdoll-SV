import { syncStatus } from "./sync.js";
import { CHARACTERS } from "./characters.js";
import { State } from "./tournament.js";
import { ATTEMPT_LIMIT } from "./physics.js";
import { Commentator } from "./commentary.js";
import { SkillMeter, worldSkillView } from "./skill-ui.js";
import { tutorialMarkup } from "./tutorial.js";
import { TrickDisplay } from "./trick-ui.js";
import { TRICK_CONFIG } from "./trick-config.js";
import {
  escape,
  portrait,
  unavailablePortraits,
  scoreCard,
  scoreBreakdown,
  carnageDetails,
} from "./ui-content.js";
import { renderCampaign, updateCampaignCoach } from "./campaign-ui.js";
import { updateRunStatus } from "./run-ui.js";
import { UPGRADES } from "./run-config.js";
import { PARTY_FORMATS, EVENTS } from "./party-config.js";
import {
  setupMarkup,
  roundIntroMarkup,
  roundLine,
  roundLabel,
  handoffMarkup,
  resultsAction,
  scoreboardMarkup,
  scoreboardLine,
  finalMarkup,
  highJumpLine,
  highJumpResultMarkup,
  bowlingResultMarkup,
} from "./party-ui.js";
import { bowlingLine, bowlingLineKind } from "./bowling.js";
import { applause, libraryTooLoud, noisePercent, roadVerse, ROAD_POEM, factoryCycleRemaining, ROOFTOP_FALL_LINE } from "./santor-tour.js";
const button = (label) =>
  `<div class="actions"><button class="btn" data-action="confirm">${label} <small class="keyboard-note">ENTER ↵</small></button></div>`;

export class UI {
  constructor(
    onConfirm,
    onPractice = () => {},
    onMenu = () => {},
    onSetupField = () => {},
  ) {
    this.enteredVault = false;
    this.root = document.getElementById("game");
    this.overlay = document.getElementById("overlay");
    this.hud = document.getElementById("hud");
    this.standings = document.getElementById("standings");
    this.commentary = document.getElementById("commentary");
    this.hint = document.getElementById("play-hint");
    this.boostButton = document.getElementById("touch-boost");
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
        "button[data-replay], button[data-mode], button[data-campaign], button[data-achievement], button[data-audio-enter], button[data-setup], button[data-party], button[data-event]",
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
    // Party setup fields update the setup in place; no re-render while typing.
    this.onField = (event) => {
      const field = event.target.closest?.(
        'input[data-setup="name"], input[data-setup="character"], input[data-setup="format"], input[data-setup="chaos"]',
      );
      if (field) onSetupField(field);
    };
    this.overlay.addEventListener("input", this.onField);
    this.overlay.addEventListener("change", this.onField);
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
    this.syncStatus = document.getElementById("sync-status");
    this.hudDistance = document.getElementById("hud-distance");
    this.hudDistanceLabel = document.getElementById("hud-distance-label");
    this.eventLabel = document.getElementById("event-label");
    this.hudRotation = document.getElementById("hud-rotation");
    this.hudRotationLabel = document.getElementById("hud-rotation-label");
    this.hudTime = document.getElementById("hud-time");
    this.passiveStatus = document.getElementById("passive-status");
  }
  setVoiceDucked(ducked) {
    this.commentary.classList.toggle("commentary-voice-muted", ducked);
  }
  setCommentaryDucked(ducked) {
    this.commentaryDucked = ducked;
    if (!ducked && this.deferredCommentary) {
      const text = this.deferredCommentary; this.deferredCommentary = null; this.say(text);
    }
  }
  say(text) {
    if (!text) return;
    if (this.commentaryDucked) { this.deferredCommentary = text; return; }
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
    this.roadVerse = -1;
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
      if (["launch", "crash", "wrateWarning", "pit-fall"].includes(event))
        queue(event === "crash" && ["pit-fall", "obstacle-impact"].includes(world.crashClassification)
          ? world.crashClassification : event);
      // High Jump: John reacts the moment the bar falls or a flop goes over.
      if (event === "fosbury") this.say(highJumpLine("fosbury"));
      if (event === "barKnocked")
        this.say(highJumpLine(world.highJump?.face ? "face" : "knocked"));
      // Bowling: John calls the moment of impact.
      if (event === "pinsHit") this.say(bowlingLine("hit"));
      if (event === "riderPins") this.say(bowlingLine("carnage"));
    }
    for (const [type, eligible] of [
      ["rotation", world.launched && world.airRotation >= Math.PI / 2],
      ["longJump", world.launched && world.distancePixels >= 1800],
    ]) {
      if (eligible && !this.announced.has(type)) {
        this.announced.add(type);
        queue(type);
      }
    }
    this.say(this.commentator.tick(world.elapsed));
    if (world.course.id === "temu-warehouse" && world.propFacts().propsFallen > 0 && !this.announced.has("ordered-boxes")) {
      this.announced.add("ordered-boxes");
      this.say("OWEN: I ordered these.");
    }
    if (world.course.id === "rooftop-delivery" && world.crashClassification === "pit-fall" && !this.announced.has("roof-fall")) {
      this.announced.add("roof-fall"); this.say(ROOFTOP_FALL_LINE);
    }
    if (world.ribbonCut && !this.announced.has("ribbon-cut")) {
      this.announced.add("ribbon-cut"); this.say("RIBBON CUT! THE VAULT IS OPEN! PLEASE USE THE DOOR NEXT TIME!");
    }
    const verse = roadVerse(world);
    if (verse > this.roadVerse) {
      this.roadVerse = verse;
      this.say(`BRANDON: ${ROAD_POEM[verse]}`);
    }
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
      <div class="handoff">${portrait(c)}<div><h2>${escape(c.fullName)}</h2><p class="tiny">${escape(t.currentPlayer.name.toUpperCase())} JUMPS AS ${escape(c.name.split(" ")[0].toUpperCase())} · ${roundLabel(t)}</p></div></div>
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
    if (this.boostButton) this.boostButton.hidden = true;
    this.syncStatus.hidden = true;
    this.syncStatus.textContent = "";
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
    document.getElementById("run-status").hidden = true;
    if (t.kind === "campaign") {
      renderCampaign(this, t);
      return;
    }
    this.root.dataset.mode = t.state === State.TITLE ? "menu" : "party";
    this.eventLabel.innerHTML =
      t.state === State.TITLE
        ? "<b>01</b> SHOPPING-CART LONG JUMP"
        : t.highJump
          ? "<b>02</b> CART HIGH JUMP"
          : t.bowling
            ? "<b>03</b> CART BOWLING"
            : "<b>01</b> SHOPPING-CART LONG JUMP";
    document.getElementById("session-mode").textContent =
      t.state === State.TITLE ? "CHOOSE YOUR MODE" : "LOCAL PASS & PLAY";
    document.getElementById("session-players").textContent =
      t.state === State.TITLE ? "1–6 PLAYERS" : `${t.players.length} PLAYERS`;
    document.getElementById("standings-title").textContent = "THE COMPETITORS";
    document.getElementById("standings-subtitle").textContent = `${t.highJump ? "HIGH JUMP" : t.bowling ? "BOWLING" : PARTY_FORMATS[t.format].name.toUpperCase()}${t.chaos ? " · CHAOS" : ""}`;
    this.roundLabel.textContent = [
      State.TITLE,
      State.SETUP,
      State.INSTRUCTIONS,
    ].includes(t.state)
      ? "TOURNAMENT STANDBY"
      : t.state === State.FINAL
        ? "TOURNAMENT COMPLETE"
        : `${roundLabel(t)} · ${t.turn + 1} / ${t.roster.length}`;
    document.getElementById("run-status").hidden = !(
      t.active && t.currentRound.condition
    );
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
        html = `<section class="menu-panel title-panel"><p class="eyebrow">EVENT ${{ "long-jump": "01", "high-jump": "02", bowling: "03" }[t.setup.event]} / CHOOSE YOUR MODE</p><h1>RAGDOLL<br><span>OLYMPICS</span></h1><strong class="vault-title">THE SANTOR VAULT</strong><p>One shopping cart with something to prove.<br>A solo campaign or a local pass-and-play tournament.</p>${this.enteredVault ? `<div class="event-picker" role="group" aria-label="Event"><span>EVENT</span>${Object.entries(EVENTS).map(([id, e]) => `<button type="button" class="btn secondary" data-event="${id}" aria-pressed="${t.setup.event === id}">${escape(e.name)}</button>`).join("")}</div><div class="actions mode-choices"><button type="button" class="btn" data-mode="vault">Vault Run <small>1 PLAYER${t.setup.event !== "long-jump" ? " · LONG JUMP" : ""}</small></button><button type="button" class="btn secondary" data-mode="party">Party Tournament <small>2–6 PLAYERS</small></button><button type="button" class="btn secondary" data-achievement="open">Achievement Vault</button></div>` : '<div class="actions"><button type="button" class="btn" data-audio-enter>Enter the Vault <small>ENTER ↵</small></button></div>'}<div class="title-meta"><span>1 DEVICE</span><span>${{ "long-jump": "SHOPPING-CART LONG JUMP", "high-jump": "CART HIGH JUMP", bowling: "CART BOWLING" }[t.setup.event]}</span></div></section>`;
        this.say("John Santor, live from The Santor Vault. Choose your event.");
        break;
      case State.INSTRUCTIONS:
        html = `<section class="menu-panel"><p class="eyebrow">BEFORE YOU SEND IT</p><h2>THE RULES OF THE VAULT</h2><div class="rules-grid"><div class="rule-box"><h3>01 / DRIVE & FLY</h3><p>Tap <kbd>SPACE</kbd> or <kbd>↑</kbd> at the green centre of the rhythm meter. Release each time; holding gives one push. Spam adds wobble.</p><p>In the air, use <kbd>←</kbd> / <kbd>A</kbd> to lean back, <kbd>→</kbd> / <kbd>D</kbd> to lean forward. Aim for wheels down. Tap <kbd>↓</kbd> / <kbd>S</kbd> once just before contact to brace. Too early reduces air control; too late gives no benefit.</p><p>At TAKEOFF, wait for the cart marker in the green boost zone and tap once. Early spends the bonus; Late pitches forward. Touch: tap PUSH / BRACE; hold LEFT / RIGHT.</p><p><kbd>R</kbd> returns to Ready before takeoff. Once airborne, your attempt counts.</p></div><div class="rule-box"><h3>02 / MAKE IT COUNT</h3><p><b>Distance:</b> 10 points per metre from ramp edge to cart centre at first ground contact.</p><p><b>Landing:</b> clean 150 · scrappy 75 · rough / crash 0.</p><p><b>Style:</b> Complete flips and controlled-flight tricks build unique-trick combos. Repeats pay ${TRICK_CONFIG.repeatFactors.map((f) => `${Math.round(f * 100)}%`).join(", ")}. Clean landings multiply trick style ×${TRICK_CONFIG.landingFactors.Clean.toFixed(2)}; crashes retain ×${TRICK_CONFIG.landingFactors.Crash.toFixed(2)}. Partial spins earn no trick points.</p><p><b>Sync Moments:</b> 5 Perfect pushes + Perfect takeoff = Santor Sync. Optional arrow notes appear near the apex. Flight slows, rotation pauses, and arrows / A S W D or touch lanes add style. Ignore them for no penalty; controls return before landing.</p><p><b>Attached:</b> 100 if the rider stays attached through a completed landing.</p></div></div><p class="tiny"><b>${escape(t.event !== "long-jump" ? EVENTS[t.event].name : PARTY_FORMATS[t.format].name)}:</b> ${escape(t.event !== "long-jump" ? EVENTS[t.event].summary : PARTY_FORMATS[t.format].summary)}${t.highJump ? " Clear it upside down for a Fosbury style bonus." : t.bowling ? " Once you land, ← / → nudges the cart to aim high or low." : ""}${t.chaos ? " <b>Chaos:</b> each round rolls a random condition." : ""} Ties go to the better single jump.</p><p class="tiny">A jump ends at rest or after 20 active seconds (12 seconds without takeoff). Switching tabs pauses play. Keyboard or on-screen touch controls.</p><section class="stunt-guide"><h3>What counts as a stunt</h3><p><b>Front Flip:</b> Hold Right / D (touch RIGHT) for one full forward rotation in the air.</p><p><b>Back Flip:</b> Hold Left / A (touch LEFT) for one full backward rotation in the air.</p><p><b>Double Flip:</b> Complete two full flips in the same direction without reversing.</p><p><b>No Hands:</b> Stretch the rider’s grip during a spin, then ease off and recover without ejecting.</p><p><b>Last-Second Appeal:</b> Recover from a steep tilt to wheels-down just before landing.</p><p><b>Clean Flight:</b> Fly mostly level for at least 1.15 seconds and 30 m, without a flip, with the rider attached.</p></section>${tutorialMarkup()}${button("To round 1")}</section>`;
        break;
      case State.SETUP:
        html = setupMarkup(t);
        this.say("Names on the board. Pick a cart pilot. Duplicates are legally fine.");
        break;
      case State.ROUND_INTRO:
        html = roundIntroMarkup(t);
        this.say(roundLine(t));
        break;
      case State.READY:
        html = handoffMarkup(t);
        this.say(
          `${t.currentPlayer.name}, the runway is yours. When you are ready.`,
        );
        break;
      case State.RESULTS: {
        const s = t.lastScore;
        const c = t.current,
          p = t.currentPlayer;
        const literary =
          s.crashed && c.crashDescriptions
            ? c.crashDescriptions[s.quarterTurns % c.crashDescriptions.length]
            : "";
        const flavor = s.crashed
          ? `${literary ? `<p class="character-flavor">${escape(literary)}</p>` : ""}<p class="crash-quote">${escape(c.name.split(" ")[0])}: “${escape(c.crashQuote)}”</p>`
          : "";
        this.caption(
          s.crashed
            ? s.crashCause || "crash"
            : s.landingQuality === "Clean"
              ? "goodLanding"
              : s.distanceMetres >= 45
                ? "longJump"
                : "weakJump",
          c,
          t.round,
        );
        if (t.bowling) this.say(bowlingLine(bowlingLineKind(s.bowling)));
        if (t.highJump)
          this.say(
            highJumpLine(
              s.highJump.fosbury
                ? "fosbury"
                : s.highJump.cleared
                  ? "cleared"
                  : s.highJump.face
                    ? "face"
                    : s.highJump.result,
            ),
          );
        html = `<section class="menu-panel results-panel"><p class="eyebrow">${roundLabel(t)} / ATTEMPT COMPLETE</p><h2>${escape(p.name.toUpperCase())}</h2>${t.highJump ? highJumpResultMarkup(t) : t.bowling ? bowlingResultMarkup(t) : scoreCard(s)}${flavor}${carnageDetails(s)}<p class="tiny">${t.highJump ? `${escape(p.name)}'s best: ${t.bestHeightFor(p.id) ? `${t.bestHeightFor(p.id).toFixed(2)} m` : "—"}` : `${escape(p.name)}'s total: ${t.totalFor(p.id)}`}${t.nextPlayer ? ` · Next: ${escape(t.nextPlayer.name)}` : " · Round complete."}</p><div class="actions">${button(resultsAction(t))}<button type="button" class="btn secondary" data-replay>WATCH REPLAY</button></div>${scoreBreakdown(s)}</section>`;
        break;
      }
      case State.SCOREBOARD:
        html = scoreboardMarkup(t);
        this.say(scoreboardLine(t));
        break;
      case State.FINAL: {
        html = finalMarkup(t);
        this.caption(
          t.winners.length > 1 ? "tie" : "victory",
          t.winners[0].character,
          t.round,
        );
        break;
      }
    }
    this.overlay.innerHTML = html;
    this.overlay
      .querySelector('[data-action="confirm"], [data-audio-enter], [data-mode]')
      ?.focus({ preventScroll: true });
  }
  renderStandings(t) {
    const playing = ![State.TITLE, State.SETUP].includes(t.state);
    const rows = playing
      ? t.players
      : t.setup.players.map((p, i) => ({
          id: `p${i + 1}`,
          name: p.name || `Player ${i + 1}`,
          character: CHARACTERS.find((c) => c.id === p.characterId),
        }));
    this.standings.innerHTML = rows
      .map((p) => {
        const c = p.character,
          out = playing && t.eliminated.some((e) => e.player.id === p.id),
          current =
            [State.ROUND_INTRO, State.READY, State.ACTIVE, State.RESULTS].includes(
              t.state,
            ) && t.currentPlayer.id === p.id,
          winner = t.state === State.FINAL && t.winners.includes(p);
        return `<article class="competitor ${current ? "current" : ""} ${out ? "out" : ""}" style="--person:${c.primaryColor}">${portrait(c)}<div class="person-info"><div class="person-name">${escape(p.name)}</div><div class="person-nick">${escape(c.name)} “${escape(c.nickname)}”</div><div class="score-line">${t.highJump ? `<span>BEST <b>${playing && t.bestHeightFor(p.id) ? `${t.bestHeightFor(p.id).toFixed(2)} m` : "—"}</b></span><span>MISSES <b>${playing ? t.missesFor(p.id) : "—"}</b></span>` : `<span>TOTAL <b>${playing ? t.totalFor(p.id) : "—"}</b></span><span>BEST <b>${playing && t.bestJumpFor(p.id) ? t.pointsOf(t.bestJumpFor(p.id).score) : "—"}</b></span>`}</div></div>${out ? '<span class="person-status">ELIMINATED</span>' : current ? '<span class="person-status">CURRENT TURN</span>' : winner ? '<span class="person-status">CHAMPION</span>' : ""}</article>`;
      })
      .join("");
  }
  update(world) {
    if (this.boostButton) {
      const fx = world.runEffects;
      this.boostButton.hidden = !fx?.upgrades["rocket-booster"];
      const ready = Boolean(fx?.upgrades["rocket-booster"] && world.launched &&
        !world.landed && !world.crashed && !world.finished && !fx.rocketUsed &&
        this.root.dataset.sync !== "playing");
      this.boostButton.dataset.ready = String(ready);
      this.boostButton.disabled = !ready;
    }
    const status = syncStatus(world);
    if (this.syncStatus.textContent !== status) this.syncStatus.textContent = status;
    this.syncStatus.hidden = !status;
    updateCampaignCoach(world, this.campaignSession);
    if (!this.campaignSession && world.runEffects) updateRunStatus(world);
    this.skillMeter.update(worldSkillView(world));
    if (this.passiveStatus.textContent !== world.passiveStatus)
      this.passiveStatus.textContent = world.passiveStatus;
    this.passiveStatus.dataset.warning = String(world.passiveWarning);
    this.hudPhase.textContent = world.landed
      ? "LANDING"
      : world.launched
        ? "AIRBORNE"
        : "RUN-UP";
    // High Jump shows the live clearance height instead of distance.
    const height = world.highJump
      ? Math.max(
          0,
          (world.course.groundY -
            Math.max(...world.dynamic.map((b) => b.bounds.max.y))) /
            40,
        )
      : null;
    this.hudDistanceLabel.textContent = world.bowling
      ? "PINS"
      : height === null
        ? "DISTANCE"
        : "HEIGHT";
    // Bowling shows the live pin count instead of distance.
    this.hudDistance.innerHTML = world.bowling
      ? `${world.pinsDown} <small>/ ${world.pins.length}</small>`
      : `${(height ?? world.distancePixels / 40).toFixed(1)} <small>m</small>`;
    const openMic = world.course.id === "open-mic";
    const library = world.course.id === "quiet-please";
    const factory = world.course.id === "siemens-floor", warehouse = world.course.id === "temu-warehouse";
    this.hudRotationLabel.textContent = openMic ? "APPLAUSE" : library ? "NOISE · LIMIT 100%"
      : factory ? "BACKWARD BELT" : warehouse ? "BOXES KNOCKED" : "AIR ROTATION";
    if (openMic) {
      const unique = world.tricks.unique.size, value = applause(unique, world.crashed);
      const markup = `<span class="applause-value">${value}% · ${unique} tricks</span><meter class="applause-meter" min="0" max="100" value="${value}" aria-label="Crowd applause">${value}%</meter>`;
      if (this.hudRotation.innerHTML !== markup) this.hudRotation.innerHTML = markup;
    } else if (library) {
      const value = noisePercent(world), loud = libraryTooLoud(world);
      const status = world.impactLoudness == null ? "AWAITING LANDING" : loud ? "SHHH! TOO LOUD" : "QUIET";
      const markup = `<span class="noise-value">${value}% · ${status}</span><meter class="noise-meter" min="0" max="150" high="100" optimum="0" value="${Math.min(150, value)}" aria-label="First landing noise; quiet at 100 percent or below">${value}%</meter>`;
      if (this.hudRotation.innerHTML !== markup) this.hudRotation.innerHTML = markup;
    } else if (warehouse) {
      this.hudRotation.innerHTML = `${world.propFacts().propsFallen} <small>/ ${world.looseProps.length}</small>`;
    } else if (factory) {
      const remaining = factoryCycleRemaining(world);
      this.hudRotation.innerHTML = `<span class="tour-counter-value">${world.leftConveyor ? "OFF BELT" : remaining ? `← ${remaining.toFixed(1)} s` : "STOPPED"}</span>`;
    } else this.hudRotation.textContent = `${Math.round((world.airRotation * 180) / Math.PI)}°`;
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
    if (world.launched && !world.landed && !world.crashed) {
      if (world.runEffects?.upgrades["rocket-booster"] && !world.runEffects.rocketUsed)
        this.hint.textContent += " · SPACE / ↑ / BOOST: ROCKET";
      if (world.runEffects?.upgrades["air-brake"] && !world.runEffects.brakeUsed &&
          world.skills.contactETA(world) > UPGRADES["air-brake"].minimumETA)
        this.hint.textContent += " · EARLY ↓ / BRACE: BRAKE";
    }
  }
  setPaused(value) {
    this.pauseBanner.hidden = !value;
  }
  destroy() {
    this.overlay.removeEventListener("click", this.onClick);
    this.overlay.removeEventListener("input", this.onField);
    this.overlay.removeEventListener("change", this.onField);
    this.root.removeEventListener("error", this.onImageError, true);
  }
}
