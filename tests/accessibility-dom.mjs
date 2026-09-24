// Optional JSDOM event tests, using the same keyboard/touch wiring as Game.
// This verifies event semantics, not browser layout or assistive-technology output.
import assert from "node:assert/strict";
import { JSDOM } from "../.qa/node_modules/jsdom/lib/api.js";
import { Input } from "../js/input.js";
import { TouchControls } from "../js/touch.js";
import { AudioPreferences, AudioControls } from "../js/audio-preferences.js";
const dom = new JSDOM(
  '<div id="bar"><button data-control="push">Push</button><button data-control="brace">Brace</button><button data-control="left">Left</button><button data-control="right">Right</button></div><button id="next">Next drill</button>',
);
const w = dom.window;
globalThis.window = w;
globalThis.document = w.document;
let active = true,
  confirms = 0,
  clicks = 0;
const touch = new TouchControls(
  document.querySelector("#bar"),
  () => active,
  w,
);
const input = new Input({
  isActive: () => active,
  onConfirm: () => confirms++,
  onRestart: () => {},
  onSuspend: () => {},
  onControlButton: (button, down, code) =>
    down ? touch.press(button, `key:${code}`) : touch.release(`key:${code}`),
});
function key(target, code, type = "keydown", repeat = false) {
  const e = new w.KeyboardEvent(type, {
    code,
    repeat,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(e);
  return e;
}
const consume = () => touch.merge(input.consume());
for (const action of ["push", "brace", "left", "right"]) {
  const button = document.querySelector(`[data-control="${action}"]`);
  for (const code of ["Enter", "Space"]) {
    button.focus();
    assert.equal(key(button, code).defaultPrevented, true);
    assert.deepEqual(consume(), {
      pushes: Number(action === "push"),
      brace: action === "brace",
      rotate: action === "left" ? -1 : action === "right" ? 1 : 0,
    });
    assert.equal(button.getAttribute("aria-pressed"), "true");
    key(button, code, "keydown", true);
    key(button, code);
    assert.equal(
      consume().pushes,
      0,
      "held/repeated keys never enqueue another push",
    );
    key(button, code, "keyup");
    assert.deepEqual(consume(), { pushes: 0, brace: false, rotate: 0 });
    assert.equal(button.getAttribute("aria-pressed"), "false");
  }
}
assert.equal(confirms, 0, "control-button Enter never confirms a menu");
const left = document.querySelector('[data-control="left"]');
key(left, "Enter");
input.clear();
touch.clear();
active = false;
key(w, "Enter", "keydown", true);
key(w, "Enter");
assert.equal(confirms, 0, "held control key cannot confirm a new screen");
key(w, "Enter", "keyup");
key(w, "Enter");
key(w, "Enter", "keyup");
assert.equal(confirms, 1);
active = true;
const next = document.querySelector("#next");
next.addEventListener("click", () => {
  clicks++;
  input.clear();
  touch.clear();
});
key(next, "Space");
key(next, "Space", "keydown", true);
key(next, "Space");
assert.equal(clicks, 1);
assert.deepEqual(consume(), { pushes: 0, brace: false, rotate: 0 });
key(next, "Space", "keyup");
key(w, "Space");
assert.equal(consume().pushes, 1);
key(w, "Space", "keyup");
key(left, "Enter");
w.dispatchEvent(new w.Event("blur"));
touch.clear();
assert.equal(left.getAttribute("aria-pressed"), "false");
// Native volume sliders own their keydowns, but keyup still releases a gameplay
// key that was held before focus moved into the audio controls.
const panel = document.createElement("div");
panel.innerHTML =
  '<label>Music<input data-audio-volume="music" type="range" min="0" max="100"><output data-volume-value="music"></output></label>';
document.body.append(panel);
const prefs = new AudioPreferences({}),
  volumeControls = new AudioControls(panel, prefs);
const slider = panel.querySelector("input");
key(w, "ArrowRight");
key(slider, "ArrowRight", "keyup");
assert.equal(input.controls.rotate, 0);
key(slider, "ArrowRight");
assert.equal(input.controls.rotate, 0);
slider.value = "23";
slider.dispatchEvent(new w.Event("input", { bubbles: true }));
assert.equal(prefs.music, 0.23);
assert.equal(panel.querySelector("output").textContent, "23%");
volumeControls.destroy();
input.destroy();
touch.destroy();
key(w, "Enter");
assert.equal(confirms, 1, "destroy removes the keyboard owner");
dom.window.close();
delete globalThis.window;
delete globalThis.document;
console.log(
  "PASS Focused push/brace/rotation buttons: Enter and Space, repeat blocking, release, hand-off, tutorial Space, focus loss and listener disposal.",
);
