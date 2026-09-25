import assert from "node:assert/strict";
import { Records, RECORDS_SAVE_KEY, recordFlagsMarkup } from "../js/records.js";

const memory = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
};
const score = (total, metres, extra = {}) => ({
  total,
  distanceMetres: metres,
  crashed: false,
  landingQuality: "Clean",
  tricks: { completedRotations: 0 },
  ...extra,
});
let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`PASS ${name}`);
};

test("First records are stored without 'new record' flags; beaten records flag", () => {
  const db = memory(),
    r = new Records(db);
  const first = r.submit({
    mode: "vault",
    characterId: "jake",
    levelId: "orientation-day",
    score: score(800, 43.2),
    launched: true,
    landed: true,
  });
  assert.equal(first.longestJump, false);
  assert.equal(first.levelBest, false);
  assert.equal(r.data.longestJump.metres, 43.2);
  const second = r.submit({
    mode: "party",
    characterId: "owen",
    levelId: null,
    score: score(900, 45, { tricks: { completedRotations: 1 } }),
    launched: true,
    landed: true,
  });
  assert.equal(second.longestJump, true);
  assert.equal(second.bestScore, true);
  assert.equal(r.data.longestJump.characterId, "owen");
  assert.equal(r.data.longestJump.mode, "party");
  const third = r.submit({
    mode: "vault",
    characterId: "jake",
    levelId: "orientation-day",
    score: score(950, 40),
    launched: true,
    landed: true,
  });
  assert.equal(third.levelBest, true);
  assert.equal(third.previousLevelBest, 800);
  assert.match(recordFlagsMarkup(third), /LEVEL PERSONAL BEST/);
  assert.equal(r.career("jake").jumps, 2);
  const reloaded = new Records(db);
  assert.equal(reloaded.levelBest("jake", "orientation-day").points, 950);
  assert.equal(reloaded.data.bestScore.points, 950);
});

test("Idle, invalid and unknown-character attempts never count", () => {
  const r = new Records(memory());
  assert.equal(
    r.submit({
      mode: "vault",
      characterId: "jake",
      score: score(0, 0),
      launched: false,
    }),
    null,
  );
  assert.equal(
    r.submit({
      mode: "vault",
      characterId: "jake",
      score: score(500, 30),
      launched: true,
      valid: false,
    }),
    null,
  );
  assert.equal(
    r.submit({
      mode: "vault",
      characterId: "nobody",
      score: score(500, 30),
      launched: true,
    }),
    null,
  );
  assert.equal(r.data.longestJump, null);
  assert.equal(r.career("jake").jumps, 0);
});

test("Combined multi-heat totals are stored as the level best", () => {
  const r = new Records(memory());
  r.submit({
    mode: "vault",
    characterId: "brandon",
    score: score(1000, 50),
    launched: true,
    landed: true,
  });
  assert.equal(r.submitLevelTotal("brandon", "closing-time", 3100), true);
  assert.equal(r.submitLevelTotal("brandon", "closing-time", 3000), false);
  assert.equal(r.levelBest("brandon", "closing-time").points, 3100);
});

test("Corrupt, future and denied storage are safe", () => {
  const corrupt = memory({ [RECORDS_SAVE_KEY]: "{not json" });
  assert.equal(new Records(corrupt).data.longestJump, null);
  const future = memory({ [RECORDS_SAVE_KEY]: '{"version":9,"keep":true}' });
  const r = new Records(future);
  r.submit({
    mode: "vault",
    characterId: "jake",
    score: score(700, 40),
    launched: true,
    landed: true,
  });
  assert.equal(future.getItem(RECORDS_SAVE_KEY), '{"version":9,"keep":true}');
  const denied = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  const d = new Records(denied);
  assert.ok(
    d.submit({
      mode: "vault",
      characterId: "owen",
      score: score(700, 40),
      launched: true,
      landed: true,
    }),
  );
  const tampered = memory({
    [RECORDS_SAVE_KEY]: JSON.stringify({
      version: 1,
      longestJump: { metres: 1e9, characterId: "evil", mode: "x" },
      levels: {
        jake: {
          "orientation-day": { points: -5 },
          "fake-level": { points: 5 },
        },
      },
    }),
  });
  const t = new Records(tampered);
  assert.equal(t.data.longestJump.metres, 1000);
  assert.equal(t.data.longestJump.characterId, null);
  assert.equal(t.levelBest("jake", "orientation-day").points, 0);
  assert.equal(t.levelBest("jake", "fake-level"), null);
});

console.log(`${passed} record groups passed.`);
