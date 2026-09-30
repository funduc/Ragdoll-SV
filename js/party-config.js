import { CHARACTERS } from "./characters.js";
import { ALL_CONDITION_IDS } from "./run-config.js";

// Party Tournament settings. IDs here are stored in the saved party setup.
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const NAME_LENGTH = 16;
export const PARTY_FORMATS = Object.freeze({
  quick: Object.freeze({
    name: "Quick",
    summary: "One jump each. Highest score wins.",
  }),
  "best-of-3": Object.freeze({
    name: "Best of 3",
    summary: "Three rounds. Highest total wins.",
  }),
  elimination: Object.freeze({
    name: "Elimination",
    summary: "Lowest total drops out each round until one is left.",
  }),
});
export const FORMAT_IDS = Object.freeze(Object.keys(PARTY_FORMATS));
// Events. Party can play either; Vault Run stays long jump for now.
export const EVENTS = Object.freeze({
  "long-jump": Object.freeze({ name: "Long Jump", course: "long-jump" }),
  "high-jump": Object.freeze({
    name: "High Jump",
    course: "high-jump",
    summary:
      "The bar rises each round. Three tries per height; miss all three and you're out. Best cleared height wins.",
  }),
  bowling: Object.freeze({
    name: "Bowling",
    course: "bowling",
    summary:
      "Three frames, one throw each per frame. 10 points a pin, +50 for a strike, +25 if your rider flies into the pins.",
  }),
});
export const EVENT_IDS = Object.freeze(Object.keys(EVENTS));
// Bar heights in metres, one per round. Tuned so the opening height suits
// any player and all-Perfect pushes top out around 8 m for every character.
export const HIGH_JUMP_HEIGHTS = Object.freeze([
  1.0, 2.5, 4.0, 5.0, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
]);
export const HIGH_JUMP_TRIES = 3;
export const HIGH_JUMP_LINES = Object.freeze({
  cleared: [
    "Over! The bar did not even notice.",
    "Clean clearance. The bar remains employed.",
    "Up, over, and into the Squishco. Textbook.",
  ],
  fosbury: [
    "THE FOSBURY! Upside down over the bar! Dick Fosbury is applauding from the history books!",
    "A FLOP! A GENUINE FLOP! The cart went over backwards and the bar stayed put!",
  ],
  knocked: [
    "The bar is on the floor. The bar would like a word.",
    "Bar down! Physics has filed a complaint.",
  ],
  face: [
    "That bar was removed WITH A FACE. The judges are wincing in unison.",
  ],
  under: ["That was a limbo entry. Wrong event."],
  short: ["The bar was waiting. The bar is still waiting."],
});
// Chaos rolls from every condition, including the Party-only ones.
export const CHAOS_CONDITIONS = ALL_CONDITION_IDS;
export const CHAOS_LINES = Object.freeze({
  crosswind:
    "A crosswind has entered the building. The building has no windows. We are investigating.",
  "icy-ramp":
    "The ramp has been iced. Jake inspected it and called it 'basically a warm day.'",
  "heavy-cart":
    "Tonight's cart has been upgraded with a second, heavier cart inside it.",
  "boost-strip":
    "The blue strip is back. It is fast, it is legal, and it is sponsored.",
  "wrate-issue":
    "Owen reports a Wrate Issue. Owen also reports everything is fine. Both statements are official.",
  "low-gravity":
    "The loading dock's anti-gravity promo is ON. Gravity is down forty percent. Expectations are up.",
  tailwind:
    "A sponsored leaf blower is pointed at the landing strip. Please do not thank the leaf blower.",
  "shifting-wind":
    "Chameleon Wind! It changes direction every half-second, like one of Brandon's metaphors.",
});
export const ROUND_LINES = Object.freeze([
  "Same cart. Same ramp. Fresh regrets.",
  "The scoreboard is watching. So is the cart.",
  "Deep breaths. The cart can smell fear.",
]);
export const DEFAULT_SETUP = Object.freeze({
  players: Object.freeze(
    CHARACTERS.map((c) =>
      Object.freeze({ name: c.name.split(" ")[0], characterId: c.id }),
    ),
  ),
  format: "quick",
  chaos: false,
  event: "long-jump",
});

const cleanName = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_LENGTH);
// Accepts saved or edited setup data; anything malformed falls back safely.
export function normalizeSetup(raw) {
  const source = Array.isArray(raw?.players)
    ? raw.players.slice(0, MAX_PLAYERS)
    : DEFAULT_SETUP.players;
  const players = source.map((p, i) => ({
    name: cleanName(p?.name),
    characterId: CHARACTERS.some((c) => c.id === p?.characterId)
      ? p.characterId
      : CHARACTERS[i % CHARACTERS.length].id,
  }));
  while (players.length < MIN_PLAYERS)
    players.push({
      name: "",
      characterId: CHARACTERS[players.length % CHARACTERS.length].id,
    });
  return {
    players,
    format: FORMAT_IDS.includes(raw?.format) ? raw.format : "quick",
    chaos: raw?.chaos === true,
    event: EVENT_IDS.includes(raw?.event) ? raw.event : "long-jump",
  };
}
export const displayName = (name, index) =>
  cleanName(name) || `Player ${index + 1}`;

// The last setup is remembered between visits. Storage may be missing,
// denied or corrupt; the game then simply starts from the defaults.
export const PARTY_SETUP_KEY = "santor-vault:party-setup";
export function loadPartySetup(storage) {
  try {
    const raw = storage?.getItem(PARTY_SETUP_KEY);
    return normalizeSetup(raw ? JSON.parse(raw) : DEFAULT_SETUP);
  } catch {
    return normalizeSetup(DEFAULT_SETUP);
  }
}
export function savePartySetup(storage, setup) {
  try {
    storage?.setItem(
      PARTY_SETUP_KEY,
      JSON.stringify({ version: 1, ...normalizeSetup(setup) }),
    );
    return true;
  } catch {
    return false;
  }
}
