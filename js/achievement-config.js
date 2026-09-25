// Add achievements by declaring an event, predicates and an aggregation rule.
// Unsupported mechanics remain honest, visible locked entries, never inferred.
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const ACHIEVEMENT_RULES = freeze({
  biographySeconds: 30,
  targetToleranceMetres: 0.5,
  mainLevelCount: 10,
  characterCount: 3,
  notificationNames: 3,
  crashClasses: ["overturned", "head-impact", "torso-impact"],
});
export const ACHIEVEMENT_CAPABILITIES = freeze({
  "component-loss": false,
  "wheel-loss": false,
  // After Hours: Karma Chameleon wind, Gauntlet ledger near-misses and the
  // collidable Concrete+ slab now provide real telemetry for these three.
  "changing-conditions": true,
  "objective-points": false,
  "point-medals": true,
  "sponsor-target": true,
});
export const COSMETIC_REWARDS = freeze({
  "rookie-badge": {
    name: "Vault Rookie",
    slot: "badge",
    value: "VAULT ROOKIE",
  },
  "blue-cart": { name: "Electric Blue cart", slot: "cart", value: "#52cefa" },
  "amber-arena": {
    name: "Amber arena lights",
    slot: "arena",
    value: "#ffb84b",
  },
  "green-border": {
    name: "Toxic Green card border",
    slot: "border",
    value: "#b4ef4b",
  },
  "appeal-line": {
    name: "Santor: Appeal denied",
    slot: "commentary",
    value: "Physics has reviewed the appeal and denied it.",
  },
  "ice-border": {
    name: "Cold-Blooded card border",
    slot: "border",
    value: "#a5e8ef",
  },
  "poetic-line": {
    name: "Santor: Literary victory",
    slot: "commentary",
    value: "The judges have accepted the extended metaphor.",
  },
  "orange-cart": {
    name: "Workshop Orange cart",
    slot: "cart",
    value: "#ff852b",
  },
  "graduate-badge": {
    name: "Vault Graduate",
    slot: "badge",
    value: "VAULT GRADUATE",
  },
  "gold-arena": { name: "Gold arena lights", slot: "arena", value: "#ffe17d" },
});
export const COSMETIC_SLOTS = freeze([
  "cart",
  "border",
  "commentary",
  "badge",
  "arena",
]);
const attempt = (id, name, category, description, rules, extra = {}) => ({
  id,
  name,
  category,
  description,
  event: "attempt-ended",
  rules: [["valid", "eq", true], ...rules],
  aggregation: "once",
  target: 1,
  ...extra,
});
const campaign = (id, name, description, extra) => ({
  id,
  name,
  category: "Campaign",
  description,
  event: "campaign-progress",
  rules: [],
  aggregation: "max",
  ...extra,
});
export const ACHIEVEMENTS = freeze([
  attempt(
    "sync-first",
    "In Sync",
    "Santor Sync",
    "Complete your first Santor Sync and finish the attempt.",
    [["syncCompleted", "eq", true]],
  ),
  attempt(
    "sync-perfect",
    "Physics Lost Jurisdiction",
    "Santor Sync",
    "Earn Perfect Sync and finish the attempt.",
    [["syncPerfect", "eq", true]],
  ),
  attempt(
    "sync-land",
    "Beat the Landing",
    "Santor Sync",
    "Earn Perfect Sync and land successfully.",
    [
      ["syncPerfect", "eq", true],
      ["successfulLanding", "eq", true],
    ],
  ),
  attempt(
    "sync-three",
    "Triple Time",
    "Santor Sync",
    "Complete three rotations after a Sync boost.",
    [
      ["syncBoosted", "eq", true],
      ["rotations", "gte", 3],
    ],
  ),
  attempt(
    "sync-miss-medal",
    "Legally Valid",
    "Santor Sync",
    "Miss every Sync note but still earn a medal.",
    [
      ["syncAllMiss", "eq", true],
      ["levelCompleted", "eq", true],
    ],
  ),
  campaign(
    "sync-twice",
    "Encore in the Vault",
    "Trigger Sync twice during one completed run.",
    {
      category: "Santor Sync",
      rules: [["runComplete", "eq", true]],
      field: "syncOccurrences",
      target: 2,
    },
  ),
  campaign(
    "welcome",
    "Welcome to the Vault",
    "Complete Orientation Day with any competitor.",
    {
      field: "firstLevel",
      target: 1,
      reward: "rookie-badge",
      category: "General",
    },
  ),
  attempt(
    "airborne",
    "Technically Airborne",
    "General",
    "Leave the ramp and become airborne.",
    [["launched", "eq", true]],
    { reward: "blue-cart" },
  ),
  attempt(
    "butter",
    "Butter Side Up",
    "General",
    "Earn Perfect takeoff and Perfect Brace in the same attempt.",
    [
      ["takeoff", "eq", "Perfect"],
      ["brace", "eq", "Perfect Brace"],
    ],
    { reward: "amber-arena" },
  ),
  attempt(
    "barrel",
    "Do a Barrel Roll",
    "General",
    "Complete a full rotation and land. Crash landings count.",
    [
      ["rotations", "gte", 1],
      ["landed", "eq", true],
    ],
    { reward: "green-border" },
  ),
  attempt(
    "not-phase",
    "Not a Phase",
    "General",
    "Perform three different recognized tricks in one attempt.",
    [["uniqueTricks", "gte", 3]],
    { reward: "appeal-line" },
  ),
  attempt(
    "style-over",
    "Style Over Substance",
    "General",
    "Earn more style points than distance points.",
    [["stylePoints", "gtField", "distancePoints"]],
  ),
  attempt(
    "dead-centre",
    "Dead Centre",
    "General",
    "First ground contact is within 0.5 m of a marked target's centre.",
    [
      ["landed", "eq", true],
      ["targetError", "lte", ACHIEVEMENT_RULES.targetToleranceMetres],
    ],
  ),
  attempt(
    "full-package",
    "The Full Package",
    "General",
    "Earn distance, style, landing, attachment, and objective points in one attempt.",
    [
      "distancePoints",
      "stylePoints",
      "landingPoints",
      "attachmentPoints",
      "objectivePoints",
    ].map((key) => [key, "gt", 0]),
    {
      requires: "objective-points",
      unavailable: "Objective points are not part of this version's scoring.",
    },
  ),
  attempt(
    "theseus",
    "Cart of Theseus",
    "General",
    "Finish after losing at least two cosmetic or nonessential cart components.",
    [["lostComponents", "gte", 2]],
    {
      requires: "component-loss",
      unavailable: "Cart component loss is not implemented yet.",
    },
  ),
  attempt(
    "appeal-denied",
    "Physics Has Denied Your Appeal",
    "General",
    "Miss a multi-heat medal's combined-score threshold by exactly one point.",
    [["medalPointGap", "eq", 1]],
    {
      requires: "point-medals",
      unavailable:
        "Single-jump medals use skill goals. Combined Gauntlet near-miss tracking is not connected yet.",
    },
  ),
  attempt(
    "cold-blooded",
    "Cold-Blooded",
    "Jake",
    "Earn three Perfect Braces as Jake, across attempts.",
    [
      ["characterId", "eq", "jake"],
      ["brace", "eq", "Perfect Brace"],
    ],
    { aggregation: "count", target: 3, reward: "ice-border" },
  ),
  attempt(
    "no-reaction",
    "No Visible Reaction",
    "Jake",
    "Complete an optional objective after a severe crash as Jake.",
    [
      ["characterId", "eq", "jake"],
      ["severeCrash", "eq", true],
      ["objectivePassed", "eq", true],
    ],
  ),
  attempt(
    "chameleon",
    "Karma Chameleon",
    "Jake",
    "Complete a level whose conditions change during the attempt as Jake (After Hours: Karma Chameleon).",
    [
      ["characterId", "eq", "jake"],
      ["levelCompleted", "eq", true],
      ["conditionChanges", "gte", 1],
    ],
    {
      requires: "changing-conditions",
      unavailable: "Conditions currently stay fixed throughout each attempt.",
    },
  ),
  {
    id: "poetic-license",
    name: "Poetic License",
    category: "Brandon",
    description:
      "Win a Party Tournament outright as Brandon with style providing more than half of the winning jump's points.",
    event: "tournament-won",
    rules: [
      ["characterId", "eq", "brandon"],
      ["soleWinner", "eq", true],
      ["styleMajority", "eq", true],
    ],
    aggregation: "once",
    target: 1,
    reward: "poetic-line",
  },
  attempt(
    "coordination",
    "Against All Coordination",
    "Brandon",
    "Earn a Clean landing and Perfect Brace as Brandon.",
    [
      ["characterId", "eq", "brandon"],
      ["cleanLanding", "eq", true],
      ["brace", "eq", "Perfect Brace"],
    ],
  ),
  attempt(
    "tragedy",
    "A Tragedy in Three Acts",
    "Brandon",
    "Record overturned, head-impact, and torso-impact crashes as Brandon. The first crash cause counts once per attempt.",
    [
      ["characterId", "eq", "brandon"],
      ["crashClass", "in", ACHIEVEMENT_RULES.crashClasses],
    ],
    {
      aggregation: "unique",
      field: "crashClass",
      target: 3,
      values: ACHIEVEMENT_RULES.crashClasses,
    },
  ),
  attempt(
    "wrate-issues",
    "Wrate Issues",
    "Owen",
    "Earn a campaign medal as Owen under the Wrate Issue condition, after its pulse occurs.",
    [
      ["characterId", "eq", "owen"],
      ["condition", "eq", "wrate-issue"],
      ["mechanicalFailure", "eq", true],
      ["levelCompleted", "eq", true],
    ],
  ),
  attempt(
    "fix-that",
    "I Can Fix That",
    "Owen",
    "Recover from the Wrate Issue pulse and land Clean or Scrappy as Owen.",
    [
      ["characterId", "eq", "owen"],
      ["mechanicalRecovered", "eq", true],
      ["successfulLanding", "eq", true],
    ],
    { reward: "orange-cart" },
  ),
  attempt(
    "siemens",
    "Siemens Certified",
    "Owen",
    "Reach the configured rhythm-push speed cap before the takeoff timing zone as Owen.",
    [
      ["characterId", "eq", "owen"],
      ["runwayCapReached", "eq", true],
    ],
  ),
  attempt(
    "cone-of-composure",
    "Cone of Composure",
    "Jake",
    "Earn Gold in Ice Cream Weather as Jake.",
    [
      ["characterId", "eq", "jake"],
      ["levelId", "eq", "ice-cream-weather"],
      ["cleanLanding", "eq", true],
      ["brace", "eq", "Perfect Brace"],
    ],
  ),
  attempt(
    "shift-supervisor",
    "Shift Supervisor",
    "Owen",
    "Earn Gold in Siemens Certified as Owen.",
    [
      ["characterId", "eq", "owen"],
      ["levelId", "eq", "siemens-certified"],
      ["runwayCapReached", "eq", true],
      ["mechanicalRecovered", "eq", true],
      ["riderAttached", "eq", true],
    ],
  ),
  campaign(
    "graduate",
    "Vault Graduate",
    "Complete all ten main levels with one character.",
    { field: "completedLevels", target: 10, reward: "graduate-badge" },
  ),
  campaign(
    "liabilities",
    "Three Different Liabilities",
    "Complete all ten main levels with Jake, Brandon, and Owen.",
    {
      rules: [["completedLevels", "gte", 10]],
      aggregation: "unique",
      field: "characterId",
      target: 3,
      values: ["jake", "brandon", "owen"],
    },
  ),
  campaign(
    "factory",
    "Factory Settings",
    "Clear all ten main levels in one run without selecting an upgrade. Skip each reward to keep factory settings.",
    {
      rules: [
        ["runComplete", "eq", true],
        ["upgradeCount", "eq", 0],
      ],
      aggregation: "once",
      target: 1,
    },
  ),
  campaign(
    "favourite",
    "John’s Favourite",
    "Earn Gold on every main level with one character.",
    { field: "goldLevels", target: 10, reward: "gold-arena" },
  ),
  {
    id: "manual",
    name: "Read the Manual",
    category: "Hidden",
    hidden: true,
    description:
      "Keep one biography open for 30 seconds of visible, focused reading time.",
    event: "biography-read",
    rules: [["seconds", "gte", ACHIEVEMENT_RULES.biographySeconds]],
    aggregation: "once",
    target: 1,
  },
  attempt(
    "wheel",
    "The Wheel Was Never Essential",
    "Hidden",
    "Land after losing a wheel, when wheel loss is available.",
    [
      ["lostWheels", "gte", 1],
      ["landed", "eq", true],
    ],
    {
      hidden: true,
      requires: "wheel-loss",
      unavailable: "Wheel loss is not implemented yet.",
    },
  ),
  attempt(
    "softness",
    "Softness Sold Separately",
    "Hidden",
    "Collide with the Concrete+ sponsor slab.",
    [["sponsorHit", "eq", "concrete-plus"]],
    {
      hidden: true,
      requires: "sponsor-target",
      unavailable:
        "Sponsor banners are scenery; no collidable sponsor target exists yet.",
    },
  ),
]);
export const achievementById = (id) =>
  ACHIEVEMENTS.find((item) => item.id === id);
