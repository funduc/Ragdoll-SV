import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { SYNC_CONFIG as C, syncResult, syncReward } from "../js/sync-config.js";
import { SyncSequence, applySyncLaunch } from "../js/sync.js";
import { SyncSave, SYNC_SAVE_KEY, syncRoll } from "../js/sync-save.js";
import { CHARACTERS } from "../js/characters.js";
import { LEVELS } from "../js/campaign-levels.js";
import { PhysicsWorld, STEP_MS } from "../js/physics.js";
import { scoreAttempt, assertScore } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";
import {
  AchievementManager,
  ACHIEVEMENT_SAVE_KEY,
} from "../js/achievements.js";
let groups = 0;
function check(name, fn) {
  fn();
  groups++;
  console.log("PASS", name);
}
function advance(s, time) {
  while (s.time < time - 1e-10) s.tick(Math.min(1 / 120, time - s.time));
}
function sequence(id, grades) {
  const s = new SyncSequence(id);
  s.notes.forEach((n, i) => {
    advance(s, n.at + (grades[i] === "G" ? s.perfectWindow + 0.02 : 0));
    if (grades[i] !== "M") s.hit(n.lane);
  });
  advance(s, s.end + C.resultSeconds + 0.02);
  return s;
}
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
};
check(
  "All characters achieve every grade; six notes, deterministic 3–5 second event",
  () => {
    for (const c of CHARACTERS)
      for (const [pattern, expected] of [
        ["MMMMMM", "MISS"],
        ["GGGGGG", "GOOD"],
        ["PPPPGG", "GREAT"],
        ["PPPPPP", "PERFECT SYNC"],
      ]) {
        const s = sequence(c.id, pattern);
        assert.equal(s.result.grade, expected);
        assert.ok(s.done);
        assert.equal(s.notes.length, 6);
        assert.ok(s.time >= 3 && s.time <= 5);
      }
  },
);
check(
  "Symmetric timing, wrong direction, off-beat spam, late misses, stalls and caps",
  () => {
    for (const offset of [-0.11, 0.11]) {
      const s = new SyncSequence("brandon");
      advance(s, 1 + offset);
      s.hit(0);
      assert.equal(s.notes[0].grade, "Good");
    }
    const s = new SyncSequence("jake");
    advance(s, 1);
    s.hit(3);
    assert.equal(s.notes[0].grade, "Miss");
    for (let i = 0; i < 100; i++) s.hit(0);
    advance(s, s.end + 1);
    assert.equal(s.result.grade, "MISS");
    assert.equal(s.result.perfect, 0);
    const time = s.time;
    s.tick(Infinity);
    s.tick(20);
    assert.equal(s.time, time);
    assert.equal(syncResult(NaN, Infinity).accuracy, 0);
    assert.equal(syncReward(syncResult(6), "brandon").style, 1.33);
    assert.equal(syncReward(syncResult(6), "jake").style, 1.18);
    assert.ok(Math.abs(syncReward(syncResult(6), "owen").speed - 1.15) < 1e-10);
  },
);
check(
  "Decisions and earned result survive refresh; level opportunity never repeats",
  () => {
    const st = storage(),
      run = { characterId: "jake", seed: 42 },
      id = LEVELS[0].id;
    const a = new SyncSave(st),
      d = a.begin(run, id, 0, true);
    assert.ok(d.triggered);
    const b = new SyncSave(st);
    assert.deepEqual(b.begin(run, id), d);
    assert.equal(b.data.occurrences, 1);
    b.result(id, syncResult(6));
    const c = new SyncSave(st);
    assert.equal(c.begin(run, id).result.grade, "PERFECT SYNC");
    c.finish(id);
    assert.equal(c.begin(run, id), null);
    assert.equal(c.begin(run, id, 1), null);
    c.resetRun();
    assert.ok(c.begin(run, id, 0, true));
  },
);
check(
  "11% seeded incidence, six-miss pity, corrupt/future/denied saves, ordinary pending reuse",
  () => {
    const incidence =
      Array.from(
        { length: 10000 },
        (_, seed) => syncRoll(seed, "orientation-day", 1) < C.chance,
      ).filter(Boolean).length / 10000;
    assert.ok(incidence > 0.085 && incidence < 0.135, String(incidence));
    const st = storage(),
      run = { characterId: "owen", seed: 6 },
      id = LEVELS[0].id;
    const a = new SyncSave(st);
    a.begin(run, id);
    const text = st.getItem(SYNC_SAVE_KEY);
    new SyncSave(st).begin(run, id);
    assert.equal(st.getItem(SYNC_SAVE_KEY), text);
    a.data.levels = {};
    a.data.pity = 6;
    assert.equal(a.begin(run, id).triggered, true);
    assert.equal(a.data.pity, 0);
    st.setItem(SYNC_SAVE_KEY, "{");
    assert.doesNotThrow(() => new SyncSave(st).begin(run, id));
    st.setItem(SYNC_SAVE_KEY, '{"version":99}');
    assert.equal(new SyncSave(st).begin(run, id), null);
    assert.equal(st.getItem(SYNC_SAVE_KEY), '{"version":99}');
    assert.equal(
      new SyncSave({
        getItem() {
          throw Error();
        },
        setItem() {
          throw Error();
        },
      }).begin(run, id),
      null,
    );
  },
);
check(
  "Pity follows six real eligible attempts, and rejected saves never count invisible events",
  () => {
    const id = LEVELS[0].id;
    const seed = Array.from({ length: 1000 }, (_, i) => i).find((n) =>
      Array.from({ length: 6 }, (_, i) => syncRoll(n, id, i + 1)).every(
        (n) => n >= C.chance,
      ),
    );
    const a = new SyncSave(storage()),
      run = { characterId: "jake", seed };
    for (let i = 0; i < 6; i++) {
      assert.equal(a.begin(run, id).triggered, false);
      assert.equal(a.data.pity, i + 1);
      a.finish(id);
    }
    assert.equal(a.begin(run, id).triggered, true);
    assert.equal(a.data.occurrences, 1);
    assert.equal(a.data.pity, 0);
    const b = new SyncSave({
      getItem() {
        return null;
      },
      setItem() {
        throw Error("denied");
      },
    });
    b.data.pity = 6;
    assert.equal(b.begin(run, id), null);
    assert.equal(b.data.occurrences, 0);
    assert.equal(b.data.pity, 6);
  },
);
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
function fly(character, result) {
  const world = new PhysicsWorld(character);
  if (result) world.syncResult = result;
  let launch,
    minY = Infinity;
  for (let i = 0; i < 3500 && !world.finished; i++) {
    const old = world.launched;
    const rotate =
      world.launched && !world.landed
        ? Math.max(
            -1,
            Math.min(
              1,
              -Math.atan2(
                Math.sin(world.cart.angle),
                Math.cos(world.cart.angle),
              ) *
                2 -
                world.cart.angularVelocity * 28,
            ),
          )
        : 0;
    world.step(timedInputs(world, rotate));
    if (!old && world.launched)
      launch = {
        ...world.M.Body.getVelocity(world.cart),
        yPos: world.cart.position.y,
      };
    if (world.launched && !world.landed)
      minY = Math.min(minY, world.cart.position.y);
  }
  assert.ok(world.finished && world.hasFiniteBodies());
  const score = scoreAttempt(world.metrics(), character);
  assertScore(score);
  assert.equal(
    score.stylePoints,
    Math.min(
      5000,
      Math.round(
        score.tricks.subtotal *
          score.tricks.characterMultiplier *
          score.tricks.landingMultiplier *
          (score.sync?.reward.style || 1),
      ),
    ),
  );
  const evidence = {
    launch,
    rise: launch.yPos - minY,
    air: world.landingTime - world.launchTime,
    total: score.total,
    quality: score.landingQuality,
  };
  const before = world.dynamic.map((b) => ({ ...b.velocity }));
  applySyncLaunch(world);
  assert.deepEqual(
    world.dynamic.map((b) => ({ ...b.velocity })),
    before,
    "no stacking",
  );
  world.dispose();
  assert.equal(world.M.Composite.allBodies(world.engine.world).length, 0);
  return evidence;
}
check(
  "Actual Matter launches gain capped speed and height, MISS is identical, score arithmetic and resets",
  () => {
    for (const c of CHARACTERS) {
      const base = fly(c, null),
        miss = fly(c, syncResult()),
        perfect = fly(c, syncResult(6));
      assert.deepEqual(miss, base);
      assert.ok(perfect.launch.x > base.launch.x);
      assert.ok(perfect.launch.y < base.launch.y);
      assert.ok(perfect.rise > base.rise * 1.12);
      assert.ok(perfect.air > base.air);
      console.log(c.id, JSON.stringify({ base, perfect }));
    }
  },
);
check(
  "Six hooks unlock only once through normal events and preserve old records",
  () => {
    const st = storage(),
      a = new AchievementManager(st);
    a.send("attempt-ended", {
      characterId: "jake",
      valid: true,
      launched: true,
    });
    const old = a.data.records.airborne.unlockedAt;
    a.send("attempt-ended", {
      characterId: "brandon",
      valid: true,
      syncCompleted: true,
      syncPerfect: true,
      syncBoosted: true,
      rotations: 3,
      successfulLanding: true,
    });
    a.send("attempt-ended", {
      characterId: "owen",
      valid: true,
      syncCompleted: true,
      syncAllMiss: true,
      levelCompleted: true,
    });
    a.send("campaign-progress", {
      characterId: "jake",
      runComplete: true,
      syncOccurrences: 2,
    });
    const b = new AchievementManager(st);
    assert.equal(b.data.records.airborne.unlockedAt, old);
    for (const id of [
      "sync-first",
      "sync-perfect",
      "sync-land",
      "sync-three",
      "sync-miss-medal",
      "sync-twice",
    ])
      assert.equal(b.data.records[id].unlocked, true, id);
    const date = b.data.records["sync-perfect"].unlockedAt;
    b.send("attempt-ended", {
      characterId: "brandon",
      valid: true,
      syncPerfect: true,
    });
    assert.equal(b.data.records["sync-perfect"].unlockedAt, date);
    const c = new SyncSave(st);
    c.resetRun();
    assert.ok(
      JSON.parse(st.getItem(ACHIEVEMENT_SAVE_KEY)).records["sync-perfect"]
        .unlocked,
    );
  },
);
console.log(`${groups} Santor Sync groups passed.`);
