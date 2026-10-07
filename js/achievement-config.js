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
  toastSeconds: 4.5,
  crashClasses: ["overturned", "head-impact", "torso-impact"],
});
export const ACHIEVEMENT_CAPABILITIES = freeze({
  "component-loss": true,
  "wheel-loss": true,
  "changing-conditions": true,
  "objective-points": false,
  "point-medals": false,
  "sponsor-target": false,
});
export const COSMETIC_REWARDS = freeze({
  "rookie-badge": {
    name: "Vault Rookie",
    slot: "badge",
    value: "VAULT ROOKIE",
  },
  "blue-cart": { name: "Electric Blue cart", slot: "cart", value: "#52cefa", pattern: "bolt" },
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
    pattern: "bolt",
  },
  "graduate-badge": {
    name: "Vault Graduate",
    slot: "badge",
    value: "VAULT GRADUATE",
  },
  "gold-arena": { name: "Gold arena lights", slot: "arena", value: "#ffe17d" },
  "neon-trail": { name: "Sync Wave trail", slot: "trail", value: "neon" },
  "comet-trail": { name: "Comet Tail", slot: "trail", value: "comet" },
  "pin-crown": { name: "Kingpin crown", slot: "hat", value: "pin-crown" },
  "ice-cap": { name: "Frostbite beanie", slot: "hat", value: "ice-cap" },
  headphones: { name: "Full Cast headphones", slot: "hat", value: "headphones" },
  "tour-cart": { name: "Tour Gold star paint", slot: "cart", value: "#ffe17d", pattern: "star" },
  "hazard-cart": { name: "Hazard Pay stripes", slot: "cart", value: "#ffb84b", pattern: "hazard" },
  "podium-salute": { name: "Santor Salute pose", slot: "pose", value: "salute" },
  "air-guitar": { name: "Air Guitar encore pose", slot: "pose", value: "air-guitar" },
});
export const COSMETIC_SLOTS = freeze([
  "cart",
  "border",
  "commentary",
  "badge",
  "arena",
  "trail",
  "hat",
  "pose",
]);
export const ACHIEVEMENT_TIERS = freeze({
  Bronze: "#dca477", Silver: "#c1d9ef", Gold: "#ffe17d", Platinum: "#b9a5ff",
});
const icons = {
  "tour-complete": "trophy", "sync-first": "notes", "sync-perfect": "star", "sync-land": "notes",
  "sync-three": "orbit", "sync-miss-medal": "stamp", "sync-twice": "notes", welcome: "ticket",
  airborne: "wings", butter: "target", barrel: "orbit", "not-phase": "star", "style-over": "star",
  "dead-centre": "target", "full-package": "parcel", theseus: "tools", "appeal-denied": "stamp",
  "cold-blooded": "snow", "no-reaction": "face", chameleon: "wind", "poetic-license": "book",
  coordination: "target", tragedy: "mask", "wrate-issues": "bolt", "fix-that": "tools", siemens: "bolt",
  "cone-of-composure": "icecream", "shift-supervisor": "helmet", graduate: "cap", liabilities: "crew",
  factory: "cart", favourite: "crown", manual: "book", "hj-first-clear": "bar", "hj-fosbury": "orbit",
  "hj-face": "face", "bowl-strike": "pin", "bowl-rider-strike": "pin", "bowl-zero-max": "pin",
  wheel: "wheel", softness: "target", "sync-encore": "notes", "strike-collector": "pin",
  "frequent-flyer": "wings", "tour-postcards": "ticket", "parts-department": "explosion",
  "heckle-chorus": "laugh", "full-cast": "crew",
};
const platinum = ["tour-complete", "sync-three", "liabilities", "favourite", "bowl-rider-strike", "tour-postcards"];
const gold = ["sync-perfect", "sync-land", "not-phase", "dead-centre", "full-package", "chameleon", "poetic-license", "tragedy", "cone-of-composure", "shift-supervisor", "factory", "hj-fosbury", "strike-collector", "parts-department"];
const bronze = ["welcome", "airborne", "sync-first", "barrel", "manual", "hj-first-clear", "hj-face", "bowl-zero-max"];
const hints = {
  manual: "The small print rewards a patient reader.",
  wheel: "Four wheels was always an opening offer.",
  softness: "One sponsor's promise deserves a closer inspection.",
  "heckle-chorus": "Your friends have reviews of your landings. None are helpful.",
};
const huntUnits = {
  "cold-blooded": ["Perfect Brace", "Perfect Braces"], tragedy: ["different crash type", "different crash types"],
  graduate: ["main level", "main levels"], favourite: ["Gold medal", "Gold medals"],
  liabilities: ["character's complete campaign", "characters' complete campaigns"],
  "sync-twice": ["Sync in a completed run", "Syncs in a completed run"],
  "sync-encore": ["Perfect Sync", "Perfect Syncs"], "strike-collector": ["strike", "strikes"],
  "frequent-flyer": ["bar clearance", "bar clearances"], "tour-postcards": ["new Tour stop", "new Tour stops"],
  "full-cast": ["different character voice", "different character voices"],
};
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
  attempt("tour-complete", "TOUR COMPLETE", "Campaign",
    "Clear Grand Reopening and bring Santor on Tour home.",
    [["levelId", "eq", "grand-reopening"], ["levelCompleted", "eq", true]], { reward: "podium-salute" }),
  attempt(
    "sync-first",
    "In Sync",
    "Sync Moments",
    "Complete your first Sync Moment and finish the attempt.",
    [["syncCompleted", "eq", true]],
  ),
  attempt(
    "sync-perfect",
    "Physics Lost Jurisdiction",
    "Sync Moments",
    "Earn Perfect Sync and finish the attempt.",
    [["syncPerfect", "eq", true]],
  ),
  attempt(
    "sync-land",
    "Beat the Landing",
    "Sync Moments",
    "Earn Perfect Sync and land successfully.",
    [
      ["syncPerfect", "eq", true],
      ["successfulLanding", "eq", true],
    ],
  ),
  attempt(
    "sync-three",
    "Triple Time",
    "Sync Moments",
    "Complete three rotations and earn style points from a Sync Moment.",
    [
      ["syncBoosted", "eq", true],
      ["rotations", "gte", 3],
    ],
  ),
  attempt(
    "sync-miss-medal",
    "Legally Valid",
    "Sync Moments",
    "Miss every Sync note but still earn a medal.",
    [
      ["syncAllMiss", "eq", true],
      ["levelCompleted", "eq", true],
    ],
  ),
  campaign(
    "sync-twice",
    "Encore in the Vault",
    "Trigger two Sync Moments during one completed Vault Run.",
    {
      category: "Sync Moments",
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
    "Finish after losing at least two cart parts.",
    [["lostComponents", "gte", 2]],
    {
      requires: "component-loss",
    },
  ),
  attempt(
    "appeal-denied",
    "Physics Has Denied Your Appeal",
    "General",
    "Miss a points-based medal threshold by exactly one point.",
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
    "Complete a level whose conditions change during the attempt as Jake.",
    [
      ["characterId", "eq", "jake"],
      ["levelCompleted", "eq", true],
      ["conditionChanges", "gte", 1],
    ],
    {
      requires: "changing-conditions",
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
    { reward: "ice-cap" },
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
    "hj-first-clear",
    "Over the Top",
    "High Jump",
    "Clear the bar in Cart High Jump.",
    [["hjCleared", "eq", true]],
  ),
  attempt(
    "hj-fosbury",
    "The Fosbury Flop",
    "High Jump",
    "Clear the High Jump bar upside down.",
    [["hjFosbury", "eq", true]],
  ),
  attempt(
    "hj-face",
    "Bar Examination",
    "High Jump",
    "Knock the High Jump bar off with your face. The bar has filed a complaint.",
    [["hjFace", "eq", true]],
  ),
  attempt(
    "bowl-strike",
    "Clean Aisle",
    "Bowling",
    "Knock down all ten pins with one throw in Cart Bowling.",
    [["bowlStrike", "eq", true]],
  ),
  attempt(
    "bowl-rider-strike",
    "Human Bowling Ball",
    "Bowling",
    "Bowl a strike where only your flying rider touched the pins.",
    [["bowlRiderStrike", "eq", true]],
  ),
  attempt(
    "bowl-zero-max",
    "Full Send, Zero Pins",
    "Bowling",
    "Reach maximum run-up speed and still knock down no pins at all.",
    [["bowlZeroMax", "eq", true]],
  ),
  attempt(
    "wheel",
    "The Wheel Was Never Essential",
    "Hidden",
    "Touch down after a wheel snaps off in a crash.",
    [
      ["lostWheels", "gte", 1],
      ["landed", "eq", true],
      ["landedAfterWheelLoss", "eq", true],
    ],
    {
      hidden: true,
      requires: "wheel-loss",
    },
  ),
  attempt(
    "softness",
    "Softness Sold Separately",
    "Hidden",
    "Collide with the Concrete+ sponsor target.",
    [["sponsorHit", "eq", "concrete-plus"]],
    {
      hidden: true,
      requires: "sponsor-target",
      unavailable:
        "Sponsor banners are scenery; no collidable sponsor target exists yet.",
    },
  ),
  attempt("sync-encore", "The Beat Goes On", "Sync Moments", "Earn three Perfect Syncs across finished attempts.",
    [["syncPerfect", "eq", true]], { aggregation: "count", target: 3, reward: "neon-trail" }),
  attempt("strike-collector", "Strike Collector", "Bowling", "Bowl three strikes across finished throws.",
    [["bowlStrike", "eq", true]], { aggregation: "count", target: 3, reward: "pin-crown" }),
  attempt("frequent-flyer", "Frequent Flyer", "High Jump", "Clear the bar on three finished High Jump attempts.",
    [["hjCleared", "eq", true]], { aggregation: "count", target: 3, reward: "comet-trail" }),
  attempt("tour-postcards", "Wish You Were Airborne", "Campaign", "Clear all eight Tour stops. Different characters can contribute to the collection.",
    [["levelCompleted", "eq", true], ["tourStop", "eq", true]], {
      aggregation: "unique", field: "levelId", target: 8, reward: "tour-cart",
      values: ["freezer-aisle", "open-mic", "mapleton-night-shift", "quiet-please", "siemens-floor", "temu-warehouse", "rooftop-delivery", "grand-reopening"],
    }),
  attempt("parts-department", "The Parts Department", "Carnage", "Earn 1,000 carnage in one crash. Ordinary score is unchanged.",
    [["crashed", "eq", true]], { aggregation: "max", field: "carnage", target: 1000, reward: "hazard-cart" }),
  { id: "heckle-chorus", name: "A Tough Crowd", category: "Hidden", hidden: true,
    description: "Hear a different character heckle your crash three times.", event: "voice-played",
    rules: [["heckle", "eq", true]], aggregation: "count", target: 3, reward: "air-guitar" },
  { id: "full-cast", name: "Full Cast", category: "General", description: "Hear a voice clip from Jake, Brandon and Owen.",
    event: "voice-played", rules: [], aggregation: "unique", field: "speakerId", values: ["jake", "brandon", "owen"], target: 3, reward: "headphones" },
].map(item => ({
  ...item, icon: icons[item.id],
  tier: platinum.includes(item.id) ? "Platinum" : gold.includes(item.id) ? "Gold" : bronze.includes(item.id) ? "Bronze" : "Silver",
  ...(item.hidden ? { hint: hints[item.id] } : {}),
  ...(huntUnits[item.id] ? { huntUnits: huntUnits[item.id] } : {}),
})));
export const achievementById = (id) =>
  ACHIEVEMENTS.find((item) => item.id === id);
