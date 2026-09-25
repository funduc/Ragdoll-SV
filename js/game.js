import { SYNC_CONFIG, SYNC_KEYS } from "./sync-config.js";
import { SyncSequence } from "./sync.js";
import { SyncSave, syncRoll } from "./sync-save.js";
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
  applyAchievementCosmetics,
} from "./achievement-ui.js";
import { installAchievementHooks } from "./achievement-dev.js";
import { AudioControls } from "./audio-preferences.js";
import { Records } from "./records.js";
import { installAfterHoursStyles } from "./after-hours-styles.js";

class Game {
  constructor() {
    this.tournament = new Tournament();
    this.developerRun = readRunDeveloperSettings(window.location.search);
    this.forceSync =
      SYNC_CONFIG.force ||
      new URLSearchParams(window.location.search).get("syncdev") === "1";
    if (this.forceSync && !this.developerRun)
      this.developerRun = { seed: 1, upgrades: {} };
    this.achievementDeveloper =
      new URLSearchParams(window.location.search).get("achievementdev") === "1";
    if (this.achievementDeveloper && !this.developerRun)
      this.developerRun = { seed: 1, upgrades: {} };
    this.campaign = new Campaign(undefined, { developer: this.developerRun });
    this.syncSave = new SyncSave(this.campaign.save.storage);
    this.records = new Records(this.campaign.save.storage);
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
    );
    this.ui.records = this.records;
    this.renderer = new Renderer(document.getElementById("game-canvas"));
    this.world = new PhysicsWorld(CHARACTERS[0]);
    this.presentation = new Presentation(
      document.getElementById("game"),
      document.getElementById("mute-button"),
    );
    this.presentation.replaceWorld(this.world);
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
      onExclusiveKey: (event) => {
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
      },
      onConfirm: (event) => {
        const menu = event?.target?.closest?.(
          "button[data-mode], button[data-campaign], button[data-achievement], button[data-audio-enter]",
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
    this.world = new PhysicsWorld(
      character,
      this.mode === "vault" ? this.campaign.attemptArena : undefined,
      this.mode === "vault" ? this.campaign.attemptSpec : null,
    );
    this.presentation.replaceWorld(this.world);
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
    this.presentation.audio.play("click");
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
    this.presentation.audio.play("click");
    if (this.introduction.active) {
      this.dismissIntroduction();
      return;
    }
    const previous = this.tournament.state;
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
    if (previous !== this.tournament.state) this.renderState();
    else if (this.tournament.active) this.revealArena();
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
  // Keep the Canvas, timing meter and touch buttons on screen during a jump.
  // Short laptop screens and phones otherwise start an attempt with the meter
  // (or PUSH/BRACE) below the fold. Layout-only; never touches the simulation.
  revealArena() {
    // Measure after the attempt's HUD, meter and touch row have been laid out.
    if (typeof requestAnimationFrame === "function" && !this.revealFrame) {
      this.revealFrame = requestAnimationFrame(() => {
        this.revealFrame = null;
        if (!this.destroyed && this.session.active) this.scrollArenaIntoView();
      });
    }
  }
  scrollArenaIntoView() {
    const arena = document.querySelector(".arena");
    if (!arena?.getBoundingClientRect || typeof window.scrollTo !== "function")
      return;
    const touch = document.getElementById("touch-controls");
    const meter = document.getElementById("skill-hud");
    const lowest = [meter, touch]
      .filter((el) => el && !el.hidden && el.offsetParent !== null)
      .reduce((n, el) => Math.max(n, el.getBoundingClientRect().bottom), 0);
    const top = arena.getBoundingClientRect().top;
    if (top >= 0 && lowest <= window.innerHeight) return;
    const reduced = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    try {
      window.scrollTo({
        top: Math.max(0, window.scrollY + top - 4),
        behavior: reduced ? "auto" : "smooth",
      });
    } catch {
      // Older/embedded browsers without smooth scrolling keep the old layout.
    }
  }
  renderState() {
    this.biographyReader.tick(null, null, 0, false);
    this.touch.sync();
    this.introduction.clear();
    this.ui.render(this.session);
    if (this.session.active) this.revealArena();
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
      this.introduction.start();
      this.ui.showIntroduction(this.tournament);
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
    if (this.mode === "vault") this.syncSave.finish(this.campaign.level.id);
    this.session.resetAttempt();
    this.clearControls();
    this.replaceWorld(this.session.current);
    this.renderState();
  }
  menuAction(button) {
    if (
      this.destroyed ||
      this.session.active ||
      button.disabled ||
      !button.isConnected
    )
      return;
    if (button.hasAttribute("data-audio-enter")) {
      this.enterVault();
      return;
    }
    if (button.dataset.achievement) {
      this.achievementAction(button);
      return;
    }
    if (this.vaultOpen) return;
    const mode = button.dataset.mode;
    if (mode) {
      if (this.mode !== "party" || this.tournament.state !== State.TITLE)
        return;
      this.clearControls();
      this.presentation.audio.play("click");
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
        break;
      case "confirm":
        this.confirm();
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
        this.campaign.chooseUpgrade(button.dataset.value);
        break;
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
  finishCampaignTransition(previous) {
    if (previous === this.campaign.state) return;
    this.presentation.audio.play("click");
    this.clearControls();
    if (
      [State.READY, CampaignState.MAP, CampaignState.SELECT].includes(
        this.campaign.state,
      )
    )
      this.replaceWorld(this.campaign.current || CHARACTERS[0]);
    if (this.campaign.active) {
      this.lastTime = null;
      this.accumulator = 0;
      this.suspended = false;
      this.ui.setPaused(false);
      document.getElementById("game-canvas").focus({ preventScroll: true });
    }
    this.renderState();
    if (this.campaign.active) this.startSync();
  }
  startSync() {
    if (this.mode !== "vault" || !this.campaign.active) return;
    // Party and tutorial paths never call this, even with the developer flag.
    const decision = this.syncSave.begin(
      this.campaign.runs.run,
      this.campaign.level.id,
      this.campaign.stageIndex,
      this.forceSync,
    );
    if (!decision?.triggered) return;
    if (decision.result) {
      this.world.syncResult = decision.result;
      return;
    }
    this.clearControls();
    this.syncSequence = new SyncSequence(this.campaign.current.id);
    this.ui.root.dataset.sync = "playing";
    const warning =
      this.campaign.current.id === "owen" &&
      syncRoll(this.campaign.runs.run.seed, this.campaign.level.id, 999) <
        SYNC_CONFIG.wrateWarningChance;
    this.syncUI.show(this.syncSequence, warning);
    this.presentation.music.setDuck(SYNC_CONFIG.musicDuck);
    this.touch.sync();
    this.lastTime = null;
    this.accumulator = 0;
  }
  hitSync(lane) {
    if (!this.syncSequence || this.suspended) return;
    const before = this.syncSequence.serial;
    this.syncSequence.hit(lane);
    if (before !== this.syncSequence.serial)
      this.presentation.audio.play(
        `skill-${this.syncSequence.feedback.toLowerCase()}`,
      );
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
    sequence.tick(gap / 1000);
    for (const beat of sequence.beats.splice(0))
      this.presentation.audio.play("sync-beat");
    if (sequence.result && !this.world.syncResult) {
      this.world.syncResult = sequence.result;
      this.syncSave.result(this.campaign.level.id, sequence.result);
      this.ui.root.dataset.sync = "result";
      this.presentation.audio.play(
        sequence.result.grade === "PERFECT SYNC"
          ? "skill-perfect"
          : "skill-good",
      );
    }
    this.syncUI.update(sequence);
    if (sequence.done) {
      this.clearControls();
      this.clearSync();
      this.presentation.audio.stopAll();
      this.presentation.audio.play("sync-drop");
      this.touch.sync();
      this.accumulator = 0;
      this.lastTime = null;
      document.getElementById("game-canvas").focus({ preventScroll: true });
    }
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
    this.presentation.audio.play("click");
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
      case "cancel-reset":
        this.achievementReset = false;
        break;
      case "reset-confirm":
        if (!this.achievementReset) return;
        this.achievements.reset();
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
    this.refreshAchievementVault();
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
      const line = this.achievements.cosmeticValues().commentary;
      if (line) this.ui.say(line);
    }
  }
  frame(time) {
    if (this.destroyed) return;
    const gap = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
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
    } else if (this.syncSequence && !this.suspended) {
      this.tickSync(gap);
    } else if (this.session.active && !this.suspended) {
      this.accumulator += Math.min(gap, 100);
      let steps = 0;
      while (this.accumulator >= STEP_MS && steps < 12) {
        this.world.step(this.touch.merge(this.input.consume()));
        if (this.mode === "vault") this.campaign.observe(this.world);
        this.presentation.observe(this.world);
        this.accumulator -= STEP_MS;
        steps++;
        this.ui.observeAttempt(this.world, this.session);
        if (this.world.finished) {
          const score = scoreAttempt(
            this.world.metrics(),
            this.world.character,
          );
          this.ui.recordFlags = this.records.submit({
            mode: this.mode,
            characterId: this.world.character.id,
            levelId:
              this.mode === "vault" && !this.campaign.level?.stages
                ? this.campaign.level?.id
                : null,
            score,
            launched: this.world.launched,
            landed: this.world.landed,
            valid: !this.world.invalid,
          });
          if (this.mode === "vault") this.campaign.record(score, this.world);
          else this.tournament.record(score);
          if (
            this.mode === "vault" &&
            this.campaign.level?.stages &&
            this.campaign.levelFinished &&
            !this.world.invalid
          )
            this.records.submitLevelTotal(
              this.world.character.id,
              this.campaign.level.id,
              this.campaign.combinedScore,
            );
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
              syncOccurrences: this.syncSave.data.occurrences,
            });
          if (this.mode === "vault")
            this.syncSave.finish(this.campaign.level.id);
          this.clearControls();
          this.touch.sync();
          this.accumulator = 0;
          this.ui.render(this.session);
          this.showAchievementsAfterAttempt();
          this.presentation.state(this.session);
          break;
        }
      }
      if (this.session.active) this.ui.update(this.world);
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
      this.session.active && !this.syncSequence,
      this.suspended,
      drawTime,
      gap,
    );
    this.renderer.draw(this.world, drawTime, this.presentation.effects);
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.revealFrame) cancelAnimationFrame(this.revealFrame);
    this.revealFrame = null;
    this.clearSync();
    this.syncUI.destroy();
    this.input.destroy();
    this.touch.destroy();
    this.introduction.clear();
    this.world.dispose();
    this.renderer.destroy();
    this.ui.destroy();
    this.presentation.destroy();
    this.audioControls.destroy();
    this.removeAchievementHooks?.();
  }
}

installAfterHoursStyles();
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
