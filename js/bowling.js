// CART BOWLING rules and John's bowling lines. Scores come from the real
// pins in the physics world (see PhysicsWorld.bowlingResult).
export const BOWLING = Object.freeze({
  throws: 3, // one throw per player in each of three frames
  pinPoints: 10,
  strikeBonus: 50, // all ten pins on one throw
  carnageBonus: 25, // the rider, thrown clear of the cart, flies into the pins
});

export function scoreBowling(result) {
  if (!result) return null;
  const pins = Math.max(0, Math.min(10, Math.floor(result.pins) || 0));
  const strike = pins === 10;
  const carnage = result.riderHit === true;
  const pinPoints = pins * BOWLING.pinPoints,
    strikeBonus = strike ? BOWLING.strikeBonus : 0,
    carnageBonus = carnage ? BOWLING.carnageBonus : 0;
  return Object.freeze({
    pins,
    strike,
    carnage,
    riderOnly: strike && result.riderOnly === true,
    zeroAtMaxSpeed: pins === 0 && result.maxSpeed === true,
    pinPoints,
    strikeBonus,
    carnageBonus,
    points: pinPoints + strikeBonus + carnageBonus,
  });
}

export const BOWLING_LINES = Object.freeze({
  strike: [
    "STRIKE! All ten! The cereal aisle has been cleared!",
    "STRIKE! That rack has been rehomed in a single trip!",
    "Ten for ten! The Crunchos never saw it coming!",
  ],
  riderStrike: [
    "A STRIKE WITH THE RIDER! The cart delivered the passenger and the passenger delivered the strike!",
  ],
  carnage: [
    "The rider has left the cart and entered the pins! Carnage bonus approved!",
    "That's not a technique. That's a flight path. Carnage bonus!",
  ],
  big: [
    "Nearly all of them! One box is clinging on out of pure spite.",
    "A big hit! The pins are filing for relocation.",
  ],
  some: [
    "Some pins down. The rest are pretending they didn't see anything.",
    "A respectable dent in the cereal aisle.",
  ],
  few: [
    "A gentle tap. The pins barely noticed.",
    "One or two down. The cart asked nicely.",
  ],
  gutter: [
    "Zero pins. The Crunchos remain undefeated.",
    "Not a single box. The lane would like to apologise.",
  ],
  hit: ["AND INTO THE PINS!", "CEREAL-BOX CARNAGE!"],
});
// Which kind of line suits a result.
export function bowlingLineKind(score) {
  if (!score) return "gutter";
  if (score.riderOnly) return "riderStrike";
  if (score.strike) return "strike";
  if (score.carnage) return "carnage";
  if (score.pins >= 8) return "big";
  if (score.pins >= 4) return "some";
  if (score.pins >= 1) return "few";
  return "gutter";
}
const cursor = {};
export function bowlingLine(kind) {
  const lines = BOWLING_LINES[kind] || BOWLING_LINES.some;
  cursor[kind] = ((cursor[kind] ?? -1) + 1) % lines.length;
  return lines[cursor[kind]];
}
