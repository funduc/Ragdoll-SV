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
import { LEVELS, HARD_GAUNTLET } from "../js/campaign-levels.js";
import { CAMPAIGN_SAVE_KEY as SAVE } from "../js/campaign-save.js";
import { RUN_SAVE_KEY, ACHIEVEMENT_SAVE_KEY } from "../js/run-save.js";
import {
  UPGRADES,
  UPGRADE_IDS,
  CONDITION_IDS,
  OBJECTIVE_IDS,
} from "../js/run-config.js";
import { timedInputs } from "./skill-helpers.mjs";
import { chapterControls } from "./chapter-helpers.mjs";
import { musicDouble } from "./fake-music.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const { createCanvas } = createRequire(resolve(root, ".qa/package.json"))(
  "@napi-rs/canvas",
);
const mobile = Boolean(process.env.MOBILE);
const viewport = {
  width: Number(process.env.VIEWPORT_WIDTH) || (mobile ? 360 : 1366),
  height: Number(process.env.VIEWPORT_HEIGHT) || (mobile ? 740 : 768),
};
const evidence = {
  viewportSimulated: viewport,
  profiles: [],
  attempts: [],
  reloads: 0,
  modeSwitches: 0,
  consoleErrors: [],
  consoleWarnings: [],
  achievementNotices: [],
  storageWrites: {},
};

