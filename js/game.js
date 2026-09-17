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

class Game {
  constructor() {
    this.tournament = new Tournament();
    this.introduction = new Introduction();
    this.ui = new UI(() => this.confirm());
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
      () => this.tournament.active && !this.suspended,
    );
    this.input = new Input({
      isActive: () => this.tournament.active,
      onConfirm: () => this.confirm(),
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
        this.world.step(this.touch.merge(this.input.controls));
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
