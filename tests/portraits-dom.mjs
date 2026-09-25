// Optional DOM checks; npm's core tests remain dependency-free.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "../.qa/node_modules/jsdom/lib/api.js";
import { CHARACTERS } from "../js/characters.js";
import { portrait, unavailablePortraits } from "../js/ui-content.js";
import { UI } from "../js/ui.js";
const dom = new JSDOM(
  readFileSync(new URL("../index.html", import.meta.url), "utf8"),
  { url: "https://example.test/Ragdoll-SV/" },
);
globalThis.document = dom.window.document;
const ui = new UI(() => {});
for (const c of CHARACTERS) {
  ui.overlay.innerHTML = portrait(c);
  const frame = ui.overlay.querySelector(".portrait");
  const img = frame.querySelector("img");
  assert.equal(frame.getAttribute("aria-label"), `${c.name} portrait`);
  assert.equal(
    img.src,
    `https://example.test/Ragdoll-SV/assets/portraits/${c.id}.webp`,
  );
  assert.equal(img.draggable, false);
  assert.equal(img.style.objectPosition, c.portraitPosition);
  assert.equal(frame.querySelector("span").textContent, c.fallbackInitials);
  img.dispatchEvent(new dom.window.Event("error"));
  assert.equal(img.hidden, true, "failed image hides its broken-image icon");
  assert.ok(unavailablePortraits.has(c.portraitPath));
  ui.overlay.innerHTML = portrait(c);
  assert.equal(
    ui.overlay.querySelector("img"),
    null,
    "later screens do not retry failed URL",
  );
  assert.equal(
    ui.overlay.querySelector("span").textContent,
    c.fallbackInitials,
  );
}
ui.destroy();
unavailablePortraits.clear();
dom.window.close();
console.log(
  "PASS all three portrait mappings, subpath URLs, accessible labels, positioning, no dragging, error fallbacks and no repeated failed requests.",
);
