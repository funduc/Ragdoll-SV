import assert from "node:assert/strict";
import { JSDOM } from "../.qa/node_modules/jsdom/lib/api.js";
import { Input } from "../js/input.js";
import { SyncSequence } from "../js/sync.js";
import { SyncUI } from "../js/sync-ui.js";
import { SYNC_KEYS } from "../js/sync-config.js";
const dom = new JSDOM(
  '<div id="sync-overlay"></div><div id="sync-controls"></div>',
);
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.matchMedia = () => ({ matches: true });
const seq = new SyncSequence("brandon");
let active = true,
  confirms = 0;
const ui = new SyncUI((lane) => seq.hit(lane));
ui.show(seq);
const input = new Input({
  isActive: () => true,
  onConfirm: () => confirms++,
  onRestart: () => {},
  onSuspend: () => {},
  onExclusiveKey: (e) => {
    if (!active) return false;
    if (Object.hasOwn(SYNC_KEYS, e.code)) seq.hit(SYNC_KEYS[e.code]);
    return true;
  },
});
const key = (code, type = "keydown", repeat = false) =>
  window.dispatchEvent(
    new window.KeyboardEvent(type, { code, repeat, cancelable: true }),
  );
const advance = (t) => {
  while (seq.time < t - 1e-9) seq.tick(Math.min(1 / 120, t - seq.time));
  ui.update(seq);
};
const initialTop = ui.overlay.querySelector('[data-note="0"]').style.top;
advance(0.5);
assert.equal(
  ui.overlay.querySelector('[data-note="0"]').style.top,
  initialTop,
  "reduced motion keeps notes in a fixed position",
);
assert.ok(ui.overlay.classList.contains("sync-reduced"));
for (const n of seq.notes) {
  advance(n.at);
  const code = ["KeyA", "KeyS", "KeyW", "KeyD"][n.lane];
  key(code);
  key(code, "keydown", true);
  key(code);
  key(code, "keyup");
  assert.equal(n.grade, "Perfect");
}
advance(seq.end + 0.1);
assert.equal(seq.result.grade, "PERFECT SYNC");
assert.equal(seq.extra, 0);
key("Enter");
key("Enter", "keydown", true);
assert.equal(confirms, 0);
key("Enter", "keyup");
key("ArrowUp");
input.clear();
active = false;
key("ArrowUp", "keydown", true);
assert.equal(input.consume().pushes, 0);
key("ArrowUp", "keyup");
key("ArrowUp");
assert.equal(input.consume().pushes, 1);
key("ArrowUp", "keyup");
input.destroy();
ui.destroy();
assert.equal(ui.bar.hidden, true);
assert.equal(ui.holds.size, 0);
key("Enter");
assert.equal(confirms, 0, "listeners removed at destruction");
dom.window.close();
console.log(
  "PASS A/S/W/D, held/repeated keys, Enter isolation, release gate, reduced-motion notes and input/UI disposal.",
);
