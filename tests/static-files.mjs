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
    "sync.css",
    "js/sync-config.js",
    "js/sync.js",
    "js/sync-save.js",
    "js/sync-ui.js",
    "assets/portraits/jake.webp",
    "assets/portraits/brandon.webp",
    "assets/portraits/owen.webp",
    "js/music-config.js",
    "js/music.js",
    "js/audio-preferences.js",
    "assets/audio/music/menu.mp3",
    "assets/audio/music/gameplay1.mp3",
    "assets/audio/music/gameplay2.mp3",
    "assets/audio/music/championship.mp3",
    "index.html",
    "styles.css",
    "flash.css",
    "skills.css",
    "tricks.css",
    "campaign.css",
    "achievements.css",
    "js/achievement-config.js",
    "js/achievements.js",
    "js/achievement-events.js",
    "js/achievement-ui.js",
    "js/achievement-dev.js",
    "js/campaign-levels.js",
    "js/campaign-chapter.js",
    "js/campaign-save.js",
    "js/campaign.js",
    "js/run-config.js",
    "js/run-random.js",
    "js/run-effects.js",
    "js/run-save.js",
    "js/run-dev.js",
    "js/run-ui.js",
    "js/run-renderer.js",
    "js/objectives.js",

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
  ];
  for (const prefix of ["/", "/ragdoll-olympics/", "/Ragdoll-SV/"]) {
    for (const path of paths) {
      const response = await fetch(origin + prefix + path);
      assert.equal(response.status, 200, prefix + path);
      const text = await response.text();
      assert.ok(text.length > 0);
      if (path.endsWith(".js"))
        assert.match(response.headers.get("content-type"), /javascript/);
      if (path.endsWith(".webp"))
        assert.equal(response.headers.get("content-type"), "image/webp");
      if (path.endsWith(".mp3"))
        assert.equal(response.headers.get("content-type"), "audio/mpeg");
    }
    const page = await fetch(origin + prefix);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /The Santor Vault/);
  }
  assert.equal(
    (await fetch(origin + "/ragdoll-olympics/assets/portraits/missing.webp"))
      .status,
    404,
  );
  assert.equal(
    (await fetch(origin + "/ragdoll-olympics/assets/audio/music/missing.mp3"))
      .status,
    404,
  );
  console.log(
    `PASS Local static server: ${(paths.length + 1) * 3} root/project-prefix requests, JavaScript MIME types, and missing-asset 404.`,
  );
} finally {
  clearTimeout(timer);
  child.kill();
}
