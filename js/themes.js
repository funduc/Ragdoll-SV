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
  pieces: Object.freeze({
    pit: Object.freeze({ fill: "#080e16", stroke: "#ffac6f" }),
    platform: Object.freeze({ fill: "#44565f", stroke: "#9bb3bf" }),
    conveyor: Object.freeze({ fill: "#36413a", stroke: "#b4ef4b" }),
    props: Object.freeze({ fill: "#b9824f", stroke: "#463020" }),
    obstacle: Object.freeze({ fill: "#613d50", stroke: "#ffac6f" }),
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
    pieces: Object.freeze(Object.fromEntries(Object.entries(DEFAULT_THEME.pieces)
      .map(([kind, colors]) => [kind, Object.freeze({ ...colors, ...raw.pieces?.[kind] })]))),
    sponsors: Object.freeze((raw.sponsors ?? DEFAULT_THEME.sponsors)
      .map((board) => Object.freeze([...board]))),
    ambient: raw.ambient ? Object.freeze({
      kind: "snow", color: "#ffffff66", size: 2,
      speed: 14, drift: 4, ...raw.ambient,
      count: Math.max(0, Math.min(48, Math.floor(raw.ambient.count ?? 24))),
    }) : null,
  });
}

const freezer = defineTheme({
  id: "freezer-aisle", accent: "#adf4f7",
  ground: { fill: "#566f7a", edge: "#d3ffff", lines: "#7b9ca5", cracks: "#344e59", distanceStrip: "#36535f" },
  ramp: { fill: "#9fbfc9", outline: "#d7ffff", stripes: "#5a909d", edge: "#ecffff" },
  pieces: { platform: { fill: "#cedde1", stroke: "#84bac7" }, pit: { fill: "#152c3b", stroke: "#adf4f7" } },
  sponsors: [["AISLE 9", "KEEP FROZEN", "#adf4f7"], ["ICE CREAM", "LIDS ARE FOR LANDING", "#cefaff"]],
  backdrop(ctx, { width: w, height: h, label, time, reducedMotion }) {
    ctx.fillStyle = "#233d4d"; ctx.fillRect(0, 0, w, h);
    const floor = h * 0.81, top = h * 0.24;
    ctx.fillStyle = "#79939d"; ctx.fillRect(0, 0, w, top - 12);
    // Fluorescent tubes, steady even when reduced motion is off.
    for (let x = 32; x < w; x += 270) {
      ctx.fillStyle = "#b5eef01e"; ctx.fillRect(x - 10, 23, 206, 44);
      ctx.fillStyle = "#dffff5"; ctx.fillRect(x, 37, 186, 6);
    }
    for (let x = -32; x < w; x += 136) {
      ctx.fillStyle = "#94b1bb"; ctx.fillRect(x, top, 128, floor - top);
      ctx.fillStyle = "#243c50"; ctx.fillRect(x + 7, top + 7, 114, floor - top - 16);
      for (let shelf = 1; shelf <= 3; shelf++) {
        const y = top + shelf * (floor - top) / 4;
        for (let pack = 0; pack < 4; pack++) {
          ctx.fillStyle = ["#729ba6", "#b1b7b0", "#6d8998", "#819aad"][pack];
          ctx.fillRect(x + 13 + pack * 24, y - 24, 19, 24);
        }
        ctx.fillStyle = "#bce9ed"; ctx.fillRect(x + 8, y, 112, 3);
        ctx.fillStyle = "#f6e6a5"; ctx.fillRect(x + 46, y + 3, 38, 12);
        label("$2.99", x + 65, y + 13, 9, "#24303d", "center");
      }
      // Glass glare and handles.
      ctx.fillStyle = "#c3ffff12"; ctx.fillRect(x + 14, top + 10, 16, floor - top - 24);
      ctx.fillStyle = "#e6f4f4"; ctx.fillRect(x + 108, top + 58, 4, 44);
    }
    const posterX = w * 0.67;
    ctx.fillStyle = "#f4dcaf"; ctx.fillRect(posterX, top + 13, 104, 115);
    label("ICE CREAM", posterX + 52, top + 31, 12, "#483557", "center");
    ctx.fillStyle = "#b77a44"; ctx.beginPath(); ctx.moveTo(posterX + 34, top + 72);
    ctx.lineTo(posterX + 72, top + 72); ctx.lineTo(posterX + 53, top + 107); ctx.fill();
    ctx.fillStyle = "#f6b3d1"; ctx.beginPath(); ctx.arc(posterX + 53, top + 60, 24, 0, Math.PI * 2); ctx.fill();
    label("AISLE 9 · FROZEN", 26, top - 24, 14, "#f0ffff");
    // Low fog is analytic in recorded time; no particles or physics to replay.
    if (!reducedMotion) {
      ctx.fillStyle = "#c9faff13";
      for (let i = 0; i < 12; i++) {
        const x = ((i * 137 + time * 11) % (w + 180)) - 90;
        ctx.beginPath(); ctx.ellipse(x, floor - 15 + Math.sin(i + time * 0.4) * 12,
          110, 22, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  },
  drawPiece(renderer, piece) {
    if (piece.type !== "platform") return false;
    const ctx = renderer.ctx, x = piece.x - piece.width / 2, y = piece.y - piece.height / 2;
    ctx.fillStyle = "#cedde1"; ctx.fillRect(x, y, piece.width, piece.height);
    ctx.strokeStyle = "#84bac7"; ctx.lineWidth = 3; ctx.strokeRect(x, y, piece.width, piece.height);
    ctx.fillStyle = "#efffff"; ctx.fillRect(x + 3, y + 2, piece.width - 6, 9);
    for (let lid = 0; lid < 2; lid++) {
      const left = x + 12 + lid * piece.width / 2;
      ctx.fillStyle = "#6094a6"; ctx.fillRect(left, y + 17, piece.width / 2 - 24, 24);
      ctx.fillStyle = "#e4f6f5"; ctx.fillRect(left + 6, y + 26, 26, 5);
    }
    renderer.label(piece.sign, piece.x, y + 62, 14, "#263e50", "center");
    return true;
  },
});

const comedy = defineTheme({
  id: "open-mic", accent: "#ffc97f",
  ground: { fill: "#392f34", edge: "#c29575", lines: "#59424a", cracks: "#251d26", distanceStrip: "#64403d" },
  ramp: { fill: "#64423c", outline: "#b78264", stripes: "#c29357", edge: "#efc185" },
  pieces: { obstacle: { fill: "#b5c3c9", stroke: "#fce5a8" } },
  sponsors: [["THE OPEN MIC", "PLEASE LAND THE JOKE", "#ffc97f"], ["LIVE TONIGHT", "THREE BITS · TWO WHEELS", "#e2b2a3"]],
  backdrop(ctx, { width: w, height: h, label, time, reducedMotion }) {
    ctx.fillStyle = "#34252f"; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < h / 29; row++) {
      for (let x = (row % 2) * -48; x < w; x += 96) {
        ctx.fillStyle = row % 3 ? "#513238" : "#59383b";
        ctx.fillRect(x + 2, row * 29 + 2, 91, 24);
      }
    }
    const cx = w * 0.57, floor = h * 0.8;
    ctx.fillStyle = "#ffe4ad17"; ctx.beginPath(); ctx.moveTo(cx, 16);
    ctx.lineTo(cx - 150, floor); ctx.lineTo(cx + 150, floor); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#18151d"; ctx.fillRect(cx - 18, 0, 36, 24);
    ctx.fillStyle = "#ffe7b4"; ctx.fillRect(cx - 12, 22, 24, 4);
    label("THE OPEN MIC", cx, h * 0.28, Math.min(32, w / 20), "#ffd89c", "center");
    label("ONE CART · NO REFUNDS", cx, h * 0.28 + 23, 11, "#dfaf9c", "center");
    ctx.strokeStyle = "#ad8069"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx + 55, floor - 58); ctx.lineTo(cx + 46, floor);
    ctx.moveTo(cx + 84, floor - 58); ctx.lineTo(cx + 94, floor);
    ctx.moveTo(cx + 50, floor - 21); ctx.lineTo(cx + 90, floor - 21); ctx.stroke();
    ctx.fillStyle = "#bb7057"; ctx.beginPath(); ctx.ellipse(cx + 70, floor - 60, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < Math.ceil(w / 45); i++) {
      const x = i * 45 + 15, bob = reducedMotion ? 0 : Math.sin(time * 2.4 + i * 1.7) * 3;
      const y = floor + 15 + bob + (i % 3) * 6;
      ctx.fillStyle = "#17151f"; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y + 30, 23, 27, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  drawPiece(renderer, piece) {
    if (piece.type !== "obstacle") return false;
    const ctx = renderer.ctx, x = piece.x - piece.width / 2, y = piece.y - piece.height / 2;
    ctx.fillStyle = "#b5c3c9"; ctx.fillRect(x, y, piece.width, piece.height);
    ctx.strokeStyle = "#fce5a8"; ctx.lineWidth = 2; ctx.strokeRect(x, y, piece.width, piece.height);
    if (piece.label === "mic-head") {
      ctx.fillStyle = "#485361"; ctx.fillRect(x + 27, y + 2, 18, 14);
      renderer.label("CLEAR THE MIC", piece.x, y - 24, 12, "#ffe5ad", "center");
    } else {
      ctx.fillStyle = "#798995"; ctx.fillRect(piece.x - 30, y + piece.height - 5, 60, 5);
    }
    return true;
  },
});

export const THEMES = Object.freeze({
  [DEFAULT_THEME.id]: DEFAULT_THEME, [freezer.id]: freezer, [comedy.id]: comedy,
});

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
