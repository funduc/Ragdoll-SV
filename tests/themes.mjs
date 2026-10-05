import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { Renderer } from "../js/renderer.js";
import { DEFAULT_THEME, THEMES, ThemePainter, defineTheme } from "../js/themes.js";
import { DEFAULT_COURSE, defineCourse } from "../js/course.js";
import { PhysicsWorld } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { ReplayRecording, ReplayPlayer } from "../js/replay.js";
import { Presentation } from "../js/presentation.js";
import { Effects } from "../js/effects.js";
import { scoreAttempt } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";

runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
globalThis.window = { devicePixelRatio: 1 };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const motion = { matches: false };
globalThis.matchMedia = () => motion;
function canvas(width = 1200) {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => {
      calls.push([name, ...args]);
      if (name === "createLinearGradient") return {
        addColorStop(...stops) { calls.push(["addColorStop", ...stops]); },
      };
    },
    set: (_, name, value) => {
      calls.push([name, typeof value === "object" ? "gradient" : value]);
      return true;
    },
  });
  return { calls, ctx, getContext: () => ctx,
    getBoundingClientRect: () => ({ width, height: 560 }) };
}
function draw(renderer, canvas, world, effects = null) {
  canvas.calls.length = 0;
  renderer.resetCamera();
  renderer.draw(world, 1 / 60, effects);
  return JSON.stringify(canvas.calls);
}

// Long-jump trace refreshed for the taller launch arc; other traces retain
// the pre-theme baseline at 79b32c4. Every Canvas command and
// style assignment, all characters, three attempt moments, two viewports,
// including equipped arena/cart cosmetics. No Git checkout needed at runtime.
const baseline = {
  "long-jump": "2b9c1229f3a2173938c01ebe9b5e1ff1a4ba0115460b617538eb62914d7aeac2",
  "high-jump": "65983c8c237d3d4a9454abbc6ed6dc732e5f86321839128d0e8c05e651931d60",
  bowling: "21b13307a5165cf6b66511fdb2550ff1fae00ea697bfd56a9507017fb1b3f1c5",
};
for (const [course, expected] of Object.entries(baseline)) {
  const hash = createHash("sha256");
  for (const character of CHARACTERS) {
    const world = new PhysicsWorld(character, { course, barHeight: 2.5 });
    for (const frame of [0, 360, 960]) {
      while (world.elapsed * 120 < frame && !world.finished)
        world.step(timedInputs(world, world.launched ? 1 : 0));
      for (const width of [1200, 390]) {
        const c = canvas(width), renderer = new Renderer(c);
        renderer.cosmetics = width === 390 ? { arena: "#ff00ff", cart: "#00ffff" } : {};
        renderer.draw(world);
        hash.update(JSON.stringify(c.calls));
        renderer.destroy();
      }
    }
    world.dispose();
  }
  assert.equal(hash.digest("hex"), expected, `${course}: matches default-theme drawing baseline`);
}
console.log("PASS default stadium: 54 reference Canvas traces across all events, characters and viewport sizes");

// Sample themes stay in tests; the Vault and eight authored Tour themes ship.
const SAMPLE = defineTheme({
  id: "snow-test",
  accent: "#abcdef",
  ground: { fill: "#ddeeff" },
  ramp: { fill: "#cceeff", stripes: "#000088" },
  sponsors: [["TEST SNOW", "TEST ONLY", "#abc123"]],
  backdrop(ctx, { width, height, accent }) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, width, height);
  },
  ambient: { kind: "snow", count: 100, color: "#fedcba" },
});
const registry = { ...THEMES, [SAMPLE.id]: SAMPLE };
assert.deepEqual(Object.keys(THEMES), [DEFAULT_THEME.id, "freezer-aisle", "open-mic", "mapleton-night-shift", "quiet-please", "siemens-floor", "temu-warehouse", "rooftop-delivery", "grand-reopening"]);
assert.equal(SAMPLE.ambient.count, 48);
const course = defineCourse({ ...DEFAULT_COURSE, theme: SAMPLE.id });
const world = new PhysicsWorld(CHARACTERS[0], { course });
const plain = new PhysicsWorld(CHARACTERS[0]);
const c = canvas(), renderer = new Renderer(c, { themes: registry });
const swapped = draw(renderer, c, world);
assert.match(swapped, /TEST SNOW/);
assert.ok(c.calls.some(([n, v]) => n === "fillStyle" && v === SAMPLE.ground.fill));
assert.ok(c.calls.some(([n, v]) => n === "fillStyle" && v === SAMPLE.ramp.fill));
assert.ok(c.calls.some(([n, v]) => n === "strokeStyle" && v === SAMPLE.ramp.stripes));
assert.ok(c.calls.some(([n, v]) => n === "fillStyle" && v === SAMPLE.accent));
world.arena.theme = DEFAULT_THEME.id;
assert.equal(draw(renderer, c, world), draw(renderer, c, plain), "level arena overrides course theme");
world.arena.theme = "unknown-theme";
assert.equal(draw(renderer, c, world), draw(renderer, c, plain), "unknown IDs use the default theme");
world.arena.theme = SAMPLE.id;
const recording = new ReplayRecording(world), effects = new Effects();
for (let i = 0; i < 1800 && !world.finished; i++) {
  const input = timedInputs(world, world.launched ? 1 : 0);
  world.step(input); plain.step(input);
  assert.deepEqual(world.dynamic.map((b) => [b.position.x, b.position.y, b.angle]),
    plain.dynamic.map((b) => [b.position.x, b.position.y, b.angle]), "theme never changes physics");
  if (i % 30 === 0) {
    recording.capture(world, effects, {});
    const replay = new ReplayPlayer(recording);
    replay.time = world.elapsed;
    const sample = replay.sample();
    assert.equal(draw(renderer, c, sample.world), draw(renderer, c, world),
      "replay retains the level theme and the exact ambient positions");
  }
}
assert.deepEqual(scoreAttempt(world.metrics(), world.character), scoreAttempt(plain.metrics(), plain.character));
assert.equal(recording.scene.arena.theme, SAMPLE.id);
assert.ok(!draw(renderer, c, world).includes("THE SANTOR VAULT"));
motion.matches = true;
assert.ok(!draw(renderer, c, world).includes(SAMPLE.ambient.color), "reduced motion disables ambient particles");
motion.matches = false;
world.dispose(); plain.dispose(); renderer.destroy();
console.log("PASS test-only theme: course/level selection, palette, sponsors, accent, ambient replay, reduced motion and unchanged physics/scores");

