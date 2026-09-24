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

class Game {
  constructor() {
    this.tournament = new Tournament();
    this.developerRun = readRunDeveloperSettings(window.location.search);
    this.achievementDeveloper =
      new URLSearchParams(window.location.search).get("achievementdev") === "1";
    if (this.achievementDeveloper && !this.developerRun)
      this.developerRun = { seed: 1, upgrades: {} };
    this.campaign = new Campaign(undefined, { developer: this.developerRun });
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
    this.renderer = new Renderer(document.getElementById("game-canvas"));
    this.world = new PhysicsWorld(CHARACTERS[0]);
    this.presentation = new Presentation(
      document.getElementById("game"),
      document.getElementById("mute-button"),
    );
    this.presentation.replaceWorld(this.world);
    this.accumulator = 0;
    this.lastTime = null;
    this.suspended = false;
    this.destroyed = false;
    this.touch = new TouchControls(
      document.getElementById("touch-controls"),
      () => this.acceptsSkillInput && !this.suspended,
    );
    this.input = new Input({
      isActive: () => this.acceptsSkillInput,
      onConfirm: (event) => {
        const menu = event?.target?.closest?.(
          "button[data-mode], button[data-campaign], button[data-achievement]",
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
        this.touch.clear();
        this.touch.sync();
        this.lastTime = null;
        this.accumulator = 0;
        this.ui.setPaused(paused && this.session.active);
        this.presentation.audio.setPaused(paused);
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
        this.campaign.confirmReset();
        break;
      case "new-run":
        this.campaign.requestNewRun();
        break;
      case "new-run-confirm":
        this.campaign.confirmNewRun();
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
          if (this.mode === "vault") this.campaign.record(score, this.world);
          else this.tournament.record(score);
          this.achievements.send(
            "attempt-ended",
            attemptAchievementFacts(
              this.world,
              score,
              this.mode === "vault" ? this.campaign : null,
            ),
          );
          if (this.mode === "vault" && !this.world.invalid)
            this.achievements.send(
              "campaign-progress",
              campaignAchievementFacts(this.campaign),
            );
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
      this.session.active,
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
    this.input.destroy();
    this.touch.destroy();
    this.introduction.clear();
    this.world.dispose();
    this.renderer.destroy();
    this.ui.destroy();
    this.presentation.destroy();
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
