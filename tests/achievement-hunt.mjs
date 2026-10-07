import assert from "node:assert/strict";
import { ACHIEVEMENTS, ACHIEVEMENT_TIERS, COSMETIC_REWARDS, achievementById } from "../js/achievement-config.js";
import { AchievementManager, normalizeAchievements } from "../js/achievements.js";
import { achievementVaultMarkup, almostAchievements } from "../js/achievement-ui.js";
import { achievementIcon, rewardPreview, podiumRider, drawRewardHat, drawRewardTrail } from "../js/achievement-art.js";
import { AchievementToasts } from "../js/achievement-toast.js";
import { escape } from "../js/ui-content.js";

const fresh = () => new AchievementManager({ getItem: () => null, setItem() {} });
const attempt = (manager, facts = {}) => manager.send("attempt-ended", { characterId: "jake", valid: true, ...facts });
const record = (manager, id) => manager.data.records[id];
for (const item of ACHIEVEMENTS) {
  assert.ok(item.icon && Object.hasOwn(ACHIEVEMENT_TIERS, item.tier), item.id);
  assert.doesNotMatch(achievementIcon(item), /undefined|NaN/);
  if (item.hidden) assert.ok(item.hint);
}
// A pre-extension v2 save keeps old records, dates, selections and sequence.
const old = fresh().data;
for (const item of ACHIEVEMENTS.slice(0, 41)) old.records[item.id] = { progress: item.target, unlocked: true, unlockedAt: 1790000000000, values: item.values || [] };
for (const item of ACHIEVEMENTS.slice(41)) delete old.records[item.id];
old.equipped = { cart: "blue-cart", border: "ice-border" }; old.sequence = 120;
const loaded = normalizeAchievements(old);
for (const item of ACHIEVEMENTS.slice(0, 41)) assert.deepEqual(loaded.records[item.id], old.records[item.id]);
assert.equal(loaded.equipped.cart, "blue-cart"); assert.equal(loaded.equipped.border, "ice-border");
for (const slot of ["trail", "hat", "pose"]) assert.equal(loaded.equipped[slot], null);
assert.equal(loaded.sequence, 120);
assert.equal(loaded.records["sync-encore"].progress, 0);
console.log("PASS badge metadata and old v2 save compatibility");

const counters = [["sync-encore", "syncPerfect"], ["strike-collector", "bowlStrike"], ["frequent-flyer", "hjCleared"]];
for (const [id, field] of counters) {
  const m = fresh(); attempt(m, { [field]: true, valid: false }); attempt(m);
  assert.equal(record(m, id).progress, 0);
  attempt(m, { [field]: true }); attempt(m, { [field]: true });
  assert.equal(record(m, id).progress, 2); assert.equal(record(m, id).unlocked, false);
  m.receive({ id: m.data.sequence, type: "attempt-ended", characterId: "jake", valid: true, [field]: true });
  assert.equal(record(m, id).progress, 2, "duplicate attempt cannot advance progress");
  attempt(m, { [field]: true }); assert.equal(record(m, id).unlocked, true);
  assert.equal(m.equip(achievementById(id).reward), true);
}
const tour = fresh();
attempt(tour, { levelId: "freezer-aisle", levelCompleted: true });
assert.equal(record(tour, "tour-postcards").progress, 0);
for (const levelId of achievementById("tour-postcards").values) {
  attempt(tour, { levelId, tourStop: true, levelCompleted: true });
  attempt(tour, { levelId, tourStop: true, levelCompleted: true, characterId: "brandon" });
}
assert.equal(record(tour, "tour-postcards").progress, 8);
assert.equal(record(tour, "tour-postcards").unlocked, true);
const carnage = fresh();
attempt(carnage, { carnage: 5000 }); assert.equal(record(carnage, "parts-department").progress, 0);
for (const n of [900, 300, NaN, -10]) attempt(carnage, { carnage: n, crashed: true });
assert.equal(record(carnage, "parts-department").progress, 900);
attempt(carnage, { carnage: 1000, crashed: true });
assert.equal(record(carnage, "parts-department").unlocked, true);
const voices = fresh();
voices.send("voice-played", { characterId: "jake", speakerId: "unknown", heckle: true });
assert.equal(record(voices, "heckle-chorus").progress, 0);
for (const speakerId of ["jake", "jake", "owen", "brandon"]) voices.send("voice-played", { characterId: "jake", speakerId, heckle: true });
assert.equal(record(voices, "full-cast").unlocked, true);
assert.equal(record(voices, "heckle-chorus").progress, 2, "self voice is not a heckle");
voices.send("voice-played", { characterId: "owen", speakerId: "jake", heckle: true });
assert.equal(record(voices, "heckle-chorus").unlocked, true);
console.log("PASS new Sync, Bowling, High Jump, Tour, carnage and voice achievement rules");

