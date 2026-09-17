// Dependency-free regression checks for the stabilization pass.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { Input } from "../js/input.js";
import { Renderer } from "../js/renderer.js";
import { PhysicsWorld } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { scoreAttempt, rankQualifiers } from "../js/scoring.js";
import { Tournament } from "../js/tournament.js";
import { UI } from "../js/ui.js";

runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
globalThis.window = new EventTarget();
window.devicePixelRatio = 1;
globalThis.document = new EventTarget();
document.hidden = false;
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", detail: error.message });
  }
}
function key(code, repeat = false) {
  const event = new Event("keydown", { cancelable: true });
  Object.assign(event, { code, repeat });
  window.dispatchEvent(event);
}
function drive(world, controls, stop = () => world.finished) {
  for (let i = 0; i < 2500 && !stop(); i++) world.step(controls);
  assert.ok(stop(), "bounded simulation must finish");
}

check(
  "Held driving/rotation keys recover on repeat after a cleared frame gap",
  () => {
    let confirms = 0;
    const input = new Input({
      isActive: () => true,
      onConfirm: () => confirms++,
      onRestart: () => {},
      onSuspend: () => {},
    });
    try {
      for (const code of [
        "Space",
        "ArrowUp",
        "ArrowLeft",
        "ArrowRight",
        "KeyA",
        "KeyD",
      ]) {
        key(code);
        input.clear();
        key(code, true);
        assert.ok(
          input.keys.has(code),
          `${code} stayed inactive after its repeat event`,
        );
        input.clear();
      }
      key("Enter");
      key("Enter", true);
      assert.equal(confirms, 1);
    } finally {
      input.destroy();
    }
  },
);

check("Visibility changes cannot resume an unfocused or hidden game", () => {
  let suspended = false;
  const input = new Input({
    isActive: () => true,
    onConfirm: () => {},
    onRestart: () => {},
    onSuspend: (value) => {
      suspended = value;
    },
  });
  try {
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(suspended, true, "visible but unfocused game resumed");
    document.hidden = true;
    window.dispatchEvent(new Event("focus"));
    assert.equal(suspended, true, "focus event resumed a hidden game");
    document.hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(suspended, false);
  } finally {
    document.hidden = false;
    input.destroy();
  }
});

check(
  "First-contact rotation includes the completed 270-degree quarter turn",
  () => {
    // Preserve the known boundary fixture independently of character balancing.
    const p = new PhysicsWorld({
      ...CHARACTERS[0],
      passive: null,
      rotationControl: 0.95,
    });
    let air = 0;
    try {
      for (let i = 0; i < 2400 && !p.landed && !p.finished; i++)
        p.step({ accelerate: true, rotate: p.launched && air++ < 82 ? 1 : 0 });
      assert.ok(p.landed);
      assert.ok(Math.abs(p.landingAngle - p.launchAngle) >= Math.PI * 1.5);
      assert.ok(scoreAttempt(p.metrics(), CHARACTERS[0]).quarterTurns >= 3);
    } finally {
      p.dispose();
    }
  },
);

check("Numeric-fault scores remain finite and nonnegative", () => {
  const base = {
    distancePixels: 1200,
    airRotation: Math.PI * 2,
    landed: true,
    launched: true,
    attached: true,
    crashed: false,
    landingAngle: 0,
    landingSpeed: 5,
    reason: "fault probe",
  };
  for (const field of [
    "distancePixels",
    "airRotation",
    "landingAngle",
    "landingSpeed",
  ]) {
    for (const value of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
      const score = scoreAttempt({ ...base, [field]: value }, CHARACTERS[0]);
      for (const [key, value] of Object.entries(score))
        if (typeof value === "number")
          assert.ok(
            Number.isFinite(value) && value >= 0,
            `${field} corrupted ${key}`,
          );
    }
  }
});

check("Non-finite physics stops before poisoning distance and rotation", () => {
  const p = new PhysicsWorld(CHARACTERS[0]);
  try {
    drive(p, { accelerate: true, rotate: 0 }, () => p.launched);
    p.cart.position.x = NaN;
    p.step({ accelerate: true, rotate: 0 });
    assert.ok(p.finished);
    assert.equal(p.invalid, true);
    assert.ok(Number.isFinite(scoreAttempt(p.metrics(), CHARACTERS[0]).total));
  } finally {
    p.dispose();
  }
});

check(
  "Invalid score records are rejected before tournament state changes",
  () => {
    const t = new Tournament();
    for (let i = 0; i < 4; i++) t.confirm();
    const state = t.state;
    assert.throws(() => t.record({ total: NaN, distanceMetres: NaN }));
    assert.equal(t.state, state);
    assert.equal(Object.keys(t.qualifying).length, 0);
  },
);

check(
  "Qualifying table follows the same distance tie-break as selection",
  () => {
    const scores = {
      jake: { total: 100, distanceMetres: 1 },
      brandon: { total: 100, distanceMetres: 2 },
      owen: { total: 200, distanceMetres: 3 },
    };
    const expected = rankQualifiers(CHARACTERS, scores).map((c) => c.name);
    const table = UI.prototype.table(CHARACTERS, scores, "jake");
    const actual = [...table.matchAll(/<tr class="[^"]*"><td>([^<]+)/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(actual, expected);
  },
);

check(
  "Shrinking Canvas keeps the cart visible on the first resized frame",
  () => {
    let box = { width: 1246, height: 560 };
    const ctx = new Proxy(
      { createLinearGradient: () => ({ addColorStop() {} }) },
      {
        get: (object, key) => object[key] ?? (() => {}),
        set: (object, key, value) => {
          object[key] = value;
          return true;
        },
      },
    );
    const canvas = { getContext: () => ctx, getBoundingClientRect: () => box };
    const renderer = new Renderer(canvas),
      p = new PhysicsWorld(CHARACTERS[0]);
    try {
      drive(p, { accelerate: true, rotate: 0 }, () => p.cart.position.x > 1650);
      renderer.draw(p);
      const position = { ...p.cart.position };
      box = { width: 360, height: 560 };
      renderer.resize();
      renderer.draw(p, 1 / 60);
      const screenLeft =
        (Math.min(...p.dynamic.map((body) => body.bounds.min.x)) -
          renderer.camera.x) *
        renderer.camera.scale;
      const screenRight =
        (Math.max(...p.dynamic.map((body) => body.bounds.max.x)) -
          renderer.camera.x) *
        renderer.camera.scale;
      assert.ok(
        screenLeft >= 0 && screenRight <= box.width,
        `vehicle projected to x=${screenLeft}…${screenRight} in a ${box.width}px Canvas`,
      );
      assert.deepEqual(p.cart.position, position);
    } finally {
      p.dispose();
      renderer.destroy();
    }
  },
);

console.log(JSON.stringify(results, null, 2));
if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
