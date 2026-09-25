import {
  MUSIC_TRACKS,
  GAMEPLAY_TRACKS,
  MUSIC_MASTER_GAIN,
} from "./music-config.js";

// Presentation only: does not mutate a session, physics world or score.
export class MusicDirector {
  constructor(random = Math.random) {
    this.random = random;
    this.lastGameplay = null;
    this.levelKey = null;
    this.levelTrack = null;
  }
  scene(session) {
    const state = session.state;
    if (state === "title") {
      this.levelKey = this.levelTrack = null;
      return "menu";
    }
    if (session.kind !== "campaign" && session.round === "championship")
      return "championship";
    const campaign = session.kind === "campaign";
    if (
      campaign &&
      (!session.level ||
        !["ready", "active-attempt", "attempt-results"].includes(state))
    )
      return "menu";
    const key = campaign
      ? `vault:${session.runs?.run?.seed}:${session.current?.id}:${session.level.id}`
      : `party:${session.round}:${session.turn}:${session.current?.id}`;
    if (session.active && key !== this.levelKey) {
      this.levelKey = key;
      if (campaign && session.level.stages) this.levelTrack = "championship";
      else {
        const choices = GAMEPLAY_TRACKS.filter(
          (id) => id !== this.lastGameplay,
        );
        const value = this.random();
        const index = Number.isFinite(value)
          ? Math.max(
              0,
              Math.min(choices.length - 1, Math.floor(value * choices.length)),
            )
          : 0;
        this.levelTrack = choices[index] || GAMEPLAY_TRACKS[0];
        this.lastGameplay = this.levelTrack;
      }
    }
    return key === this.levelKey &&
      [
        "ready",
        "active-attempt",
        "championship-attempt",
        "attempt-results",
      ].includes(state)
      ? this.levelTrack
      : "menu";
  }
}

// One lazy, streaming media element. Native loop support; no timers, full-track
// buffers or per-attempt listeners. Rejected loads/playback never reach gameplay.
export class MusicPlayer {
  constructor(
    preferences,
    { env = globalThis, getContext = () => null, onAvailable = () => {} } = {},
  ) {
    this.preferences = preferences;
    this.env = env;
    this.getContext = getContext;
    this.onAvailable = onAvailable;
    this.enabled = false;
    this.paused = false;
    this.duck = 1;
    this.destroyed = false;
    this.failed = new Set();
    this.wanted = "menu";
    this.revision = 0;
    this.unsubscribe = preferences.subscribe(() => this.sync());
  }
  enable() {
    if (this.destroyed || this.enabled) return;
    this.enabled = true;
    try {
      this.media = new this.env.Audio();
      this.media.preload = "none";
      this.media.loop = true;
      this.error = () => this.fail(this.current);
      this.media.addEventListener("error", this.error);
      const context = this.getContext();
      if (context?.state === "running" && context.createMediaElementSource) {
        this.gain = context.createGain();
        this.gain.gain.setValueAtTime(0, context.currentTime);
        this.source = context.createMediaElementSource(this.media);
        this.source.connect(this.gain);
        this.gain.connect(context.destination);
        this.context = context;
      }
    } catch {
      // HTML media still works if optional Web Audio routing is unavailable.
      if (!this.media) {
        this.onAvailable(false);
        return;
      }
      try {
        this.gain?.disconnect();
        this.source?.disconnect();
        this.source?.connect(this.getContext().destination);
      } catch {}
      this.gain = null;
    }
    this.onAvailable(true);
    this.sync();
  }
  setTrack(id) {
    this.wanted = Object.hasOwn(MUSIC_TRACKS, id) ? id : null;
    this.sync();
  }
  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.sync();
  }
  setDuck(value = 1) {
    this.duck = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    this.sync();
  }
  sync() {
    if (!this.enabled || !this.media || this.destroyed) return;
    if (this.current !== this.wanted) {
      this.revision++;
      this.pending = false;
      this.blocked = false;
      this.media.pause();
      this.current = this.wanted;
      // A failed file is not requested on every frame, retry or menu return.
      if (this.current && !this.failed.has(this.current))
        this.media.src = MUSIC_TRACKS[this.current].src;
    }
    const silent =
      this.paused ||
      this.preferences.muted ||
      this.preferences.music === 0 ||
      !this.current ||
      this.failed.has(this.current);
    this.setLevel(
      silent
        ? 0
        : this.duck *
            MUSIC_MASTER_GAIN *
            this.preferences.music *
            10 ** (MUSIC_TRACKS[this.current].gainDb / 20),
    );
    if (silent) {
      this.pauseMedia();
      return;
    }
    this.play();
  }
  pauseMedia() {
    // A pending play promise may settle after mute/hide, or after a quick
    // unmute. Invalidate it so it cannot strand or pause the newer request.
    if (this.pending) {
      this.revision++;
      this.pending = false;
    }
    this.media.pause();
  }
  setLevel(level) {
    try {
      if (this.gain) {
        this.media.volume = 1;
        this.gain.gain.setTargetAtTime(level, this.context.currentTime, 0.008);
      } else this.media.volume = Math.max(0, Math.min(1, level));
    } catch {
      /* A volume API failure must not affect the game. */
    }
  }
  play() {
    if (this.pending || this.blocked || !this.media.paused) return;
    const revision = this.revision,
      id = this.current;
    this.pending = true;
    try {
      Promise.resolve(this.media.play())
        .then(() => {
          if (revision !== this.revision || this.destroyed) return;
          this.pending = false;
          if (
            this.paused ||
            this.preferences.muted ||
            this.preferences.music === 0
          )
            this.media.pause();
        })
        .catch((error) => {
          if (revision !== this.revision || this.destroyed) return;
          this.pending = false;
          if (error?.name === "NotAllowedError") this.blocked = true;
          else if (error?.name !== "AbortError") this.fail(id);
        });
    } catch {
      this.pending = false;
      this.fail(id);
    }
  }
  retryFromGesture() {
    if (!this.blocked || !this.enabled) return;
    this.blocked = false;
    this.sync();
  }
  fail(id) {
    if (!id || this.destroyed) return;
    this.failed.add(id);
    if (id === this.current) {
      this.revision++;
      this.pending = false;
      this.media.pause();
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.revision++;
    this.unsubscribe();
    if (this.media) {
      this.media.pause();
      this.media.removeEventListener("error", this.error);
      this.media.removeAttribute("src");
      this.media.load();
    }
    try {
      this.source?.disconnect();
      this.gain?.disconnect();
    } catch {}
  }
}