// Images are lazy, cached, fall back safely, and never need network in tests.
const images = [];
const createImage = () => {
  const image = { naturalWidth: 2400, naturalHeight: 800,
    removeAttribute(name) { delete this[name]; } };
  images.push(image);
  return image;
};
const painter = new ThemePainter({ createImage });
const photo = defineTheme({ ...SAMPLE, backgroundImage: "assets/backdrops/test.webp", ambient: null });
const view = { width: 1200, height: 560, label: () => {}, accent: DEFAULT_THEME.accent,
  camera: { x: 0, y: 0 }, startX: 0, time: 0, reducedMotion: false };
const imageCanvas = canvas();
const backdrop = (theme = photo, options = view) => {
  imageCanvas.calls.length = 0;
  painter.backdrop(imageCanvas.ctx, theme, options);
  return JSON.stringify(imageCanvas.calls);
};
const defaultBackdrop = backdrop(DEFAULT_THEME);
assert.equal(backdrop(), defaultBackdrop, "before gesture the default backdrop is drawn");
assert.equal(images.length, 0, "no Image constructed or request started before gesture");
// Exercise the existing pointer/keyboard gesture path even without working audio.
const events = new EventTarget();
globalThis.addEventListener = events.addEventListener.bind(events);
globalThis.removeEventListener = events.removeEventListener.bind(events);
const presentation = new Presentation({ dataset: {} }, null, () => painter.unlock());
const repeated = new Event("keydown"); repeated.repeat = true;
events.dispatchEvent(repeated);
assert.equal(painter.unlocked, false);
events.dispatchEvent(new Event("pointerdown"));
assert.equal(painter.unlocked, true);
assert.equal(backdrop(), defaultBackdrop, "loading keeps the default backdrop");
assert.equal(images.length, 1);
assert.equal(images[0].src, new URL("../assets/backdrops/test.webp", import.meta.url).href);
images[0].onload();
backdrop();
const [name, , x, y, w, h] = imageCanvas.calls[0];
assert.equal(name, "drawImage");
assert.ok(x <= 0 && y <= 0 && x + w >= view.width && y + h >= view.height);
const first = backdrop();
const moved = { ...view, camera: { x: 100, y: 10 } };
assert.notEqual(backdrop(photo, moved), first, "slight parallax follows camera");
assert.equal(backdrop(photo, { ...moved, reducedMotion: true }), first,
  "reduced motion fixes the image in place");
backdrop(photo, { ...view, camera: { x: 1e6, y: -1e6 } });
const [, , farX, farY, farW, farH] = imageCanvas.calls[0];
assert.ok(farX <= 0 && farY <= 0 && farX + farW >= view.width && farY + farH >= view.height,
  "parallax cannot reveal image edges");
assert.equal(images.length, 1, "a theme image is loaded only once");
const missing = defineTheme({ ...photo, backgroundImage: "assets/backdrops/missing.webp" });
backdrop(missing); images[1].onerror();
assert.equal(backdrop(missing), defaultBackdrop, "a missing image uses the default backdrop");
assert.equal(images.length, 2, "failed images are not repeatedly requested");
const pending = defineTheme({ ...photo, backgroundImage: "assets/backdrops/pending.webp" });
backdrop(pending);
painter.destroy(); presentation.destroy();
assert.ok(images.every((image) => image.onload === null && image.onerror === null && !image.src));
assert.equal(painter.images.size, 0);
assert.equal(backdrop(), defaultBackdrop);
assert.equal(images.length, 3, "destroyed painters do not request images");
const unavailable = new ThemePainter({ createImage: () => { throw new Error("Images unavailable"); } });
unavailable.unlock();
assert.equal(unavailable.image("missing.webp"), null);
unavailable.destroy();
// The same existing hook also unlocks on the first keyboard gesture.
let keyboardGesture = false;
const keyboard = new Presentation({ dataset: {} }, null, () => { keyboardGesture = true; });
events.dispatchEvent(new Event("keydown"));
assert.equal(keyboardGesture, true);
keyboard.destroy();
console.log("PASS images: first gesture, one request, load failure fallback, parallax coverage, reduced motion, disposal and unsupported image API");
