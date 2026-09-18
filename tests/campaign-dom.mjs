// Full game/DOM/Matter integration with real handlers, simulated RAF and layout.
// This does not claim live-browser rendering or a physical touch device test.
// Same optional dependencies as tests/dom-flow.mjs; no production dependencies.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { SourceTextModule, runInContext } from "node:vm";
import { JSDOM } from "../.qa/node_modules/jsdom/lib/api.js";
import { CHARACTERS } from "../js/characters.js";
import { LEVELS } from "../js/campaign-levels.js";
import { CAMPAIGN_SAVE_KEY as SAVE } from "../js/campaign-save.js";
import { timedInputs } from "./skill-helpers.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const { createCanvas } = createRequire(resolve(root, ".qa/package.json"))(
  "@napi-rs/canvas",
);
const mobile = Boolean(process.env.MOBILE);
const evidence = {
  profiles: [],
  attempts: [],
  reloads: 0,
  modeSwitches: 0,
  consoleErrors: [],
  consoleWarnings: [],
};

async function boot(saved = {}, denied = false) {
  const dom = new JSDOM(readFileSync(resolve(root, "index.html"), "utf8"), {
    url: "http://localhost/ragdoll-olympics/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    document = w.document,
    context = dom.getInternalVMContext();
  for (const [key, value] of Object.entries(saved))
    w.localStorage.setItem(key, value);
  if (denied)
    Object.defineProperty(w, "localStorage", {
      get() {
        throw new Error("Storage denied");
      },
    });
  w.console.error = (...args) =>
    evidence.consoleErrors.push(args.map(String).join(" "));
  w.console.warn = (...args) =>
    evidence.consoleWarnings.push(args.map(String).join(" "));
  w.addEventListener("error", (event) =>
    evidence.consoleErrors.push(event.message),
  );
  for (const filename of [
    "styles.css",
    "flash.css",
    "skills.css",
    "tricks.css",
    "campaign.css",
  ]) {
    const sheet = document.createElement("style");
    sheet.textContent = readFileSync(resolve(root, filename), "utf8");
    document.head.appendChild(sheet);
    assert.ok(sheet.sheet.cssRules.length);
  }
  let now = 0,
    id = 0,
    world = null;
  const callbacks = new Map(),
    native = new WeakMap(),
    engines = [],
    listeners = {};
  for (const [prefix, target, types] of [
    ["window", w, ["keydown", "keyup"]],
    ["overlay", document.getElementById("overlay"), ["click"]],
  ]) {
    const add = target.addEventListener.bind(target);
    target.addEventListener = (type, ...args) => {
      if (types.includes(type))
        listeners[prefix + type] = (listeners[prefix + type] || 0) + 1;
      return add(type, ...args);
    };
  }
  w.setTimeout = w.setInterval = () => {
    throw new Error("Unexpected game timer");
  };
  w.matchMedia = (query) => ({
    matches: query.includes("reduced-motion") ? false : mobile,
    addEventListener() {},
    removeEventListener() {},
  });
  w.requestAnimationFrame = (fn) => {
    callbacks.set(++id, fn);
    return id;
  };
  w.cancelAnimationFrame = (key) => callbacks.delete(key);
  Object.defineProperty(w.performance, "now", { value: () => now });
  w.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  w.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
    width: mobile ? 330 : 1246,
    height: mobile ? 420 : 560,
  });
  w.HTMLCanvasElement.prototype.getContext = function () {
    if (!native.has(this))
      native.set(this, createCanvas(this.width, this.height));
    return native.get(this).getContext("2d");
  };
  for (const key of ["width", "height"]) {
    const descriptor = Object.getOwnPropertyDescriptor(
      w.HTMLCanvasElement.prototype,
      key,
    );
    Object.defineProperty(w.HTMLCanvasElement.prototype, key, {
      get: descriptor.get,
      set(value) {
        descriptor.set.call(this, value);
        if (native.has(this)) native.get(this)[key] = value;
      },
    });
  }
  runInContext(
    readFileSync(resolve(root, "vendor/matter-0.20.0.min.js"), "utf8"),
    context,
  );
  const create = w.Matter.Engine.create;
  w.Matter.Engine.create = (...args) => {
    const engine = create(...args);
    engines.push(engine);
    return engine;
  };
  const cache = new Map();
  function moduleAt(path) {
    if (!cache.has(path))
      cache.set(
        path,
        new SourceTextModule(readFileSync(path, "utf8"), {
          identifier: path,
          context,
        }),
      );
    return cache.get(path);
  }
  const main = moduleAt(resolve(root, "js/game.js"));
  await main.link((specifier, ref) =>
    moduleAt(resolve(dirname(ref.identifier), specifier)),
  );
  // Observe the real world; input below still uses actual game event listeners.
  await main.evaluate();
  const PhysicsWorld = cache.get(resolve(root, "js/physics.js")).namespace
    .PhysicsWorld;
  const vehicle = PhysicsWorld.prototype.createVehicle;
  PhysicsWorld.prototype.createVehicle = function (...args) {
    world = this;
    return vehicle.apply(this, args);
  };
  const step = PhysicsWorld.prototype.step;
  PhysicsWorld.prototype.step = function (...args) {
    world = this;
    return step.apply(this, args);
  };
  const $ = (selector) => document.querySelector(selector);
  const state = () => $("#game").dataset.state;
  const frame = (dt = 1000 / 120) => {
    now += dt;
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const fn of pending) fn(now);
    assert.equal(callbacks.size, 1);
    assert.deepEqual(evidence.consoleErrors, []);
    assert.deepEqual(evidence.consoleWarnings, []);
    assert.equal(document.querySelectorAll(".portrait img").length, 0);
  };
  const key = (
    code,
    type = "keydown",
    repeat = false,
    target = document.activeElement,
  ) => {
    const event = new w.KeyboardEvent(type, {
      code,
      bubbles: true,
      cancelable: true,
      repeat,
    });
    (target || w).dispatchEvent(event);
    return event;
  };
  const tap = (code) => {
    key(code);
    key(code, "keyup");
  };
  const click = (selector) => {
    const button = $(selector);
    assert.ok(button, selector);
    assert.equal(button.disabled, false);
    button.click();
  };
  const choose = (action, value) =>
    click(
      `[data-campaign="${action}"]${value ? `[data-value="${value}"]` : ""}`,
    );
  const pointer = (action, down) => {
    const event = new w.MouseEvent(down ? "pointerdown" : "pointerup", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    Object.defineProperty(event, "pointerId", {
      value: ["push", "brace", "left", "right"].indexOf(action) + 1,
    });
    (down ? $(`[data-control="${action}"]`) : w).dispatchEvent(event);
  };
  const driveTap = (code) => {
    if (!mobile) {
      tap(code);
      return;
    }
    const action = code === "Space" ? "push" : "brace";
    pointer(action, true);
    pointer(action, false);
  };
  let rotationHeld = 0;
  const rotate = (value) => {
    if (value === rotationHeld) return;
    if (rotationHeld) {
      if (mobile) pointer(rotationHeld > 0 ? "right" : "left", false);
      else key(rotationHeld > 0 ? "ArrowRight" : "ArrowLeft", "keyup");
    }
    rotationHeld = value;
    if (value) {
      if (mobile) pointer(value > 0 ? "right" : "left", true);
      else key(value > 0 ? "ArrowRight" : "ArrowLeft");
    }
  };
  const savedData = () =>
    Object.fromEntries(
      Object.keys(w.localStorage).map((key) => [
        key,
        w.localStorage.getItem(key),
      ]),
    );
  function validateDisposal() {
    for (const old of engines.slice(0, -1)) {
      assert.equal(w.Matter.Composite.allBodies(old.world).length, 0);
      assert.equal(w.Matter.Composite.allConstraints(old.world).length, 0);
      assert.equal(old.events.collisionStart.length, 0);
    }
    assert.equal(
      listeners.windowkeydown,
      2,
      "input and audio each register once",
    );
    assert.equal(listeners.windowkeyup, 1);
    assert.equal(listeners.overlayclick, 1);
  }
  function finishAttempt({
    target = "Perfect",
    idle = false,
    flip = false,
  } = {}) {
    assert.equal(state(), "active-attempt");
    frame();
    for (let count = 0; count < 2800 && state() === "active-attempt"; count++) {
      if (!idle) {
        const controls = timedInputs(world, 0, true, target);
        if (controls.pushes) driveTap("Space");
        if (controls.brace) driveTap("ArrowDown");
        let spin = 0;
        if (world.launched && !world.landed) {
          const value =
            flip && world.cart.angle - world.launchAngle < 2 * Math.PI
              ? 1
              : -Math.atan2(
                  Math.sin(world.cart.angle),
                  Math.cos(world.cart.angle),
                ) *
                  2 -
                world.cart.angularVelocity * 28;
          spin = Math.abs(value) < 0.1 ? 0 : Math.sign(value);
        }
        rotate(spin);
      }
      frame();
    }
    rotate(0);
    assert.equal(state(), "attempt-results");
    const values = [...document.querySelectorAll(".score-item strong")].map(
      (node) => Number(node.textContent),
    );
    assert.equal(
      Number($("#attempt-total").textContent),
      values.reduce((a, b) => a + b, 0),
    );
    const rank = Number($("#campaign-award .campaign-medal").dataset.medal);
    evidence.attempts.push({
      character: world.character.id,
      rank,
      takeoff: $("#result-takeoff").textContent,
      brace: $("#result-brace").textContent,
      score: Number($("#attempt-total").textContent),
    });
    assert.equal($("#campaign-coach").hidden, true);
    return rank;
  }
  frame();
  return {
    dom,
    w,
    document,
    $,
    state,
    frame,
    key,
    tap,
    click,
    choose,
    driveTap,
    finishAttempt,
    savedData,
    validateDisposal,
    get world() {
      return world;
    },
    close() {
      validateDisposal();
      w.dispatchEvent(
        new w.PageTransitionEvent("pagehide", { persisted: false }),
      );
      assert.equal(callbacks.size, 0);
      for (const engine of engines)
        assert.equal(w.Matter.Composite.allBodies(engine.world).length, 0);
      dom.window.close();
    },
  };
}

