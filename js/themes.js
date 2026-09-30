import { Stadium } from "./stadium.js";

const stadium = new Stadium();
export const DEFAULT_THEME = Object.freeze({
  id: "santor-vault",
  accent: "#52cefa",
  ground: Object.freeze({
    fill: "#25343c", edge: "#97afba", lines: "#354954", cracks: "#101719",
    distanceStrip: "#31464e",
  }),
  ramp: Object.freeze({
    fill: "#374a56", outline: "#73919f", stripes: "#e68031", edge: "#a3bcc8",
  }),
  sponsors: Object.freeze(stadium.sponsors.map((board) => Object.freeze([...board]))),
  backdrop(ctx, { width, height, label, accent }) {
    stadium.backdrop(ctx, width, height, label, accent);
  },
  backgroundImage: null,
  parallax: 0.04,
  ambient: null,
});

// Backdrops draw in screen pixels, before the ground and gameplay objects.
// Image paths are relative to the project root, e.g. assets/backdrops/yard.webp.
// Ambient particles are decorative only: fog, snow or sparks, capped at 48.
export function defineTheme(raw) {
  return Object.freeze({
    ...DEFAULT_THEME,
    ...raw,
    ground: Object.freeze({ ...DEFAULT_THEME.ground, ...raw.ground }),
    ramp: Object.freeze({ ...DEFAULT_THEME.ramp, ...raw.ramp }),
    sponsors: Object.freeze((raw.sponsors ?? DEFAULT_THEME.sponsors)
      .map((board) => Object.freeze([...board]))),
    ambient: raw.ambient ? Object.freeze({
      kind: "snow", color: "#ffffff66", size: 2,
      speed: 14, drift: 4, ...raw.ambient,
      count: Math.max(0, Math.min(48, Math.floor(raw.ambient.count ?? 24))),
    }) : null,
  });
}

// Add authored themes here; sample themes belong only in tests.
export const THEMES = Object.freeze({ [DEFAULT_THEME.id]: DEFAULT_THEME });

export class ThemePainter {
  constructor({ themes = THEMES, createImage = () => new Image() } = {}) {
    this.themes = themes;
    this.createImage = createImage;
    this.images = new Map();
    this.unlocked = false;
    this.disposed = false;
  }
  resolve(id) {
    return Object.hasOwn(this.themes, id) ? this.themes[id] : DEFAULT_THEME;
  }
  // Called through the existing audio gesture hook; no extra input listeners.
  unlock() {
    if (!this.disposed) this.unlocked = true;
  }
  image(src) {
    if (!this.unlocked || this.disposed) return null;
    if (!this.images.has(src)) {
      const entry = { image: null, ready: false };
      this.images.set(src, entry);
      try {
        const image = this.createImage();
        entry.image = image;
        const finish = (ready) => {
          entry.ready = ready;
          image.onload = image.onerror = null;
        };
        image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => finish(false);
        image.src = new URL(src, new URL("../", import.meta.url)).href;
      } catch {
        if (entry.image) entry.image.onload = entry.image.onerror = null;
      }
    }
    const entry = this.images.get(src);
    return entry.ready ? entry.image : null;
  }
  backdrop(ctx, theme, view) {
    const image = theme.backgroundImage ? this.image(theme.backgroundImage) : null;
    if (image) {
      // Cover the viewport with overscan, then drift slightly with the camera.
      // Clamping keeps the image edges offscreen even on very long courses.
      const { width, height, camera, startX, reducedMotion } = view;
      const pad = Math.max(width, height) * 0.08;
      const scale = Math.max((width + pad * 2) / image.naturalWidth,
        (height + pad * 2) / image.naturalHeight);
      const drift = (value) => reducedMotion ? 0 :
        Math.max(-pad, Math.min(pad, value * theme.parallax));
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      ctx.drawImage(image, (width - w) / 2 - drift(camera.x - startX),
        (height - h) / 2 - drift(camera.y), w, h);
    } else {
      // Pending, missing and unsupported images all retain a usable backdrop.
      const fallback = theme.backgroundImage ? DEFAULT_THEME : theme;
      fallback.backdrop(ctx, view);
    }
    this.ambient(ctx, theme.ambient, view);
  }
  ground(ctx, theme, left, right, y, label) {
    stadium.ground(ctx, left, right, y, label, theme.sponsors, theme.ground.cracks);
  }
  ambient(ctx, particles, { width, height, time, reducedMotion }) {
    if (!particles || reducedMotion) return;
    // Analytic positions use recorded simulation time: pause and replay need
    // no particle state, random draws, physics bodies or independent timers.
    const wrap = (value, extent) => ((value % extent) + extent) % extent;
    ctx.save();
    ctx.fillStyle = particles.color;
    for (let i = 0; i < particles.count; i++) {
      const x = wrap(((i * 7919) % 997) / 997 * width + time * particles.drift, width);
      const direction = particles.kind === "sparks" ? -1 : 1;
      const y = wrap(((i * 3253) % 991) / 991 * height + time * particles.speed * direction, height);
      if (particles.kind === "fog") {
        ctx.beginPath();
        ctx.ellipse(x, y, particles.size * 24, particles.size * 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, particles.size,
          particles.size * (particles.kind === "sparks" ? 3 : 1));
      }
    }
    ctx.restore();
  }
  destroy() {
    this.disposed = true;
    for (const { image } of this.images.values()) {
      if (!image) continue;
      image.onload = image.onerror = null;
      image.removeAttribute?.("src");
    }
    this.images.clear();
  }
}
