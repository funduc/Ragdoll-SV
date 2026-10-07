import { Records } from "./records.js";
import { syncSounds } from "./sound-events.js";
import { ROOFTOP_FALL_LINE } from "./santor-tour.js";
import { SYNC_CONFIG, SYNC_KEYS, syncResult } from "./sync-config.js";
import { syncMoment, syncLandingETA } from "./sync.js";
import { SyncSave } from "./sync-save.js";
import { SyncUI } from "./sync-ui.js";
import { CHARACTERS } from "./characters.js";
import { PhysicsWorld, STEP_MS } from "./physics.js";
import { scoreAttempt } from "./scoring.js";
import { Tournament, State } from "./tournament.js";
import { Input } from "./input.js";
import { Renderer } from "./renderer.js";
import { UI } from "./ui.js";
import { Introduction } from "./introductions.js";
import { Presentation } from "./presentation.js";
import { TouchControls } from "./touch.js";
import { Tutorial } from "./tutorial.js";
import { SkillMeter } from "./skill-ui.js";
import { Campaign, CampaignState } from "./campaign.js";
import { readRunDeveloperSettings } from "./run-dev.js";
import {
  attemptAchievementFacts,
  campaignAchievementFacts,
  tournamentAchievementFacts,
  BiographyReader,
} from "./achievement-events.js";
import {
  renderAchievementVault,
  showAchievementNotice,
  showAchievementHunts,
  applyAchievementCosmetics,
} from "./achievement-ui.js";
import { AchievementToasts } from "./achievement-toast.js";
import { installAchievementHooks } from "./achievement-dev.js";
import { AudioControls } from "./audio-preferences.js";
import { ReplayRecording, ReplayPlayer, ReplayControls } from "./replay.js";
import { loadPartySetup, savePartySetup } from "./party-config.js";
import { scoreBowling } from "./bowling.js";