let game = await boot({
  "santor-vault:muted": "true",
  "unrelated-project": "preserved",
});
const startVault = () => {
  game.click('button[data-mode="vault"]');
  assert.equal(game.state(), "campaign-select");
};
function select(c) {
  game.choose("select", c.id);
  assert.equal(game.state(), "campaign-profile");
  const card = game.$(".intro-card"),
    markup = card.innerHTML;
  for (const text of [
    c.fullName,
    c.biography,
    c.strength,
    c.weakness,
    c.passive.description,
    c.crashQuote,
  ])
    assert.ok(card.textContent.includes(text));
  assert.equal(
    card.querySelectorAll(".intro-stats > div").length,
    c.statistics.length,
  );
  if (c.id === "owen")
    assert.equal(card.querySelector(".censored-icon").textContent, "CENSORED");
  for (let i = 0; i < 160; i++) game.frame(100);
  assert.equal(card.innerHTML, markup);
  game.key("Enter");
  assert.equal(game.state(), "campaign-map");
  for (let i = 0; i < 10; i++) game.key("Enter", "keydown", true);
  assert.equal(game.state(), "campaign-map");
  game.key("Enter", "keyup");
  evidence.profiles.push(c.id);
}
function play(level, opts) {
  game.choose("level", level.id);
  assert.equal(game.state(), "ready");
  const current = game.world;
  assert.equal(current.engine.gravity.y, level.arena.gravity);
  game.key("Space"); // A held menu key must not turn into a campaign push.
  game.choose("confirm");
  assert.equal(game.state(), "active-attempt");
  game.frame();
  game.key("Space", "keydown", true);
  game.frame();
  assert.equal(
    Object.values(current.skills.pushes).reduce((a, b) => a + b, 0),
    0,
  );
  game.key("Space", "keyup");
  assert.equal(game.$("#campaign-coach").hidden, false);
  assert.match(
    game.$("#campaign-coach").textContent,
    new RegExp(level.modifier.name),
  );
  return game.finishAttempt(opts);
}
startVault();
for (const c of CHARACTERS) {
  select(c);
  assert.equal(
    game.$(`[data-campaign="level"][data-value="${LEVELS[1].id}"]`).disabled,
    true,
    "new character has separate locks",
  );
  const old = game.savedData();
  // A locked DOM control cannot enter the level.
  game.$(`[data-campaign="level"][data-value="${LEVELS[1].id}"]`).click();
  assert.equal(game.state(), "campaign-map");
  assert.deepEqual(game.savedData(), old);
  if (c.id === "jake") {
    assert.equal(play(LEVELS[0], { idle: true }), 0);
    game.choose("confirm");
    assert.equal(
      game.$(`[data-campaign="level"][data-value="${LEVELS[1].id}"]`).disabled,
      true,
    );
    assert.ok(play(LEVELS[0], { target: "Early" }) >= 1);
    assert.notEqual(game.$("#result-takeoff").textContent, "Perfect");
    game.choose("confirm");
  }
  assert.equal(play(LEVELS[0]), 3);
  game.choose("confirm");
  assert.equal(game.state(), "campaign-map");
  let snapshot = JSON.parse(game.savedData()[SAVE]);
  assert.equal(snapshot.progress[c.id][LEVELS[0].id].medal, 3);
  assert.equal(Object.keys(snapshot.progress[c.id]).length, 3);
  assert.ok(play(LEVELS[1]) >= 1);
  game.choose("confirm");
  assert.ok(play(LEVELS[2], { flip: true }) >= 1);
  game.choose("confirm");
  assert.match(game.$(".campaign-map-panel").textContent, /RUN COMPLETE/);
  if (c.id === "jake") {
    assert.equal(play(LEVELS[0], { idle: true }), 0);
    assert.match(game.$("#campaign-award").textContent, /BEST KEPT: Gold/);
    game.choose("confirm");
    const saved = game.savedData();
    game.close();
    game = await boot(saved);
    evidence.reloads++;
    startVault();
    select(c);
    assert.equal(
      game.$(`[data-level="${LEVELS[0].id}"] .campaign-medal`).textContent,
      "Gold",
    );
    assert.equal(
      game.$(`[data-campaign="level"][data-value="${LEVELS[2].id}"]`).disabled,
      false,
    );
  }
  if (c.id !== "owen") game.choose("characters");
}
const beforeReset = game.savedData();
game.choose("reset");
assert.equal(game.state(), "campaign-reset");
assert.match(game.document.activeElement.textContent, /Cancel/);
game.tap("Enter");
assert.equal(game.state(), "campaign-map");
assert.deepEqual(game.savedData(), beforeReset, "default Enter cancels reset");
// Re-enter Party after a full campaign; its three qualifying scores start empty.
game.choose("menu");
evidence.modeSwitches++;
assert.equal(game.state(), "title");
game.click('button[data-mode="party"]');
assert.equal(game.state(), "instructions");
for (const expected of [
  "qualifying-intro",
  "ready",
  "ready",
  "active-attempt",
]) {
  game.click('[data-action="confirm"]');
  assert.equal(game.state(), expected);
}
assert.equal(game.$("#hud-name").textContent, "JAKE ECKLER");
assert.equal(game.$("#campaign-coach").hidden, true);
assert.deepEqual(
  game.savedData(),
  beforeReset,
  "Party never writes campaign progress",
);
const saved = game.savedData();
game.close();
game = await boot(saved);
evidence.reloads++;
startVault();
select(CHARACTERS[2]);
game.choose("reset");
game.choose("reset-confirm");
assert.equal(game.state(), "campaign-map");
const resetData = game.savedData();
for (const levels of Object.values(JSON.parse(resetData[SAVE]).progress))
  for (const entry of Object.values(levels)) assert.equal(entry.medal, 0);