async function boot(saved = {}, denied = false, search = "") {
  const dom = new JSDOM(readFileSync(resolve(root, "index.html"), "utf8"), {
    url: "http://localhost/ragdoll-olympics/" + search,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    document = w.document,
    context = dom.getInternalVMContext();
  w.Audio = musicDouble(w.EventTarget, w.Event);
  for (const [key, value] of Object.entries(saved))
    w.localStorage.setItem(key, value);
  let writes = 0;
  const setItem = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function (key, value) {
    writes++;
    evidence.storageWrites[key] = (evidence.storageWrites[key] || 0) + 1;
    return setItem.call(this, key, value);
  };
  Object.defineProperty(w, "innerWidth", { value: viewport.width });
  Object.defineProperty(w, "innerHeight", { value: viewport.height });
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
    "achievements.css",
    "sync.css",
  ]) {
    const sheet = document.createElement("style");
    sheet.textContent = readFileSync(resolve(root, filename), "utf8");
    document.head.appendChild(sheet);
    assert.ok(sheet.sheet.cssRules.length);
  }
  let sequence = null;
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
  // Fixed crypto seed makes normal seeded choices repeatable in this test.
  Object.defineProperty(w.crypto, "getRandomValues", {
    value: (array) => {
      array.fill(42);
      return array;
    },
  });
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
  const SyncSequence = cache.get(resolve(root, "js/sync.js")).namespace
    .SyncSequence;
  const tickSync = SyncSequence.prototype.tick;
  SyncSequence.prototype.tick = function (...args) {
    sequence = this;
    return tickSync.apply(this, args);
  };
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
    const wasSync = Boolean($("#game").dataset.sync);
    const previousState = state(),
      previousWrites = writes;
    now += dt;
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const fn of pending) fn(now);
    assert.equal(callbacks.size, 1);
    assert.deepEqual(evidence.consoleErrors, []);
    assert.deepEqual(evidence.consoleWarnings, []);
    for (const img of document.querySelectorAll(".portrait img")) {
      assert.match(
        img.getAttribute("src"),
        /assets\/portraits\/(jake|brandon|owen)\.webp$/,
      );
      assert.equal(img.draggable, false);
    }
    if (
      !wasSync &&
      previousState === "active-attempt" &&
      state() === previousState
    )
      assert.equal(
        writes,
        previousWrites,
        "active physics frames never write saves",
      );
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
    level = null,
  } = {}) {
    assert.equal(state(), "active-attempt");
    // Existing regression scripts deliberately miss bonus notes, preserving their baseline jumps.
    for (let n = 0; $("#game").dataset.sync && n < 650; n++) frame(1000 / 120);
    frame();
    assert.equal(
      $(".achievement-notice"),
      null,
      "unlock notices never cover gameplay",
    );
    for (let count = 0; count < 2800 && state() === "active-attempt"; count++) {
      if (!idle) {
        const chapter = level && (level.bonus || LEVELS.indexOf(level) >= 3);
        const controls = chapter
          ? chapterControls(world, level)
          : timedInputs(world, 0, true, target);
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
        rotate(chapter ? controls.rotate : spin);
      }
      frame(
        level && (level.bonus || LEVELS.indexOf(level) >= 3)
          ? 1000 / 60
          : 1000 / 120,
      );
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
    if ($(".achievement-notice")) {
      assert.equal($(".achievement-notice").hasAttribute("tabindex"), false);
      assert.equal($(".achievement-notice").querySelector("button"), null);
      evidence.achievementNotices.push($(".achievement-notice").textContent);
    }
    const rank = Number(
      $("#campaign-award .campaign-medal").dataset.medal || 0,
    );
    evidence.attempts.push({
      character: world.character.id,
      level: level?.id,
      tricks: [...world.tricks.unique],
      cargoLost: world.cargoLost,
      rank,
      takeoff: $("#result-takeoff").textContent,
      brace: $("#result-brace").textContent,
      score: Number($("#attempt-total").textContent),
    });
    assert.equal($("#campaign-coach").hidden, true);
    assert.equal($("#run-status").hidden, true);
    assert.ok($("[data-objective-result]"));
    const style = Number($("[data-trick-total]").textContent);
    const equation = Math.round(
      Number($("[data-trick-subtotal]").textContent) *
        Number($("[data-trick-character]").textContent) *
        Number($("[data-trick-landing]").textContent) *
        Number($("[data-trick-sync]")?.textContent || 1),
    );
    assert.equal(style, Math.min(5000, equation));
    return rank;
  }
  frame();
  assert.equal(w.Audio.instances.length, 0, "refresh never autoplays music");
  click("[data-audio-enter]");
  assert.equal(w.Audio.instances.length, 1);
  return {
    get sequence() {
      return sequence;
    },
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

if (process.env.SYNC_TEST) {
  const { runSyncScenarios } = await import("./sync-flow-helper.mjs");
  await runSyncScenarios(boot, evidence);
} else {
  let game = await boot({
    "santor-vault:muted": "true",
    "unrelated-project": "preserved",
  });
  assert.equal(game.w.__vaultAchievements, undefined);
  game.click('[data-achievement="open"]');
  assert.equal(game.state(), "achievement-vault");
  assert.equal(game.document.querySelectorAll(".achievement-card").length, 34);
  assert.equal(
    game.document.querySelectorAll(".achievement-unavailable").length,
    6,
  );
  game.key("Enter");
  assert.equal(game.state(), "title");
  game.key("Enter", "keydown", true);
  assert.equal(
    game.state(),
    "title",
    "held Enter cannot leave the vault and enter a mode",
  );
  game.key("Enter", "keyup");
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
      assert.equal(
        card.querySelector(".censored-icon").textContent,
        "CENSORED",
      );
    for (let i = 0; i < (c.id === "jake" ? 310 : 160); i++) game.frame(100);
    assert.equal(game.$(".achievement-notice"), null);
    assert.equal(card.innerHTML, markup);
    game.key("Enter");
    assert.equal(game.state(), "campaign-map");
    for (let i = 0; i < 10; i++) game.key("Enter", "keydown", true);
    assert.equal(game.state(), "campaign-map");
    game.key("Enter", "keyup");
    evidence.profiles.push(c.id);
  }
  function returnToMap() {
    game.choose("confirm");
    if (game.state() === "campaign-upgrades") {
      const cards = [
        ...game.document.querySelectorAll('[data-campaign="upgrade"]'),
      ];
      assert.equal(cards.length, 3);
      assert.equal(new Set(cards.map((card) => card.dataset.value)).size, 3);
      cards[0].click();
      assert.equal(game.state(), "campaign-map");
      assert.ok(
        game
          .$(".run-inventory")
          .textContent.includes(UPGRADES[cards[0].dataset.value].name),
      );
    }
    assert.equal(game.state(), "campaign-map");
    assert.match(game.w.Audio.instances[0].src, /\/menu\.mp3$/);
  }
  function play(level, opts) {
    game.choose("level", level.id);
    assert.equal(game.state(), "ready");
    const current = game.world;
    assert.equal(current.engine.gravity.y, level.arena.gravity);
    game.key("Space"); // A held menu key must not turn into a campaign push.
    game.choose("confirm");
    assert.equal(game.state(), "active-attempt");
    assert.equal(game.w.Audio.instances[0].loop, true);
    assert.match(
      game.w.Audio.instances[0].src,
      level.stages ? /\/championship\.mp3$/ : /\/gameplay[12]\.mp3$/,
    );
    game.frame();
    game.key("Space", "keydown", true);
    game.frame();
    assert.equal(
      Object.values(current.skills.pushes).reduce((a, b) => a + b, 0),
      0,
    );
    game.key("Space", "keyup");
    for (let n = 0; game.$("#game").dataset.sync && n < 650; n++)
      game.frame(1000 / 120);
    game.frame();
    game.frame();
    assert.equal(game.$("#campaign-coach").hidden, false);
    assert.equal(game.$("#run-status").hidden, false);
    assert.ok(current.runEffects);
    assert.ok(
      game
        .$("#run-status")
        .textContent.includes(
          current.runEffects.condition?.name.toUpperCase() || "STANDARD",
        ),
    );
    assert.match(
      game.$("#campaign-coach").textContent,
      new RegExp(level.modifier.name),
    );
    let rank = game.finishAttempt({ ...opts, level });
    let heat = 1;
    while (
      game
        .$('[data-campaign="confirm"]')
        .textContent.startsWith("Continue to heat")
    ) {
      const oldWorld = game.world;
      game.key("Enter");
      assert.equal(game.state(), "ready");
      assert.notEqual(game.world, oldWorld);
      assert.equal(oldWorld.disposed, true);
      game.key("Enter", "keydown", true);
      game.frame();
      assert.equal(
        game.state(),
        "ready",
        "held Enter cannot begin the next heat",
      );
      game.key("Enter", "keyup");
      heat++;
      assert.match(
        game.$("#overlay").textContent,
        new RegExp(`HEAT ${heat} OF 3`),
      );
      game.choose("confirm");
      rank = game.finishAttempt({ ...opts, level });
    }
    if (level.stages) {
      assert.equal(heat, 3);
      const ledger = game.$('[aria-label="Combined Gauntlet score"]');
      const totals = evidence.attempts
        .slice(-3)
        .reduce((sum, a) => sum + a.score, 0);
      assert.equal(
        ledger.querySelector("h3").textContent,
        `COMBINED SCORE · ${totals}`,
      );
      assert.match(
        ledger.textContent,
        new RegExp(`= ${totals}. No hidden bonus`),
      );
    }
    return rank;
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
      returnToMap();
      assert.equal(
        game.$(`[data-campaign="level"][data-value="${LEVELS[1].id}"]`)
          .disabled,
        true,
      );
      assert.ok(play(LEVELS[0], { target: "Early" }) >= 1);
      assert.notEqual(game.$("#result-takeoff").textContent, "Perfect");
      game.choose("confirm");
      assert.equal(game.state(), "campaign-upgrades");
      const pending = game.savedData();
      const offers = [
        ...game.document.querySelectorAll('[data-campaign="upgrade"]'),
      ].map((b) => b.dataset.value);
      game.close();
      game = await boot(pending);
      evidence.reloads++;
      startVault();
      game.choose("select", "jake");
      game.choose("confirm");
      assert.equal(game.state(), "campaign-upgrades");
      assert.deepEqual(
        [...game.document.querySelectorAll('[data-campaign="upgrade"]')].map(
          (b) => b.dataset.value,
        ),
        offers,
      );
      const choice = game.$('[data-campaign="upgrade"]');
      game.key("Enter", "keydown", false, choice);
      assert.equal(game.state(), "campaign-map");
      game.key("Enter", "keydown", true, game.document.activeElement);
      assert.equal(
        game.state(),
        "campaign-map",
        "held Enter must not start the next level",
      );
      game.key("Enter", "keyup");
    }
    assert.equal(play(LEVELS[0]), 3);
    returnToMap();
    assert.equal(game.state(), "campaign-map");
    let snapshot = JSON.parse(game.savedData()[SAVE]);
    assert.equal(snapshot.progress[c.id][LEVELS[0].id].medal, 3);
    assert.equal(Object.keys(snapshot.progress[c.id]).length, 11);
    assert.ok(play(LEVELS[1]) >= 1);
    returnToMap();
    assert.ok(play(LEVELS[2], { flip: true }) >= 1);
    returnToMap();
    for (const level of LEVELS.slice(3)) {
      assert.ok(play(level) >= 1, `${c.id} ${level.id}`);
      returnToMap();
    }
    assert.equal(
      game.$('[data-campaign="level"][data-value="santor-gauntlet-hard"]')
        .disabled,
      false,
    );
    assert.match(game.$(".campaign-map-panel").textContent, /RUN COMPLETE/);
    if (c.id === "jake") {
      assert.ok(play(HARD_GAUNTLET) >= 1);
      assert.doesNotMatch(
        game.$("#campaign-award").textContent,
        /ORIENTATION DAY unlocked/,
      );
      returnToMap();
      assert.equal(play(LEVELS[0], { idle: true }), 0);
      assert.match(game.$("#campaign-award").textContent, /BEST KEPT: Gold/);
      returnToMap();
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
        game.$(`[data-campaign="level"][data-value="${LEVELS[2].id}"]`)
          .disabled,
        false,
      );
    }
    if (c.id !== "owen") game.choose("characters");
  }
  const achievementsEarned = JSON.parse(game.savedData()[ACHIEVEMENT_SAVE_KEY]);
  for (const id of [
    "manual",
    "airborne",
    "butter",
    "cold-blooded",
    "coordination",
    "graduate",
    "liabilities",
  ])
    assert.equal(achievementsEarned.records[id].unlocked, true, id);
  assert.equal(achievementsEarned.records["cold-blooded"].progress, 3);
  assert.equal(achievementsEarned.records.factory.unlocked, false);
  const beforeNewRun = game.savedData();
  assert.ok(
    Object.values(JSON.parse(beforeNewRun[RUN_SAVE_KEY]).upgrades).some(
      (count) => count > 0,
    ),
  );
  game.choose("new-run");
  assert.equal(game.state(), "campaign-new-run");
  assert.match(game.document.activeElement.textContent, /Cancel/);
  game.tap("Enter");
  assert.deepEqual(game.savedData(), beforeNewRun);
  game.choose("new-run");
  game.choose("new-run-confirm");
  assert.equal(game.state(), "campaign-map");
  const afterNewRun = game.savedData();
  assert.ok(
    Object.values(JSON.parse(afterNewRun[RUN_SAVE_KEY]).upgrades).every(
      (count) => count === 0,
    ),
  );
  assert.equal(afterNewRun[SAVE], beforeNewRun[SAVE]);
  assert.equal(
    afterNewRun[ACHIEVEMENT_SAVE_KEY],
    beforeNewRun[ACHIEVEMENT_SAVE_KEY],
  );
  const beforeReset = game.savedData();
  game.choose("reset");
  assert.equal(game.state(), "campaign-reset");
  assert.match(game.document.activeElement.textContent, /Cancel/);
  game.tap("Enter");
  assert.equal(game.state(), "campaign-map");
  assert.deepEqual(
    game.savedData(),
    beforeReset,
    "default Enter cancels reset",
  );
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
  assert.equal(game.$("#run-status").hidden, true);
  assert.equal(game.world.runEffects, null);
  assert.equal(game.world.skills.config.takeoff.perfectStart, 980);
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
  assert.equal(
    resetData[ACHIEVEMENT_SAVE_KEY],
    saved[ACHIEVEMENT_SAVE_KEY],
    "campaign reset preserves achievements",
  );
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
  for (const bad of ["{not-json", '{"version":500}', '{"version":0}', "null"]) {
    game = await boot({ [SAVE]: bad, [RUN_SAVE_KEY]: bad });
    startVault();
    select(CHARACTERS[0]);
    assert.equal(
      game.$(`[data-campaign="level"][data-value="${LEVELS[1].id}"]`).disabled,
      true,
    );
    if (bad === '{"version":500}') {
      assert.equal(game.savedData()[SAVE], bad);
      assert.equal(game.savedData()[RUN_SAVE_KEY], bad);
    }
    game.close();
  }
  game = await boot({}, true);
  startVault();
  select(CHARACTERS[0]);
  assert.match(game.$(".campaign-save").textContent, /page only/);
  assert.equal(play(LEVELS[0]), 3);
  returnToMap();
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
  // A real fresh run can decline rewards and unlock Factory Settings.
  game = await boot();
  startVault();
  select(CHARACTERS[0]);
  for (const level of LEVELS) {
    assert.ok(
      play(level, { flip: level.id === "commit-to-the-bit" }) >= 1,
      `Factory ${level.id}`,
    );
    game.choose("confirm");
    if (game.state() === "campaign-upgrades") game.choose("skip-upgrade");
    assert.equal(game.state(), "campaign-map");
  }
  assert.equal(
    JSON.parse(game.savedData()[ACHIEVEMENT_SAVE_KEY]).records.factory.unlocked,
    true,
  );
  const preserved = game.savedData();
  game.choose("menu");
  game.click('[data-achievement="open"]');
  assert.equal(
    game.$('[data-achievement-id="factory"]').dataset.unlocked,
    "true",
  );
  game.click('[data-achievement="equip"][data-value="blue-cart"]');
  assert.equal(
    JSON.parse(game.savedData()[ACHIEVEMENT_SAVE_KEY]).equipped.cart,
    "blue-cart",
  );
  game.click('[data-achievement="equip"][data-value="rookie-badge"]');
  assert.equal(game.$("#achievement-badge").hidden, false);
  const equipped = game.savedData();
  game.close();
  game = await boot(equipped);
  evidence.reloads++;
  assert.equal(game.$("#achievement-badge").textContent, "VAULT ROOKIE");
  game.click('[data-achievement="open"]');
  game.click('[data-achievement="reset"]');
  assert.equal(game.state(), "achievement-reset");
  assert.match(game.document.activeElement.textContent, /Cancel/);
  game.tap("Enter");
  assert.deepEqual(game.savedData(), equipped);
  game.click('[data-achievement="reset"]');
  game.click('[data-achievement="reset-confirm"]');
  assert.equal(game.state(), "achievement-vault");
  assert.equal(game.$("#achievement-badge").hidden, true);
  assert.equal(game.savedData()[SAVE], preserved[SAVE]);
  assert.equal(game.savedData()[RUN_SAVE_KEY], preserved[RUN_SAVE_KEY]);
  assert.equal(
    Object.values(
      JSON.parse(game.savedData()[ACHIEVEMENT_SAVE_KEY]).records,
    ).filter((r) => r.unlocked).length,
    0,
  );
  game.close();
  evidence.developerCases = [];
  const realStored = {
    [SAVE]: beforeNewRun[SAVE],
    [RUN_SAVE_KEY]: beforeNewRun[RUN_SAVE_KEY],
    [ACHIEVEMENT_SAVE_KEY]: beforeNewRun[ACHIEVEMENT_SAVE_KEY],
    "unrelated-project": "keep",
  };
  for (let i = 0; i < UPGRADE_IDS.length; i++) {
    const upgradeId = UPGRADE_IDS[i],
      condition = CONDITION_IDS[i] || "none",
      objective = OBJECTIVE_IDS[i];
    game = await boot(
      realStored,
      false,
      `?vaultdev=1&seed=73&condition=${condition}&upgrades=${upgradeId}:99&objective=${objective}`,
    );
    startVault();
    game.choose("select", "brandon");
    game.choose("confirm");
    assert.match(game.$(".run-dev").textContent, /SAVES DISABLED/);
    assert.ok(
      game.$(".run-inventory").textContent.includes(UPGRADES[upgradeId].name),
    );
    game.choose("level", LEVELS[2].id); // developer mode may test a locked lesson
    assert.equal(
      game.world.runEffects.upgrades[upgradeId],
      UPGRADES[upgradeId].limit,
    );
    assert.equal(
      game.world.runEffects.conditionId,
      condition === "none" ? null : condition,
    );
    assert.equal(game.world.runEffects.objectiveId, objective);
    assert.ok(game.$(".run-challenge").textContent.includes("OPTIONAL"));
    game.choose("confirm");
    game.finishAttempt({ flip: true });
    const outcome = game.$("[data-objective-result]").dataset.objectiveResult;
    assert.ok(["success", "failure"].includes(outcome));
    assert.deepEqual(
      game.savedData(),
      realStored,
      "developer runs must never modify real saves",
    );
    evidence.developerCases.push({
      upgrade: upgradeId,
      condition,
      objective,
      outcome,
    });
    game.close();
  }
  // Explicit developer hooks use in-memory data, including while Party is selected.
  game = await boot(realStored, false, "?achievementdev=1");
  assert.ok(game.w.__vaultAchievements);
  const hooks = game.w.__vaultAchievements;
  game.click('[data-achievement="open"]');
  hooks.receive({
    id: 1,
    type: "attempt-ended",
    characterId: "jake",
    valid: true,
    brace: "Perfect Brace",
  });
  hooks.receive({
    id: 1,
    type: "attempt-ended",
    characterId: "jake",
    valid: true,
    brace: "Perfect Brace",
  });
  assert.equal(hooks.snapshot().records["cold-blooded"].progress, 1);
  assert.match(game.$(".run-dev").textContent, /NOT SAVED/);
  assert.deepEqual(game.savedData(), realStored);
  game.close();
  console.log(
    JSON.stringify(
      { status: "PASS", mobileSimulated: mobile, ...evidence },
      null,
      2,
    ),
  );
}
