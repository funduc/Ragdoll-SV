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

class Game {
  constructor() {
    this.tournament = new Tournament();
    this.introduction = new Introduction();
    this.tutorial = new Tutorial();
    this.ui = new UI(
      () => this.confirm(),
      (action) => this.practiceAction(action),
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
        this.ui.setPaused(paused && this.tournament.active);
        this.presentation.audio.setPaused(paused);
      },
    });
    this.ui.render(this.tournament);
    this.presentation.state(this.tournament);
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }
  replaceWorld(character) {
    this.touch?.clear();
    this.world?.dispose();
    this.world = new PhysicsWorld(character);
    this.presentation.replaceWorld(this.world);
    this.accumulator = 0;
    this.lastTime = null;
    this.renderer.resetCamera();
  }
  get acceptsSkillInput() {
    return (
      this.tournament.active || this.tournament.state === State.INSTRUCTIONS
    );
  }
  practiceAction(action) {
    if (this.tournament.state !== State.INSTRUCTIONS) return;
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
    if (this.tournament.active || this.destroyed) return;
    this.presentation.audio.play("click");
    if (this.introduction.active) {
      this.dismissIntroduction();
      return;
    }
    const previous = this.tournament.state;
    this.tournament.confirm();
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
    this.touch.sync();
    this.introduction.clear();
    this.ui.render(this.tournament);
    this.presentation.state(this.tournament);
    this.practiceMeter = null;
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
    this.introduction.clear();
    this.clearControls();
    this.ui.render(this.tournament);
  }
  restartAttempt() {
    if (!this.tournament.active || !this.world.canRestart) return;
    this.tournament.resetAttempt();
    this.clearControls();
    this.replaceWorld(this.tournament.current);
    this.renderState();
  }
  clearControls() {
    this.input.clear();
    this.touch.clear();
  }
  frame(time) {
    if (this.destroyed) return;
    const gap = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    // Long stalls are discarded; no catch-up storm, teleport, or instant timeout.
    if (gap > 250) {
      this.accumulator = 0;
      this.clearControls();
    } else if (this.tournament.active && !this.suspended) {
      this.accumulator += Math.min(gap, 100);
      let steps = 0;
      while (this.accumulator >= STEP_MS && steps < 12) {
        this.world.step(this.touch.merge(this.input.consume()));
        this.presentation.observe(this.world);
        this.accumulator -= STEP_MS;
        steps++;
        this.ui.observeAttempt(this.world, this.tournament);
        if (this.world.finished) {
          this.tournament.record(
            scoreAttempt(this.world.metrics(), this.tournament.current),
          );
          this.clearControls();
          this.touch.sync();
          this.accumulator = 0;
          this.ui.render(this.tournament);
          this.presentation.state(this.tournament);
          break;
        }
      }
      if (this.tournament.active) this.ui.update(this.world);
    } else if (
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
      this.tournament.active,
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