const hunt = fresh();
attempt(hunt, { brace: "Perfect Brace" }); attempt(hunt, { brace: "Perfect Brace" });
const suggestions = almostAchievements(hunt, "jake");
assert.equal(suggestions[0].message, "1 more Perfect Brace for Cold-Blooded.");
assert.equal(almostAchievements(hunt, "brandon").length, 0);
hunt.send("campaign-progress", { characterId: "owen", completedLevels: 9, goldLevels: 8 });
assert.ok(!almostAchievements(hunt, "jake", { completedLevels: 0, goldLevels: 0 }).some(a => a.item.event === "campaign-progress"));
assert.equal(almostAchievements(hunt, "owen").length, 2);
hunt.send("voice-played", { characterId: "jake", speakerId: "owen", heckle: true });
assert.ok(!almostAchievements(hunt, "jake").some(a => a.item.hidden));
const html = achievementVaultMarkup(hunt);
assert.equal((html.match(/data-achievement-id=/g) || []).length, ACHIEVEMENTS.length);
assert.match(html, /aria-label="Cold-Blooded 2\/3"/);
assert.match(html, /available achievements/); assert.match(html, /character challenges/);
assert.match(html, /THE TROPHY GARAGE/);
for (const item of ACHIEVEMENTS.filter(a => a.hidden)) {
  assert.ok(!html.includes(item.name)); assert.ok(!html.includes(item.description));
  assert.ok(html.includes(escape(item.hint)));
}
for (const [id, reward] of Object.entries(COSMETIC_REWARDS)) {
  assert.match(rewardPreview(reward), /<svg/);
  assert.doesNotMatch(rewardPreview(reward), /undefined|NaN/);
  const m = fresh(); assert.equal(m.equip(id), false, "locked cosmetics cannot be equipped");
  const achievement = ACHIEVEMENTS.find(a => a.reward === id);
  m.data.records[achievement.id].unlocked = true;
  assert.equal(m.equip(id), true); assert.equal(m.cosmeticValues()[reward.slot], reward.value);
  const persisted = normalizeAchievements(JSON.parse(JSON.stringify(m.data)));
  assert.equal(persisted.equipped[reward.slot], id);
}
console.log("PASS Vault grid, hidden hints, progress, relevant hunts and cosmetic ownership");

// Real queue class with small DOM/event doubles: skip only observes gameplay input.
const env = new EventTarget(), played = [], stage = { append(node) { this.child = node; } };
const originalDocument = globalThis.document;
globalThis.document = { createElement: () => ({ dataset: {}, style: { setProperty() {} }, setAttribute() {}, remove() { this.removed = true; } }) };
const toast = new AchievementToasts(stage, { play: sound => played.push(sound) }, env);
toast.enqueue(["airborne", "butter", "airborne"]); toast.tick(16, false);
assert.equal(played.length, 0); toast.tick(16);
assert.equal(toast.current, "airborne"); assert.match(toast.host.innerHTML, /Technically Airborne/);
toast.tick(100, false); assert.equal(toast.seconds, 0);
toast.tick(5000); assert.equal(toast.current, "airborne", "long hidden-frame gaps do not burn the queue");
for (let i = 0; i < 18; i++) toast.tick(250);
assert.equal(toast.current, "butter"); assert.equal(played.length, 2);
let gameInput = 0;
env.addEventListener("keydown", () => gameInput++);
const key = new Event("keydown", { cancelable: true }); env.dispatchEvent(key);
assert.equal(key.defaultPrevented, false); assert.equal(gameInput, 1); assert.equal(toast.host.hidden, true);
toast.enqueue(["barrel"]); toast.tick(16, true, true);
assert.equal(toast.host.dataset.reducedMotion, "true");
env.dispatchEvent(new Event("pointerdown")); assert.equal(toast.current, null);
toast.destroy(); assert.equal(stage.child.removed, true);
toast.current = "sentinel"; env.dispatchEvent(new Event("keydown")); assert.equal(toast.current, "sentinel", "listeners disposed");
globalThis.document = originalDocument;
console.log("PASS queued unlock audio, expiry, pause, skip-through input, reduced motion and disposal");

const calls = [], ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]), set: (_, name, value) => (calls.push([name, value]), true) });
const world = Object.freeze({ launched: true, landed: false, crashed: false, elapsed: 3, cart: Object.freeze({ position: Object.freeze({ x: 800, y: 100 }) }) });
for (const hat of ["ice-cap", "pin-crown", "headphones"]) { calls.length = 0; drawRewardHat(ctx, hat); assert.ok(calls.length > 5); }
drawRewardTrail(ctx, world, "neon", false); assert.equal(calls.filter(c => c[0] === "lineTo").length >= 12, true);
calls.length = 0; drawRewardTrail(ctx, world, "neon", true); assert.equal(calls.length, 0);
assert.notEqual(podiumRider("#fff", { pose: "salute" }), podiumRider("#fff", { pose: "air-guitar" }));
console.log("PASS read-only hat/trail drawing, reduced motion and distinct podium poses");
