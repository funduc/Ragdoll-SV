// Real game modules, DOM, keyboard events, and native Canvas; simulated layout/RAF.
// This is integration testing, not a substitute for a live-browser playthrough.
// Optional test dependencies: npm install --prefix .qa --no-save jsdom@26.1.0 @napi-rs/canvas@0.1.100
// Run: node --experimental-vm-modules tests/dom-flow.mjs
import assert from "node:assert/strict";
import { audioDouble } from "./fake-audio.mjs";
import { CHARACTERS } from "../js/characters.js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { SourceTextModule, runInContext } from "node:vm";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const mobile = Boolean(process.env.MOBILE);
const runCount = mobile ? 1 : 3;
const require = createRequire(import.meta.url);
const { JSDOM } = await import("../.qa/node_modules/jsdom/lib/api.js");
let native;
try {
  native = require("@napi-rs/canvas");
} catch {
  native = createRequire(resolve(root, ".qa/package.json"))("@napi-rs/canvas");
}
const dom = new JSDOM(await readFile(resolve(root, "index.html"), "utf8"), {
  url: "http://localhost/ragdoll-olympics/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const w = dom.window,
  document = w.document,
  context = dom.getInternalVMContext();
const errors = [],
  warnings = [];
w.console.error = (...args) => errors.push(args.map(String).join(" "));
w.console.warn = (...args) => warnings.push(args.map(String).join(" "));
w.addEventListener("error", (e) => errors.push(e.message));
// Parse the actual sheets as a syntax check; JSDOM does not lay them out.
for (const name of ["styles.css", "flash.css"]) {
  const style = document.createElement("style");
  style.textContent = await readFile(resolve(root, name), "utf8");
  document.head.appendChild(style);
  assert.ok(style.sheet?.cssRules.length, `${name} parses`);
}
let hidden = false;
Object.defineProperty(document, "hidden", {
  get: () => hidden,
  configurable: true,
});
const timerCalls = [];
for (const kind of ["setTimeout", "setInterval"]) {
  const original = w[kind].bind(w);
  w[kind] = (...args) => {
    timerCalls.push(kind);
    return original(...args);
  };
}
let frameTime = 0,
  rafId = 0,
  box = mobile ? { width: 330, height: 420 } : { width: 1246, height: 560 };
w.matchMedia = (query) => ({
  matches: query.includes("reduced-motion") ? false : mobile,
  addEventListener() {},
  removeEventListener() {},
});
Object.defineProperty(w, "innerWidth", { value: mobile ? 360 : 1320 });
Object.defineProperty(w, "innerHeight", { value: mobile ? 740 : 900 });
Object.defineProperty(w.performance, "now", { value: () => frameTime });
const AudioDouble = audioDouble(() => frameTime / 1000);
if (!process.env.AUDIO_UNAVAILABLE) w.AudioContext = AudioDouble;
const introVisits = [],
  passiveMessages = Object.fromEntries(
    CHARACTERS.map((c) => [c.id, new Set()]),
  );
const callbacks = new Map(),
  canvases = new WeakMap(),
  observers = [];
w.requestAnimationFrame = (fn) => {
  callbacks.set(++rafId, fn);
  return rafId;
};
w.cancelAnimationFrame = (id) => callbacks.delete(id);
w.ResizeObserver = class {
  constructor(fn) {
    this.fn = fn;
    observers.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
};
w.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
  ...box,
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: box.width,
  bottom: box.height,
});
w.HTMLCanvasElement.prototype.getContext = function () {
  if (!canvases.has(this))
    canvases.set(this, native.createCanvas(this.width, this.height));
  return canvases.get(this).getContext("2d");
};
for (const dimension of ["width", "height"]) {
  const original = Object.getOwnPropertyDescriptor(
    w.HTMLCanvasElement.prototype,
    dimension,
  );
  Object.defineProperty(w.HTMLCanvasElement.prototype, dimension, {
    get: original.get,
    set(value) {
      original.set.call(this, value);
      if (canvases.has(this)) canvases.get(this)[dimension] = value;
    },
  });
}
const registrations = {},
  activeListeners = {};
for (const [name, target, types] of [
  [
    "window",
    w,
    [
      "keydown",
      "keyup",
      "pointerdown",
      "pointerup",
      "pointercancel",
      "blur",
      "focus",
      "pagehide",
    ],
  ],
  ["document", document, ["visibilitychange"]],
  ["overlay", document.getElementById("overlay"), ["click"]],
  ["root", document.getElementById("game"), ["error"]],
  [
    "mute",
    document.getElementById("mute-button"),
    ["click", "keydown", "keyup"],
  ],
  [
    "touch",
    document.getElementById("touch-controls"),
    ["pointerdown", "lostpointercapture", "contextmenu"],
  ],
]) {
  for (const method of ["addEventListener", "removeEventListener"]) {
    const original = target[method].bind(target);
    target[method] = (type, fn, ...rest) => {
      if (types.includes(type)) {
        const key = `${name}:${type}`;
        if (method === "addEventListener") {
          registrations[key] = (registrations[key] || 0) + 1;
          (activeListeners[key] ??= new Set()).add(fn);
        } else activeListeners[key]?.delete(fn);
      }
      return original(type, fn, ...rest);
    };
  }
}
runInContext(
  await readFile(resolve(root, "vendor/matter-0.20.0.min.js"), "utf8"),
  context,
);
const engines = [];
const createEngine = w.Matter.Engine.create;
w.Matter.Engine.create = (...args) => {
  const engine = createEngine(...args);
  engines.push(engine);
  return engine;
};
const updateEngine = w.Matter.Engine.update;
w.Matter.Engine.update = (engine, ...args) => {
  assert.equal(
    engine,
    engines.at(-1),
    "a previous attempt must never be stepped",
  );
  return updateEngine(engine, ...args);
};
const cache = new Map();
async function moduleAt(path) {
  if (cache.has(path)) return cache.get(path);
  const mod = new SourceTextModule(await readFile(path, "utf8"), {
    context,
    identifier: path,
  });
  cache.set(path, mod);
  return mod;
}
const main = await moduleAt(resolve(root, "js/game.js"));
await main.link((specifier, referencer) =>
  moduleAt(resolve(dirname(referencer.identifier), specifier)),
);
await main.evaluate();
assert.equal(AudioDouble.instances.length, 0, "audio must wait for a gesture");
const presentationStats = {
  peakParticles: 0,
  peakVoices: 0,
  bursts: {},
  cues: {},
  shakes: 0,
};
const effectsClass = cache.get(resolve(root, "js/effects.js")).namespace
  .Effects;
const audioClass = cache.get(resolve(root, "js/audio.js")).namespace.SynthAudio;
const originalBurst = effectsClass.prototype.burst;
effectsClass.prototype.burst = function (kind, ...args) {
  originalBurst.call(this, kind, ...args);
  presentationStats.bursts[kind] = (presentationStats.bursts[kind] || 0) + 1;
  presentationStats.peakParticles = Math.max(
    presentationStats.peakParticles,
    this.particles.length,
  );
  assert.ok(this.particles.length <= 96);
};
const originalShake = effectsClass.prototype.shake;
effectsClass.prototype.shake = function () {
  presentationStats.shakes++;
  originalShake.call(this);
};
const originalPlay = audioClass.prototype.play;
audioClass.prototype.play = function (cue, ...args) {
  const before = AudioDouble.instances[0]?.createdSources || 0;
  originalPlay.call(this, cue, ...args);
  if ((AudioDouble.instances[0]?.createdSources || 0) > before)
    presentationStats.cues[cue] = (presentationStats.cues[cue] || 0) + 1;
  presentationStats.peakVoices = Math.max(
    presentationStats.peakVoices,
    this.voices.size,
  );
  assert.ok(this.voices.size <= 24);
};
const game = document.getElementById("game"),
  state = () => game.dataset.state,
  phase = () => document.getElementById("hud-phase").textContent;
const engine = () => engines.at(-1),
  cart = () =>
    w.Matter.Composite.allBodies(engine().world).find(
      (b) => b.label === "cart",
    );
function frame(gap = 1000 / 60) {
  frameTime += gap;
  for (const ctx of AudioDouble.instances) ctx.tick();
  const pending = [...callbacks.values()];
  callbacks.clear();
  for (const callback of pending) callback(frameTime);
  assert.equal(callbacks.size, 1, "exactly one RAF loop");
  assert.equal(
    document.querySelectorAll('.portrait img[src$=".png"]').length,
    0,
    "absent portrait PNGs must never be requested",
  );
  const current = CHARACTERS.find(
    (c) =>
      document.getElementById("hud-name").textContent === c.name.toUpperCase(),
  );
  if (current)
    passiveMessages[current.id].add(
      document.getElementById("passive-status").textContent,
    );
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(warnings.length, 0, warnings.join("\n"));
  assert.equal(
    timerCalls.length,
    0,
    "gameplay must not create timeout/interval timers",
  );
}
function key(code, type = "keydown", repeat = false) {
  const event = new w.KeyboardEvent(type, {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
    repeat,
  });
  w.dispatchEvent(event);
  return event;
}
function tap(code) {
  key(code);
  key(code, "keyup");
}
function confirm() {
  if (mobile) click();
  else tap("Enter");
}
function pointer(action, type = "pointerdown", id = 1, target = null) {
  const button = document.querySelector(`[data-control="${action}"]`);
  const event = new w.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  Object.defineProperty(event, "pointerId", { value: id });
  (
    target ||
    (type === "pointerdown" || type === "lostpointercapture" ? button : w)
  ).dispatchEvent(event);
  return event;
}
function driveKey(code, type = "keydown") {
  if (!mobile) return key(code, type);
  const action = ["Space", "ArrowUp"].includes(code)
    ? "accelerate"
    : ["KeyA", "ArrowLeft"].includes(code)
      ? "left"
      : "right";
  return pointer(
    action,
    type === "keydown" ? "pointerdown" : "pointerup",
    action === "accelerate" ? 10 : 11,
  );
}
function click() {
  const button = document.querySelector('[data-action="confirm"]');
  assert.ok(button);
  button.click();
}
function until(predicate, max = 1500) {
  for (let i = 0; i < max; i++) {
    if (predicate()) return;
    frame();
  }
  assert.fail(`Timed out at ${state()} / ${phase()}`);
}
function currentName() {
  return document.querySelector(".handoff h2")?.textContent;
}
async function screenshot(name) {
  const folder = mobile ? ".qa/canvas-mobile" : ".qa/canvas";
  await mkdir(resolve(root, folder), { recursive: true });
  await writeFile(
    resolve(root, folder, name + ".png"),
    canvases.get(document.getElementById("game-canvas")).toBuffer("image/png"),
  );
}
frame();
assert.equal(state(), "title");
tap("KeyR");
assert.equal(state(), "title");
const mute = document.getElementById("mute-button");
if (!process.env.AUDIO_UNAVAILABLE) {
  assert.equal(AudioDouble.instances.length, 1);
  mute.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      code: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  mute.dispatchEvent(
    new w.KeyboardEvent("keyup", {
      code: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(
    state(),
    "title",
    "Enter on Mute must not also advance the menu",
  );
  assert.equal(mute.textContent, "MUTED");
  assert.equal(w.localStorage.getItem("santor-vault:muted"), "true");
  mute.click();
  assert.equal(mute.textContent, "SOUND ON");
  assert.equal(
    AudioDouble.instances.length,
    1,
    "unmute must reuse the context",
  );
} else {
  assert.equal(mute.textContent, "SOUND N/A");
  assert.equal(mute.disabled, true);
}
// The intended PNGs are absent. Every view uses intentional labeled initials,
// without inserting a missing image URL or even attempting a resource request.
assert.equal(document.querySelectorAll(".portrait img").length, 0);
assert.ok(document.querySelector(".portrait").textContent.includes("JE"));
function finishIntroduction(mode = "skip") {
  assert.equal(state(), "ready");
  assert.equal(game.dataset.introduction, "true");
  const card = document.querySelector(".intro-card");
  assert.ok(card);
  const c = CHARACTERS.find(
    (c) => card.querySelector("h2").textContent === c.fullName,
  );
  assert.ok(c, "introduction identifies the full character name and nickname");
  assert.equal(card.querySelectorAll(".intro-stats > div").length, 3);
  assert.ok(card.textContent.includes(c.biography));
  assert.ok(
    card.textContent.includes(c.strength) &&
      card.textContent.includes(c.weakness),
  );
  assert.ok(card.textContent.includes(c.passive.name));
  assert.ok(
    card.querySelector(".intro-john").textContent.includes("JOHN SANTOR"),
  );
  assert.ok(
    card.querySelector(".portrait").textContent.includes(c.fallbackInitials),
  );
  if (c.id === "owen") {
    assert.equal(card.querySelector(".censored-icon").textContent, "CENSORED");
    assert.ok(
      card
        .querySelector(".censored-keepsake")
        .textContent.includes("Temu D***o."),
    );
    assert.equal(
      card.querySelectorAll(
        ".censored-keepsake img, .censored-keepsake svg, .censored-keepsake canvas",
      ).length,
      0,
    );
  }
  introVisits.push({ character: c.id, mode });
  const physicsTime = engine().timing.timestamp;
  if (mode === "timeout") {
    frame(4999);
    assert.equal(game.dataset.introduction, "true");
    frame(1);
  } else if (mode === "stall") frame(8000);
  else {
    if (mode === "click") click();
    else confirm();
    key("Enter", "keydown", true);
    assert.equal(
      state(),
      "ready",
      "holding Skip cannot also begin the attempt",
    );
    key("Enter", "keyup");
  }
  assert.equal(game.dataset.introduction, "false");
  assert.equal(document.querySelector(".intro-card"), null);
  assert.equal(state(), "ready", "intro expiry only reveals the hand-off");
  assert.equal(
    engine().timing.timestamp,
    physicsTime,
    "introduction never advances physics",
  );
}
const resultRuns = [];
for (let run = 0; run < runCount; run++) {
  assert.equal(state(), "title");
  key("Enter");
  assert.equal(state(), "instructions");
  assert.equal(document.querySelectorAll(".portrait img").length, 0);
  key("Enter", "keydown", true);
  assert.equal(state(), "instructions", "held Enter must not skip screens");
  key("Enter", "keyup");
  confirm();
  assert.equal(state(), "qualifying-intro");
  confirm();
  assert.equal(state(), "ready");
  const results = [];
  let expectedFinalists = [];
  for (let jump = 0; jump < 5; jump++) {
    const expectedActive = jump < 3 ? "active-attempt" : "championship-attempt";
    assert.equal(state(), "ready");
    finishIntroduction(
      run === 0 && jump === 0
        ? "timeout"
        : run === 0 && jump === 2
          ? "stall"
          : run === 0 && jump === 1
            ? "click"
            : "skip",
    );
    const who = currentName();
    assert.ok(who);
    if (jump === 0) assert.equal(who, "Jake Eckler");
    if (jump === 1) assert.equal(who, "Brandon Hale");
    if (jump === 2) assert.equal(who, "Owen Wrate");
    if (jump >= 3)
      assert.equal(
        who,
        expectedFinalists[jump - 3].who,
        "finalist order must match qualifying rank",
      );
    assert.equal(w.Matter.Composite.allBodies(engine().world).length, 17);
    assert.equal(w.Matter.Composite.allConstraints(engine().world).length, 15);
    const readyPosition = { ...cart().position };
    for (let i = 0; i < 5; i++) frame();
    assert.deepEqual(
      { ...cart().position },
      readyPosition,
      "confirmation gates all physics",
    );
    click();
    assert.equal(state(), expectedActive);
    frame();
    if (run === 0 && jump === 0) {
      const accel = document.querySelector('[data-control="accelerate"]');
      const right = document.querySelector('[data-control="right"]');
      assert.equal(
        document.querySelector(".stage").contains(accel),
        false,
        "touch controls are outside the action area",
      );
      pointer("accelerate", "pointerdown", 20);
      pointer("right", "pointerdown", 21);
      assert.equal(accel.getAttribute("aria-pressed"), "true");
      assert.equal(right.getAttribute("aria-pressed"), "true");
      pointer("accelerate", "pointercancel", 20);
      assert.equal(accel.getAttribute("aria-pressed"), "false");
      assert.equal(right.getAttribute("aria-pressed"), "true");
      pointer("right", "lostpointercapture", 21);
      assert.equal(right.getAttribute("aria-pressed"), "false");
      pointer("accelerate", "pointerdown", 22);
      w.dispatchEvent(new w.Event("blur"));
      assert.equal(accel.getAttribute("aria-pressed"), "false");
      assert.equal(accel.disabled, true);
      w.dispatchEvent(new w.Event("focus"));
      assert.equal(accel.disabled, false);
      key("Space");
      pointer("accelerate", "pointerdown", 23);
      pointer("accelerate", "pointerup", 23);
      const before = cart().position.x;
      for (let i = 0; i < 8; i++) frame();
      assert.ok(
        cart().position.x > before + 3,
        "releasing touch must not release the keyboard",
      );
      key("Space", "keyup");
      tap("KeyR");
      finishIntroduction();
      confirm();
      frame();
    }
    if (run === 0 && jump === 0) {
      key("Space");
      for (let i = 0; i < 12; i++) frame();
      tap("KeyR");
      assert.equal(state(), "ready");
      assert.equal(document.querySelector("#attempt-total"), null);
      finishIntroduction();
      confirm();
      frame();
      const before = engine().timing.timestamp;
      key("Space");
      frame(8000);
      assert.equal(engine().timing.timestamp, before, "large gap is discarded");
      const beforeRepeat = cart().position.x;
      key("Space", "keydown", true);
      for (let i = 0; i < 6; i++) frame();
      assert.ok(
        cart().position.x > beforeRepeat + 3,
        "held acceleration must recover after a stalled frame",
      );
      key("Space", "keyup");
      w.dispatchEvent(new w.Event("blur"));
      const paused = engine().timing.timestamp;
      for (let i = 0; i < 90; i++) frame();
      assert.equal(engine().timing.timestamp, paused, "blur pauses physics");
      assert.ok(!document.getElementById("pause-banner").hidden);
      document.dispatchEvent(new w.Event("visibilitychange"));
      frame();
      assert.equal(
        engine().timing.timestamp,
        paused,
        "visible but unfocused stays paused",
      );
      hidden = true;
      w.dispatchEvent(new w.Event("focus"));
      frame();
      assert.equal(
        engine().timing.timestamp,
        paused,
        "hidden but focused stays paused",
      );
      hidden = false;
      document.dispatchEvent(new w.Event("visibilitychange"));
      frame();
      // Resume testing the normal jump from an identical run-up after the probes.
      tap("KeyR");
      assert.equal(state(), "ready");
      finishIntroduction();
      confirm();
      frame();
    }
    if (!process.env.AUDIO_UNAVAILABLE && run === 0 && jump === 1) {
      mute.click();
      assert.equal(state(), expectedActive, "mute cannot end an attempt");
      AudioDouble.instances[0].tick();
      assert.equal(
        AudioDouble.instances[0].connected.size,
        1,
        "mute disconnects every voice",
      );
      const sourceCount = AudioDouble.instances[0].createdSources;
      key("Space");
      for (let i = 0; i < 10; i++) frame();
      key("Space", "keyup");
      assert.equal(
        AudioDouble.instances[0].createdSources,
        sourceCount,
        "muted gameplay stays silent",
      );
      mute.click();
      // Restore the identical test run-up after checking sound during active play.
      tap("KeyR");
      finishIntroduction();
      confirm();
      frame();
    }
    const idle = (run === 1 && jump === 0) || run === 2;
    if (!idle) {
      const accelerator = jump % 2 ? "ArrowUp" : "Space";
      assert.ok(
        driveKey(accelerator).defaultPrevented,
        "gameplay key prevents scrolling",
      );
      until(() => phase() === "AIRBORNE" || state() === "attempt-results");
      assert.equal(phase(), "AIRBORNE");
      tap("KeyR");
      assert.equal(state(), expectedActive, "airborne R cannot erase a score");
      confirm();
      assert.equal(state(), expectedActive, "Enter cannot skip a live jump");
      driveKey(accelerator, "keyup");
      if (run === 0 && jump === 0 && !mobile) {
        const before = { ...cart().position },
          bodyId = cart().id;
        box = { width: 360, height: 560 };
        for (const observer of observers) observer.fn();
        assert.deepEqual({ ...cart().position }, before);
        frame();
        await screenshot("airborne-360");
        Object.defineProperty(w, "devicePixelRatio", {
          value: 2,
          configurable: true,
        });
        box = { width: 820, height: 560 };
        const beforeDpr = { ...cart().position };
        for (const observer of observers) observer.fn();
        assert.deepEqual(
          { ...cart().position },
          beforeDpr,
          "resize preserves coordinates",
        );
        assert.equal(cart().id, bodyId);
        assert.equal(document.getElementById("game-canvas").width, 1640);
        assert.equal(document.getElementById("game-canvas").height, 1120);
        frame();
        await screenshot("airborne-narrow");
        box = { width: 1246, height: 560 };
        Object.defineProperty(w, "devicePixelRatio", {
          value: 1,
          configurable: true,
        });
        for (const observer of observers) observer.fn();
      }
      const rotation =
        jump === 1
          ? "KeyD"
          : jump === 2
            ? run === 1
              ? "KeyA"
              : "ArrowLeft"
            : jump === 4
              ? "ArrowRight"
              : null;
      if (rotation) driveKey(rotation);
      if (run === 0 && jump === 0) {
        for (let i = 0; i < 25; i++) frame();
        await screenshot("airborne");
      }
      until(() => state() === "attempt-results");
      if (rotation) driveKey(rotation, "keyup");
    } else until(() => state() === "attempt-results");
    assert.equal(state(), "attempt-results");
    assert.ok(
      [...document.querySelectorAll("[data-control]")].every(
        (b) => b.disabled && b.getAttribute("aria-pressed") === "false",
      ),
    );
    const values = [...document.querySelectorAll(".score-item strong")].map(
      (e) => Number(e.textContent),
    );
    const total = Number(document.getElementById("attempt-total").textContent);
    assert.equal(
      total,
      values.reduce((a, b) => a + b, 0),
    );
    if (idle) assert.equal(total, 0);
    const character = CHARACTERS.find((c) => c.name === who);
    const summary = document.querySelector(".menu-panel .subline").textContent;
    if (summary.includes("CRASH")) {
      assert.ok(
        document
          .querySelector(".crash-quote")
          .textContent.includes(character.crashQuote),
      );
      if (character.id === "brandon")
        assert.ok(
          character.crashDescriptions.includes(
            document.querySelector(".character-flavor").textContent,
          ),
        );
    }
    results.push({
      who,
      total,
      distance: Number.parseFloat(
        document.querySelector(".score-item small").textContent,
      ),
      summary: document.querySelector(".menu-panel .subline").textContent,
    });
    for (const card of document.querySelectorAll(".competitor")) {
      const name = card.querySelector(".person-name").textContent;
      const values = [...card.querySelectorAll(".score-line b")].map(
        (el) => el.textContent,
      );
      const q = results.slice(0, 3).find((result) => result.who === name);
      const f = results.slice(3).find((result) => result.who === name);
      assert.deepEqual(
        values,
        [q ? String(q.total) : "—", f ? String(f.total) : "—"],
        "scores must remain in their original round",
      );
    }
    const scoreCountBefore = [
      ...document.querySelectorAll(".score-line b"),
    ].filter((e) => e.textContent !== "—").length;
    tap("KeyR");
    assert.equal(state(), "attempt-results");
    assert.equal(
      [...document.querySelectorAll(".score-line b")].filter(
        (e) => e.textContent !== "—",
      ).length,
      scoreCountBefore,
    );
    confirm();
    if (jump === 2) {
      assert.equal(state(), "elimination");
      assert.equal(document.querySelectorAll(".competitor.out").length, 1);
      const ranked = results
        .map((score, index) => ({ ...score, index }))
        .sort(
          (a, b) =>
            b.total - a.total || b.distance - a.distance || a.index - b.index,
        );
      expectedFinalists = ranked.slice(0, 2).reverse();
      assert.equal(
        document.querySelector(".competitor.out .person-name").textContent,
        ranked[2].who,
      );
      confirm();
      assert.equal(state(), "championship-intro");
      confirm();
      assert.equal(state(), "ready");
    } else if (jump < 4) assert.equal(state(), "ready");
  }
  assert.equal(state(), "final-results");
  assert.equal(document.querySelectorAll(".results-table tbody tr").length, 2);
  const best = Math.max(...results.slice(3).map((result) => result.total));
  const expectedWinners = results
    .slice(3)
    .filter((result) => result.total === best)
    .map((result) => result.who)
    .sort();
  const displayedWinners = [...document.querySelectorAll(".competitor")]
    .filter(
      (card) =>
        card.querySelector(".person-status")?.textContent === "CHAMPION",
    )
    .map((card) => card.querySelector(".person-name").textContent)
    .sort();
  assert.deepEqual(
    displayedWinners,
    expectedWinners,
    "only championship totals determine the winner",
  );
  if (run === 2)
    assert.match(
      document.querySelector(".menu-panel h2").textContent,
      /SHARED VICTORY/,
    );
  assert.equal(
    [...document.querySelectorAll(".score-line b")].filter(
      (e) => e.textContent !== "—",
    ).length,
    5,
  );
  resultRuns.push(results);
  frame();
  if (run === 0) await screenshot("winner-confetti");
  if (!process.env.AUDIO_UNAVAILABLE && run === 0) mute.click();
  click();
  assert.equal(state(), "title");
  if (!process.env.AUDIO_UNAVAILABLE && run === 0) {
    assert.equal(mute.textContent, "MUTED", "mute survives tournament restart");
    mute.click();
  }
  assert.ok(
    [...document.querySelectorAll(".score-line b")].every(
      (e) => e.textContent === "—",
    ),
  );
  for (const old of engines.slice(0, -1)) {
    assert.equal(w.Matter.Composite.allBodies(old.world).length, 0);
    assert.equal(w.Matter.Composite.allConstraints(old.world).length, 0);
    assert.equal(old.events.collisionStart.length, 0);
    assert.equal(old.pairs.list.length, 0);
    assert.equal(old.detector.bodies.length, 0);
  }
}
for (const [type, count] of Object.entries(registrations))
  assert.equal(
    count,
    type === "window:keydown" ? 2 : 1,
    `${type} registered once per owner`,
  );
frame();
await screenshot("runway");
// An injected corrupt body must end in a finite result and allow a fresh hand-off.
for (let i = 0; i < 3; i++) confirm();
finishIntroduction();
confirm();
frame();
key("Space");
until(() => phase() === "AIRBORNE");
key("Space", "keyup");
cart().position.x = NaN;
frame();
assert.equal(state(), "attempt-results");
assert.match(
  document.querySelector(".menu-panel .subline").textContent,
  /Physics safety stop/,
);
assert.ok(
  Number.isFinite(Number(document.getElementById("attempt-total").textContent)),
);
confirm();
finishIntroduction();
assert.equal(currentName(), "Brandon Hale");
confirm();
frame();
key("ArrowUp");
until(() => state() === "attempt-results");
key("ArrowUp", "keyup");
assert.ok(Number(document.getElementById("attempt-total").textContent) > 0);
assert.equal(errors.length, 0);
assert.ok(
  CHARACTERS.every((c) =>
    introVisits.some((visit) => visit.character === c.id),
  ),
);
assert.ok(
  [...passiveMessages.jake].some((text) => text.includes("Level assist")),
);
assert.ok(
  [...passiveMessages.brandon].some((text) => text.includes("Unlucky wobble")),
);
assert.ok(passiveMessages.owen.has("Wrate Issue Detected"));
assert.equal(callbacks.size, 1);
w.dispatchEvent(new w.PageTransitionEvent("pagehide", { persisted: false }));
assert.equal(callbacks.size, 0);
assert.equal(w.Matter.Composite.allBodies(engine().world).length, 0);
assert.ok(observers.every((o) => o.disconnected));
assert.equal(
  AudioDouble.instances.length,
  process.env.AUDIO_UNAVAILABLE ? 0 : 1,
);
for (const ctx of AudioDouble.instances) {
  assert.equal(ctx.state, "closed");
  assert.equal(ctx.connected.size, 0);
  assert.equal(ctx.sources.size, 0);
}
for (const [name, listeners] of Object.entries(activeListeners))
  if (name !== "window:pagehide")
    assert.equal(listeners.size, 0, `${name} listeners removed at disposal`);
console.log(
  JSON.stringify(
    {
      status: "PASS",
      tournaments: runCount,
      tournamentAttempts: runCount * 5,
      additionalFaultRecoveryAttempts: 2,
      engineInstances: engines.length,
      introductions: introVisits,
      passiveMessages: Object.fromEntries(
        Object.entries(passiveMessages).map(([id, messages]) => [
          id,
          [...messages],
        ]),
      ),
      consoleErrors: errors,
      consoleWarnings: warnings,
      gameplayTimerCalls: timerCalls,
      presentation: presentationStats,
      audioContexts: AudioDouble.instances.length,
      audioUnavailable: Boolean(process.env.AUDIO_UNAVAILABLE),
      mobileSimulated: mobile,
      checks: [
        "menu confirmation",
        "held Enter",
        "both acceleration keys",
        "A/D and arrow rotation",
        "prelaunch restart",
        "airborne restart lock",
        "absent PNG portraits never requested",
        "all character introductions; skip and five-second expiry",
        "introduction stall and retry cleanup",
        "all passive status messages visible",
        "black-bar-only censored Temu icon",
        "crash quotes and literary Brandon results",
        "large frame gap",
        "blur/focus pause",
        "resize",
        "transparent scores",
        "elimination",
        "championship",
        "restart",
        "single listener set",
        "single RAF loop",
        "world disposal",
        "held controls after a frame gap",
        "combined focus and visibility",
        "failed portrait not retried",
        "exact finalist order and winner",
        "all-idle tournament with shared victory",
        "numeric-fault result and next-attempt recovery",
      ],
      results: resultRuns,
    },
    null,
    2,
  ),
);
dom.window.close();