assert.equal(resetData["santor-vault:muted"], "true");
assert.equal(resetData["unrelated-project"], "preserved");
game.close();
game = await boot(resetData);
evidence.reloads++;
startVault();
select(CHARACTERS[0]);
assert.equal(
  game.$(`[data-campaign="level"][data-value="${LEVELS[1].id}"]`).disabled,
  true,
);
game.close();
for (const bad of ["{not-json", '{"version":500}', "null"]) {
  game = await boot({ [SAVE]: bad });
  startVault();
  select(CHARACTERS[0]);
  assert.equal(
    game.$(`[data-campaign="level"][data-value="${LEVELS[1].id}"]`).disabled,
    true,
  );
  game.close();
}
game = await boot({}, true);
startVault();
select(CHARACTERS[0]);
assert.match(game.$(".campaign-save").textContent, /page only/);
assert.equal(play(LEVELS[0]), 3);
game.choose("confirm");
assert.equal(
  game.$(`[data-campaign="level"][data-value="${LEVELS[1].id}"]`).disabled,
  false,
);
game.choose("menu");
startVault();
select(CHARACTERS[0]);
assert.equal(
  game.$(`[data-level="${LEVELS[0].id}"] .campaign-medal`).textContent,
  "Gold",
  "in-memory progress survives mode switches",
);
game.close();
console.log(
  JSON.stringify(
    { status: "PASS", mobileSimulated: mobile, ...evidence },
    null,
    2,
  ),
);
