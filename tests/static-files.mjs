import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const child = spawn(process.execPath, ["tests/serve.mjs", "--port", "8081"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
});
const timer = setTimeout(() => child.kill(), 15000);
try {
  await once(child.stdout, "data");
  const origin = "http://127.0.0.1:8081";
  const paths = [
    "index.html",
    "styles.css",
    "flash.css",
    "skills.css",
    "tricks.css",
    "campaign.css",
    "js/campaign-levels.js",
    "js/campaign-save.js",
    "js/campaign.js",
    "js/campaign-ui.js",
    "js/ui-content.js",
    "js/trick-config.js",
    "js/tricks.js",
    "js/trick-ui.js",
    "js/game.js",
    "js/input.js",
    "js/ui.js",
    "js/renderer.js",
    "js/physics.js",
    "js/tournament.js",
    "js/scoring.js",
    "js/characters.js",
    "js/passives.js",
    "js/commentary.js",
    "js/introductions.js",
    "js/audio.js",
    "js/effects.js",
    "js/presentation.js",
    "js/stadium.js",
    "js/touch.js",
    "js/skill-config.js",
    "js/skills.js",
    "js/skill-ui.js",
    "js/tutorial.js",
    "vendor/matter-0.20.0.min.js",
    "assets/portraits/jake.svg",
    "assets/portraits/brandon.svg",
    "assets/portraits/owen.svg",
  ];
  for (const prefix of ["/", "/ragdoll-olympics/"]) {
    for (const path of paths) {
      const response = await fetch(origin + prefix + path);
      assert.equal(response.status, 200, prefix + path);
      const text = await response.text();
      assert.ok(text.length > 0);
      if (path.endsWith(".js"))
        assert.match(response.headers.get("content-type"), /javascript/);
    }
    const page = await fetch(origin + prefix);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /The Santor Vault/);
  }
  assert.equal(
    (await fetch(origin + "/ragdoll-olympics/assets/portraits/missing.svg"))
      .status,
    404,
  );
  console.log(
    `PASS Local static server: ${(paths.length + 1) * 2} root/project-prefix requests, JavaScript MIME types, and missing-asset 404.`,
  );
} finally {
  clearTimeout(timer);
  child.kill();
}