class Game {
  constructor() {
    this.developerRun = readRunDeveloperSettings(window.location.search);
    this.achievementDeveloper =
      new URLSearchParams(window.location.search).get("achievementdev") === "1";
    if (this.achievementDeveloper && !this.developerRun)
      this.developerRun = { seed: 1, upgrades: {} };
    this.campaign = new Campaign(undefined, { developer: this.developerRun });
    this.syncSave = new SyncSave(this.campaign.save.storage);
    // Party setup (names, characters, format, chaos) is remembered per browser.
    this.tournament = new Tournament(
      loadPartySetup(this.campaign.save.storage),
    );
    this.syncSerial = 0;
    this.syncSequence = null;
    this.syncUI = new SyncUI((lane) => this.hitSync(lane));
    this.achievements = this.campaign.runs.manager;
    this.vaultOpen = false;
    this.achievementReset = false;
    this.biographyReader = new BiographyReader((facts) =>
      this.achievements.send("biography-read", facts),
    );
    this.mode = "party";
    this.introduction = new Introduction();
    this.tutorial = new Tutorial();
    this.ui = new UI(
      () => this.confirm(),
      (action) => this.practiceAction(action),
      (button) => this.menuAction(button),
      (field) => this.setupField(field),
    );
    this.renderer = new Renderer(document.getElementById("game-canvas"));
    this.world = new PhysicsWorld(CHARACTERS[0]);
    this.presentation = new Presentation(
      document.getElementById("game"),
      document.getElementById("mute-button"),
      () => this.renderer.themes.unlock(),
    );
    this.presentation.onCommentaryDuck = value => this.ui.setCommentaryDucked(value);
    this.presentation.onVoiceDucked = value => this.ui.setVoiceDucked(value);
    this.ui.achievementToasts = new AchievementToasts(document.getElementById("stage"), this.presentation.audio);
    this.presentation.voices.onPlayed = facts => this.achievements.send("voice-played", facts);
    this.presentation.replaceWorld(this.world);
    this.recording = new ReplayRecording(this.world);
    this.replayPlayer = null;
    this.audioControls = new AudioControls(
      document.getElementById("audio-controls"),
      this.presentation.audio.preferences,
    );
    this.accumulator = 0;
    this.lastTime = null;
    this.suspended = false;
    this.destroyed = false;
    this.touch = new TouchControls(
      document.getElementById("touch-controls"),
      () => this.acceptsSkillInput && !this.syncSequence && !this.suspended,
    );
    this.input = new Input({
      isActive: () => this.acceptsSkillInput,
      onControlButton: (button, pressed, code) => {
        if (pressed) this.touch.press(button, `key:${code}`);
        else this.touch.release(`key:${code}`);
      },
      onExclusiveKey: (event) => this.exclusiveKey(event),
      onConfirm: (event) => {
        const menu = event?.target?.closest?.(
          "button[data-replay], button[data-mode], button[data-campaign], button[data-achievement], button[data-audio-enter], button[data-setup], button[data-party], button[data-event]",
        );
        if (menu) {
          this.menuAction(menu);
          return;
        }
        const button = event?.target?.closest?.("[data-practice]");
        if (button) this.practiceAction(button.dataset.practice);
        else this.confirm();
      },
      onRestart: () => this.restartAttempt(),
      onSuspend: (paused) => {
        this.suspended = paused;
        this.syncUI.releaseHolds();
        this.touch.clear();
        this.touch.sync();
        this.lastTime = null;
        this.accumulator = 0;
        this.ui.setPaused(paused && this.session.active);
        this.presentation.audio.setPaused(paused);
        this.presentation.music.setPaused(paused);
      },
    });
    this.replayControls = new ReplayControls(
      window, () => Boolean(this.replayPlayer), () => this.stopReplay(), this.input,
    );
    this.ui.render(this.tournament);
    applyAchievementCosmetics(this.ui, this.renderer, this.achievements);
    this.removeAchievementHooks = installAchievementHooks(
      this.achievements,
      () => this.refreshAchievementVault(),
      window.location.search,
    );
    this.presentation.state(this.tournament);
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }
  get session() {
    return this.mode === "vault" ? this.campaign : this.tournament;
  }
  replaceWorld(character) {
    this.clearSync();
    this.touch?.clear();
    this.world?.dispose();
    // Party Chaos: the round's condition applies to each hand-off's world.
    const chaos =
      this.mode === "party" &&
      this.tournament.state === State.READY &&
      this.tournament.currentRound.condition;
    // Party High Jump: the high-jump course with this round's bar height.
    const highJump =
      this.mode === "party" && this.tournament.highJump
        ? {
            id: "high-jump",
            course: "high-jump",
            barHeight: this.tournament.currentRound.height,
          }
        : this.mode === "party" && this.tournament.bowling
          ? { id: "bowling", course: "bowling" }
          : undefined;
    this.world = new PhysicsWorld(
      character,
      this.mode === "vault" ? this.campaign.attemptArena : highJump,
      this.mode === "vault"
        ? this.campaign.attemptSpec
        : chaos
          ? { condition: chaos }
          : null,
    );
    this.presentation.replaceWorld(this.world);
    this.recording = new ReplayRecording(this.world);
    this.accumulator = 0;
    this.lastTime = null;
    this.renderer.resetCamera();
  }
  get acceptsSkillInput() {
    return (
      this.session.active ||
      (this.mode === "party" && this.tournament.state === State.INSTRUCTIONS)
    );
  }
  practiceAction(action) {
    if (this.mode !== "party" || this.tournament.state !== State.INSTRUCTIONS)
      return;
    if (action === "next") this.tutorial.next();
    else this.tutorial.act();
    this.clearControls();
    this.updatePractice();
    this.presentation.audio.play("menuConfirm", "click");
  }
  updatePractice() {
    this.practiceMeter?.update(this.tutorial.view());
    const action = document.querySelector('[data-practice="action"]');
    const next = document.querySelector('[data-practice="next"]');
    if (action)
      action.textContent = this.tutorial.complete
        ? "Practice again"
        : this.tutorial.result
          ? "Try again"
          : this.tutorial.stage === 2
            ? "Tap BRACE"
            : "Tap PUSH";
    if (next) {
      next.hidden = !this.tutorial.result || this.tutorial.complete;
      next.textContent =
        this.tutorial.stage === 2 ? "Finish practice" : "Next drill";
    }
  }
  confirm() {
    if (this.replayPlayer) return;
    if (this.session.active || this.destroyed) return;
    if (this.vaultOpen) return;
    if (this.mode === "vault") {
      const previous = this.campaign.state;
      this.campaign.confirm();
      this.finishCampaignTransition(previous);
      return;
    }
    if (this.tournament.state === State.TITLE) {
      if (!this.ui.enteredVault) {
        this.enterVault();
        return;
      }
      const focused = document.activeElement?.closest?.("button[data-mode]");
      const choice = focused || document.querySelector('[data-mode="vault"]');
      if (choice) this.menuAction(choice);
      return;
    }
    if (this.introduction.active) {
      this.presentation.audio.play("menuConfirm", "click");
      this.dismissIntroduction();
      return;
    }
    const previous = this.tournament.state;
    if (previous === State.SETUP)
      savePartySetup(this.campaign.save.storage, this.tournament.setup);
    this.tournament.confirm();
    if (this.tournament.state === State.FINAL && previous !== State.FINAL)
      for (const facts of tournamentAchievementFacts(this.tournament))
        this.achievements.send("tournament-won", facts);
    this.clearControls();
    if (
      this.tournament.state === State.READY ||
      this.tournament.state === State.TITLE
    )
      this.replaceWorld(
        this.tournament.state === State.TITLE
          ? CHARACTERS[0]
          : this.tournament.current,
      );
    if (this.tournament.active) {
      this.lastTime = null;
      this.accumulator = 0;
      this.suspended = false;
      this.ui.setPaused(false);
      document.getElementById("game-canvas").focus({ preventScroll: true });
    }
    if (previous !== this.tournament.state) {
      this.renderState();
      this.presentation.audio.play("menuConfirm", "click");
    }
  }
  enterVault() {
    if (
      this.ui.enteredVault ||
      this.tournament.state !== State.TITLE ||
      this.mode !== "party"
    )
      return;
    this.ui.enteredVault = true;
    this.clearControls();
    this.presentation.audio.unlock();
    this.presentation.music.enable();
    this.ui.render(this.tournament);
  }
  renderState() {
    this.biographyReader.tick(null, null, 0, false);
    this.touch.sync();
    this.introduction.clear();
    this.ui.render(this.session);
    this.showAchievementsAfterAttempt();
    this.presentation.state(this.session);
    this.practiceMeter = null;
    if (this.mode === "vault") {
      if (this.campaign.state === State.READY) this.ui.resetAttempt();
      return;
    }
    if (this.tournament.state === State.INSTRUCTIONS) {
      this.tutorial.reset();
      this.practiceMeter = new SkillMeter(
        document.getElementById("tutorial-meter"),
      );
      this.updatePractice();
    }
    if (this.tournament.state === State.READY) {
      this.ui.resetAttempt();
      // John's full character intro plays before each player's first jump.
      const t = this.tournament;
      if (!t.jumpsFor(t.currentPlayer.id).length) {
        this.introduction.start();
        this.ui.showIntroduction(t);
      }
    }
  }
  dismissIntroduction() {
    this.biographyReader.tick(null, null, 0, false);
    this.introduction.clear();
    this.clearControls();
    this.ui.render(this.tournament);
  }
  restartAttempt() {
    if (!this.session.active || !this.world.canRestart) return;
    this.session.resetAttempt();
    this.clearControls();
    this.replaceWorld(this.session.current);
    this.renderState();
  }
  exclusiveKey(event) {
    if (
      event.code === "KeyR" &&
      this.mode === "vault" &&
      this.campaign.state === State.RESULTS
    ) {
      this.retryLevel();
      return true;
    }
    if (!this.syncSequence) return false;
    if (event.code === "KeyR" && !this.suspended) this.restartAttempt();
    else if (Object.hasOwn(SYNC_KEYS, event.code))
      this.hitSync(SYNC_KEYS[event.code]);
    else if (
      event.code === "Space" &&
      event.target?.dataset?.syncLane !== undefined
    )
      this.hitSync(Number(event.target.dataset.syncLane));
    return true; // Includes Enter: never confirm or queue runway controls.
  }
  retryLevel() {
    if (this.replayPlayer) return;
    if (this.destroyed || this.vaultOpen || this.mode !== "vault") return;
    const previous = this.campaign.state;
    this.campaign.retryLevel();
    this.finishCampaignTransition(previous);
  }
  menuAction(button) {
    if (
      this.destroyed ||
      this.replayPlayer ||
      this.session.active ||
      button.disabled ||
      !button.isConnected
    )
      return;
    if (button.hasAttribute("data-replay")) {
      this.startReplay();
      return;
    }
    if (button.hasAttribute("data-audio-enter")) {
      this.enterVault();
      return;
    }
    if (button.dataset.achievement) {
      this.achievementAction(button);
      return;
    }
    if (button.dataset.event) {
      // Title screen event picker; Vault Run stays long jump.
      if (this.mode !== "party" || this.tournament.state !== State.TITLE) return;
      if (this.tournament.setEvent(button.dataset.event)) {
        savePartySetup(this.campaign.save.storage, this.tournament.setup);
        this.presentation.audio.play("menuConfirm", "click");
        this.replaceWorld(CHARACTERS[0]);
        this.renderState();
        document
          .querySelector(`[data-event="${button.dataset.event}"]`)
          ?.focus({ preventScroll: true });
      }
      return;
    }
    if (button.dataset.setup || button.dataset.party) {
      this.partyAction(button);
      return;
    }
    if (this.vaultOpen) return;
    const mode = button.dataset.mode;
    if (mode) {
      if (this.mode !== "party" || this.tournament.state !== State.TITLE)
        return;
      this.clearControls();
      this.presentation.audio.play("menuConfirm", "click");
      if (mode === "vault") {
        // Retain the save owner even if localStorage is unavailable this session.
        this.campaign = new Campaign(this.campaign.save, {
          runs: this.campaign.runs,
          developer: this.developerRun,
        });
        this.mode = "vault";
      } else if (mode === "party") this.tournament.confirm();
      else return;
      this.renderState();
      return;
    }
    if (this.mode !== "vault") return;
    const previous = this.campaign.state;
    switch (button.dataset.campaign) {
      case "select":
        this.campaign.select(button.dataset.value);
        this.presentation.voices?.request(button.dataset.value, "select", false);
        this.presentation.audio.play("characterSelect", "click");
        break;
      case "confirm":
        this.confirm();
        return;
      case "retry":
        this.retryLevel();
        return;
      case "characters":
        this.campaign.changeCharacter();
        break;
      case "level":
        this.campaign.startLevel(button.dataset.value);
        break;
      case "map":
        this.campaign.backToMap();
        break;
      case "reset":
        this.campaign.requestReset();
        break;
      case "reset-confirm":
        if (this.campaign.confirmReset()) this.syncSave.resetRun();
        break;
      case "new-run":
        this.campaign.requestNewRun();
        break;
      case "new-run-confirm":
        if (this.campaign.confirmNewRun()) this.syncSave.resetRun();
        break;
      case "upgrade":
        if (this.campaign.chooseUpgrade(button.dataset.value)) this.finishCampaignTransition(previous, "upgradeChoice");
        return;
      case "skip-upgrade":
        this.campaign.skipUpgrade();
        break;
      case "menu":
        if (![CampaignState.SELECT, CampaignState.MAP].includes(previous))
          return;
        this.mode = "party";
        this.clearControls();
        this.replaceWorld(CHARACTERS[0]);
        this.renderState();
        return;
      default:
        return;
    }
    this.finishCampaignTransition(previous);
  }
  finishCampaignTransition(previous, cue = "menuConfirm") {
    if (previous === this.campaign.state) return;
    this.clearControls();
    if (
      (this.campaign.active && previous !== State.READY) ||
      [State.READY, CampaignState.MAP, CampaignState.SELECT].includes(
        this.campaign.state,
      )
    )
      this.replaceWorld(this.campaign.current || CHARACTERS[0]);
    if (this.campaign.active && previous !== State.READY) this.ui.resetAttempt();
    if (this.campaign.active) {
      this.lastTime = null;
      this.accumulator = 0;
      this.suspended = false;
      this.ui.setPaused(false);
      document.getElementById("game-canvas").focus({ preventScroll: true });
    }
    this.renderState();
    this.presentation.audio.play(cue, "click");
  }
  startSync() {
    if (!this.session.active || this.syncSequence) return false;
    const sequence = syncMoment(this.world, {
      hard: this.mode === "vault" && Boolean(this.campaign.level.stages || this.campaign.level.bonus),
      lastPattern: this.syncSave.data.lastPattern, serial: this.syncSerial,
    });
    if (!sequence) return false;
    this.syncSerial++;
    this.world.syncTriggered = true;
    this.syncSave.recordMoment(this.mode === "vault" ? this.campaign.runs.run : null, sequence.notes.map((n) => n.lane));
    this.clearControls();
    this.syncSequence = sequence;
    this.ui.root.dataset.sync = "playing";
    this.syncUI.show(sequence);
    this.ui.say(SYNC_CONFIG.lines.intro);
    this.presentation.audio.play("sync-whoosh");
    this.touch.sync();
    this.accumulator = 0;
    return true;
  }
  hitSync(lane) {
    if (!this.syncSequence || this.suspended) return;
    this.syncSequence.hit(lane);
    syncSounds(this.syncSequence, this.world, (event, fallback) => this.presentation.audio.play(event, fallback));
    this.syncUI.update(this.syncSequence);
  }
  clearSync() {
    this.syncSequence = null;
    this.syncUI?.hide();
    if (this.ui) delete this.ui.root.dataset.sync;
    this.presentation?.music.setDuck(1);
  }
  tickSync(gap) {
    const sequence = this.syncSequence;
    const elapsed = sequence.tick(gap / 1000) || 0;
    syncSounds(sequence, this.world, (event, fallback) => this.presentation.audio.play(event, fallback));
    const duck = (1 - sequence.timeScale) / (1 - SYNC_CONFIG.timeScale);
    this.presentation.music.setDuck(1 - (1 - SYNC_CONFIG.musicDuck) * duck);
    for (const beat of sequence.beats.splice(0)) this.presentation.audio.play(beat === "count-in" ? "syncCountIn" : "sync-beat", "sync-beat");
    if (sequence.result && !this.world.syncResult) {
      this.world.syncResult = sequence.result;
      this.ui.say(SYNC_CONFIG.lines[sequence.result.grade]);
      if (sequence.result.grade !== "PERFECT SYNC" && sequence.result.perfect + sequence.result.good > 0)
        this.presentation.audio.play("skill-good");
    }
    this.syncUI.update(sequence);
    return elapsed * 1000;
  }
  finishSync() {
    const sequence = this.syncSequence;
    // If a surface gets close, unfinished notes simply expire; control wins.
    const result = sequence.result || syncResult(
      sequence.notes.filter((n) => n.grade === "Perfect").length,
      sequence.notes.filter((n) => n.grade === "Good").length, sequence.extra, sequence.notes.length);
    this.world.syncResult = result;
    if (result.perfect + result.good > 0) {
      this.world.syncCelebration = { until: this.world.elapsed + SYNC_CONFIG.celebrationSeconds,
        grade: result.grade, started: this.world.elapsed };
    }
    this.clearControls();
    this.clearSync();
    this.touch.sync();
    document.getElementById("game-canvas").focus({ preventScroll: true });
  }
  partyAction(button) {
    if (this.mode !== "party" || this.vaultOpen) return;
    const t = this.tournament,
      index = Number(button.dataset.index);
    this.clearControls();
    this.presentation.audio.play("menuConfirm", "click");
    switch (button.dataset.setup || button.dataset.party) {
      case "add":
        if (!t.editSetup({ type: "add" })) return;
        this.renderState();
        document
          .querySelectorAll('#overlay input[data-setup="name"]')
          [t.setup.players.length - 1]?.focus({ preventScroll: true });
        return;
      case "remove":
        if (!t.editSetup({ type: "remove", index })) return;
        this.renderState();
        return;
      case "back":
        if (t.back()) this.renderState();
        return;
      case "rematch":
        if (t.rematch()) {
          this.replaceWorld(CHARACTERS[0]);
          this.renderState();
        }
        return;
    }
  }
  setupField(field) {
    if (this.mode !== "party") return;
    const type = field.dataset.setup;
    const changed = this.tournament.editSetup({
      type,
      index: Number(field.dataset.index),
      value: type === "chaos" ? field.checked : field.value,
    });
    if (changed && type === "character") {
      this.presentation.audio.play("characterSelect", "click");
      this.presentation.voices?.request(field.value, "select", false);
    }
    if (changed && type !== "name") this.ui.renderStandings(this.tournament);
  }
  clearControls() {
    this.input.clear();
    this.touch.clear();
  }
  achievementAction(button) {
    if (this.mode !== "party" || this.tournament.state !== State.TITLE) return;
    const action = button.dataset.achievement;
    if (action !== "open" && !this.vaultOpen) return;
    this.clearControls();
    this.presentation.audio.play("menuConfirm", "click");
    switch (action) {
      case "open":
        this.vaultOpen = true;
        this.achievementReset = false;
        break;
      case "back":
        this.vaultOpen = false;
        this.achievementReset = false;
        this.renderState();
        return;
      case "reset":
        this.achievementReset = true;
        break;
      case "garage":
        this.ui.overlay.querySelector(".achievement-cosmetics")?.scrollIntoView({ block: "start" });
        return;
      case "cancel-reset":
        this.achievementReset = false;
        break;
      case "reset-confirm":
        if (!this.achievementReset) return;
        this.achievements.reset();
        this.ui.achievementToasts?.clear();
        this.achievementReset = false;
        break;
      case "equip":
        this.achievements.equip(button.dataset.value);
        break;
      case "default":
        this.achievements.equip(null, button.dataset.value);
        break;
      default:
        return;
    }
    const scroll = this.ui.overlay.querySelector(".achievement-vault")?.scrollTop || 0;
    this.refreshAchievementVault();
    if (["equip", "default"].includes(action)) {
      this.ui.overlay.querySelector(".achievement-vault").scrollTop = scroll;
      (this.ui.overlay.querySelector(`[data-achievement="${action}"][data-value="${button.dataset.value}"]`) ||
        this.ui.overlay.querySelector('[data-achievement="garage"]'))?.focus({ preventScroll: true });
    }
  }
  refreshAchievementVault() {
    applyAchievementCosmetics(this.ui, this.renderer, this.achievements);
    if (this.vaultOpen)
      renderAchievementVault(
        this.ui,
        this.achievements,
        this.achievementReset,
        Boolean(this.developerRun),
      );
  }
  showAchievementsAfterAttempt() {
    applyAchievementCosmetics(this.ui, this.renderer, this.achievements);
    if ([State.RESULTS, State.FINAL].includes(this.session.state)) {
      showAchievementNotice(this.ui, this.achievements);
      showAchievementHunts(this.ui, this.achievements, this.session.current?.id,
        this.mode === "vault" ? campaignAchievementFacts(this.campaign) : null);
      const line = this.achievements.cosmeticValues().commentary;
      if (line) this.ui.say(line);
    }
  }
  get reducedMotion() {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
  }
  startReplay(automatic = false) {
    if (this.destroyed || this.replayPlayer || this.session.state !== State.RESULTS ||
      !this.recording.available) return;
    this.replayPlayer = new ReplayPlayer(this.recording, {
      automatic, reducedMotion: this.reducedMotion,
    });
    this.clearControls();
    if (!automatic) {
      this.presentation.audio.stopAll();
      this.presentation.voices?.cancel();
    }
    this.ui.overlay.hidden = true;
    this.ui.hud.hidden = true;
    document.getElementById("replay-banner").hidden = false;
    this.ui.say(this.recording.scene.course.id === "rooftop-delivery" && this.session.lastScore.crashCause === "pit-fall"
      ? ROOFTOP_FALL_LINE : this.session.lastScore.crashed
      ? "JOHN: ROLL THAT BACK. THE CART WOULD LIKE A SECOND OPINION!"
      : "JOHN: ONCE MORE FOR THE PEOPLE MEASURING THE LANDING!");
    this.renderer.resetCamera();
    this.lastTime = null;
    document.getElementById("game-canvas").focus({ preventScroll: true });
  }
  stopReplay() {
    if (!this.replayPlayer) return;
    this.replayPlayer = null;
    document.getElementById("replay-banner").hidden = true;
    this.clearControls();
    this.lastTime = null;
    this.renderer.resetCamera();
    this.renderState();
    // Skipping updates the canvas now, without waiting for another animation frame.
    this.renderer.draw(this.world, 0, this.presentation.effects);
  }
  frame(time) {
    if (this.destroyed) return;
    const gap = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    showAchievementNotice(this.ui, this.achievements);
    this.ui.achievementToasts?.tick(gap, !this.suspended && !document.hidden, this.reducedMotion);
    if (this.replayPlayer) {
      this.presentation.audio.setPaused(this.suspended || document.hidden);
      this.presentation.music.setPaused(this.suspended || document.hidden);
      this.presentation.audio.updateDuck();
      this.presentation.voices?.tick();
      this.replayPlayer.reducedMotion = this.reducedMotion;
      if (!this.suspended && !document.hidden && gap <= 250)
        this.replayPlayer.advance(gap / 1000);
      const cosmetics = this.renderer.cosmetics;
      try {
        const replay = this.replayPlayer.sample();
        this.renderer.cosmetics = replay.cosmetics;
        this.renderer.draw(replay.world, Math.min(gap / 1000, 1 / 15), replay.effects);
      } catch (error) {
        // A replay that cannot be drawn ends; it must never stop the game loop.
        console.error(error);
        this.renderer.ctx.reset?.();
        this.renderer.cosmetics = cosmetics;
        this.stopReplay();
        this.raf = requestAnimationFrame(this.frame);
        return;
      }
      this.renderer.cosmetics = cosmetics;
      if (this.replayPlayer.done) this.stopReplay();
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    let finishedScore = null;
    const reading =
      !this.vaultOpen &&
      (this.introduction.active ||
        (this.mode === "vault" &&
          this.campaign.state === CampaignState.PROFILE));
    this.biographyReader.tick(
      reading ? `${this.mode}:${this.session.current.id}` : null,
      this.session.current?.id,
      gap,
      !this.suspended && !document.hidden,
    );
    // Long stalls are discarded; no catch-up storm, teleport, or instant timeout.
    if (gap > 250) {
      this.accumulator = 0;
      this.clearControls();
    } else if (this.session.active && !this.suspended) {
      this.accumulator += this.syncSequence ? this.tickSync(Math.min(gap, 100))
        : Math.min(gap, 100) * (this.world.runEffects?.timeScale(this.world) ?? 1);
      let steps = 0;
      while (this.accumulator >= STEP_MS && steps < 12) {
        this.world.step(this.syncSequence ? { pushes: 0, rotate: 0, brace: false } : this.touch.merge(this.input.consume()));
        this.recording.observe(this.world);
        if (this.mode === "vault") this.campaign.observe(this.world);
        this.presentation.observe(this.world);
        this.accumulator -= STEP_MS;
        steps++;
        this.ui.observeAttempt(this.world, this.session);
        if (this.syncSequence && (this.syncSequence.done || this.world.finished ||
            syncLandingETA(this.world) < SYNC_CONFIG.recoverySeconds + SYNC_CONFIG.safetyMargin)) this.finishSync();
        if (this.world.finished) {
          const score = Object.freeze({
            ...scoreAttempt(this.world.metrics(), this.world.character),
            carnage: this.world.damage.summary(),
            highJump: this.world.highJumpResult(),
            bowling: scoreBowling(this.world.bowlingResult()),
          });
          finishedScore = score;
          if (this.mode === "vault") this.campaign.record(score, this.world);
          else this.tournament.record(score);
          this.soundRecords ||= new Records(this.campaign.save.storage);
          let personalBest = false;
          if (!this.world.invalid && this.world.launched) {
            if (this.mode === "vault") {
              if (!this.campaign.level.stages) personalBest = Boolean(this.soundRecords.submit({ mode: "vault", characterId: this.world.character.id, levelId: this.campaign.level.id, score, launched: true, landed: this.world.landed })?.levelBest);
              else if (this.campaign.levelFinished) {
                const previous = this.soundRecords.levelBest(this.world.character.id, this.campaign.level.id);
                personalBest = this.soundRecords.submitLevelTotal(this.world.character.id, this.campaign.level.id, this.campaign.heats.reduce((n, h) => n + h.score.total, 0)) && Boolean(previous);
              }
            } else {
              const event = this.tournament.event || "long-jump";
              const value = event === "high-jump" ? (score.highJump?.cleared ? score.highJump.height : 0) : event === "bowling" ? score.bowling.points : score.total;
              personalBest = this.soundRecords.submitEvent(this.world.character.id, event, value);
            }
          }
          if (personalBest) this.presentation.audio.play("personalBest");
          this.presentation.voices?.finish(this.world, score, personalBest);
          this.achievements.send(
            "attempt-ended",
            attemptAchievementFacts(
              this.world,
              score,
              this.mode === "vault" ? this.campaign : null,
            ),
          );
          if (this.mode === "vault" && !this.world.invalid)
            this.achievements.send("campaign-progress", {
              ...campaignAchievementFacts(this.campaign),
              syncOccurrences: this.syncSave.data.scope === `${this.campaign.runs.run.characterId}:${this.campaign.runs.run.seed}`
                ? this.syncSave.data.occurrences : 0,
            });
          this.clearControls();
          this.touch.sync();
          this.accumulator = 0;
          this.ui.render(this.session);
          break;
        }
      }
      if (this.session.active) {
        this.startSync();
        this.ui.update(this.world);
      }
    } else if (
      this.mode === "party" &&
      this.tournament.state === State.INSTRUCTIONS &&
      !this.suspended
    ) {
      this.tutorial.tick(
        Math.min(gap / 1000, 0.1),
        this.touch.merge(this.input.consume()),
      );
      this.updatePractice();
    }
    const drawTime = Math.min(gap / 1000, 1 / 15) || 1 / 60;
    this.presentation.frame(
      this.world,
      this.session.active,
      this.suspended,
      drawTime,
      gap,
    );
    if (this.session.active || finishedScore)
      this.recording.capture(this.world, this.presentation.effects, this.renderer.cosmetics);
    this.renderer.draw(this.world, drawTime, this.presentation.effects);
    if (this.session.active || finishedScore) this.ui.trickDisplay?.draw(this.renderer, this.world, (this.ui.hud.offsetTop || 0) + this.ui.hud.offsetHeight, this.suspended ? 0 : drawTime);
    if (finishedScore) {
      if (this.recording.shouldAutoPlay(finishedScore, this.reducedMotion))
        this.startReplay(true);
      else {
        this.showAchievementsAfterAttempt();
        this.presentation.state(this.session);
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.replayControls.destroy();
    this.replayPlayer = null;
    this.recording = null;
    cancelAnimationFrame(this.raf);
    this.clearSync();
    this.syncUI.destroy();
    this.input.destroy();
    this.touch.destroy();
    this.introduction.clear();
    this.world.dispose();
    this.renderer.destroy();
    this.ui.destroy();
    this.ui.achievementToasts?.destroy();
    this.presentation.destroy();
    this.audioControls.destroy();
    this.removeAchievementHooks?.();
  }
}

try {
  const game = new Game();
  // Preserve back/forward-cache pages; dispose only on an actual unload.
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) game.destroy();
  });
} catch (error) {
  console.error(error);
  const panel = document.getElementById("overlay");
  panel.hidden = false;
  panel.textContent =
    "The Vault could not start. Make sure the complete project, including vendor/matter-0.20.0.min.js, is available and reload the page.";
}
