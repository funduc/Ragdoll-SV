// SANTOR ON TOUR — optional, per-character medals in the existing save catalog.
// Like After Hours, this chapter is separate from the ten main lessons.
const arena = { id: "santor-vault", gravity: 1.05 };
const goal = (label, all) => ({ label, all });
export const QUIET_IMPACT_LIMIT = 950; // First-contact normal speed, world pixels/second.
export const ROAD_POEM = Object.freeze([
  "Mapleton, your lamps burn bright,",
  "Your bumps have learned to rhyme tonight,",
  "Three holes applaud beneath my flight,",
  "I land. The road concedes. Good night.",
]);

export const TOUR_LEVELS = [
  {
    id: "freezer-aisle",
    name: "FREEZER AISLE",
    chapter: "santor-on-tour",
    bonus: true,
    estimatedMinutes: 3,
    description: "Build speed on the icy run-up, then land on a freezer lid — the gaps are pits. Lid 5 is farthest; brace just before contact and keep the wheels down.",
    objective: "Aim for the five raised lids. First contact on a lid counts; falling into a gap is a crash.",
    arena: { ...arena, course: "freezer-aisle" },
    condition: "icy-ramp",
    optionalObjective: "attached-landing",
    upgradeReward: false,
    modifier: { id: "freezer-coach", focus: "freezer", name: "Cold Storage" },
    bronze: goal("Complete a jump (crash landings count).", { completedJump: true }),
    silver: goal("Land on any freezer lid.", { freezerLidLanding: true }),
    gold: goal("Land Clean on a freezer lid.", { freezerLidLanding: true, controlledLanding: true }),
    santorMedal: goal("Land Clean on lid 5 with Perfect Brace.", {
      farthestFreezerLanding: true, controlledLanding: true, perfectBrace: true,
    }),
    prerequisites: ["the-santor-gauntlet"],
    john: {
      introduction: "Jake's cold-resistance review has been moved to aisle nine.",
      characters: {
        jake: "Jake, after the ice-cream frostbite incident, the lids are strictly for landing. No taste tests.",
        brandon: "Brandon, a cold open still needs a warm reception. Aim for a lid.",
        owen: "Owen, the freezer warranty does not cover overtime landings.",
      },
      results: {
        none: "The gap is not an express checkout. Please return to the ramp.",
        bronze: "Jump complete. The frozen-food department has recorded the incident.",
        silver: "Lid acquired. Please leave the ice cream where you found it.",
        gold: "CLEAN LANDING. THE COLD CHAIN REMAINS UNBROKEN.",
      },
    },
  },
  {
    id: "open-mic",
    name: "THE OPEN MIC",
    chapter: "santor-on-tour",
    bonus: true,
    estimatedMinutes: 3,
    description: "Clear the tall mic stand and vary your tricks to build applause — crashes lose the crowd. Hold a direction for a flip, counter-steer to level, then brace near contact.",
    objective: "Each different recognized trick adds applause; repeats do not. Land two tricks for Silver, three for Gold. The mic stand is solid: head or torso contact crashes.",
    arena: { ...arena, course: "open-mic" },
    condition: null,
    optionalObjective: "two-tricks",
    upgradeReward: false,
    modifier: { id: "trick-coach", focus: "tricks", name: "Crowd Work" },
    bronze: goal("Complete a jump (crash landings count).", { completedJump: true }),
    silver: goal("Perform 2 unique tricks and land (crash landings count).", { uniqueTricks: 2, completedJump: true }),
    gold: goal("Perform 3 unique tricks and land successfully.", { uniqueTricks: 3, successfulLanding: true }),
    santorMedal: goal("3 unique tricks, Clean landing, and never touch the mic stand.", {
      uniqueTricks: 3, controlledLanding: true, micUntouched: true,
    }),
    prerequisites: ["freezer-aisle"],
    john: {
      introduction: "Jake's comedy tour has reached a venue that actually exists.",
      characters: {
        jake: "Jake, the microphone is booked for the next act. Please clear it.",
        brandon: "Brandon, three different tricks. Repeating the first verse does not count.",
        owen: "Owen, a tight five refers to the set. The wheels can stay attached.",
      },
      results: {
        none: "The set ended before the punchline found the floor.",
        bronze: "A complete set. The crowd has agreed to remain in the building.",
        silver: "Two different bits, both landed. The front row is warming up.",
        gold: "THREE BITS LANDED. THE STOOL HAS REQUESTED YOUR AUTOGRAPH.",
      },
    },
  },
  {
    id: "mapleton-night-shift", name: "MAPLETON ROAD: NIGHT SHIFT",
    chapter: "santor-on-tour", bonus: true, estimatedMinutes: 3,
    description: "Time your pushes over three taller speed bumps, then land between three potholes. Each bump carries a line of Brandon's road poem. Falling into a pothole is a crash.",
    objective: "Gold needs first contact between potholes and no Missed pushes. Add a Clean landing and Perfect takeoff for Santor.",
    arena: { ...arena, course: "mapleton-night-shift" }, condition: null,
    optionalObjective: "attached-landing", upgradeReward: false,
    modifier: { id: "road-poem-coach", focus: "night-road", name: "Brandon's Road Poem" },
    bronze: goal("Complete a jump (crash landings count).", { completedJump: true }),
    silver: goal("Land without falling in a pothole.", { completedJump: true, avoidedPotholes: true }),
    gold: goal("Land between potholes with no Missed pushes.", { betweenPotholes: true, avoidedPotholes: true, noMiss: true }),
    santorMedal: goal("Gold plus a Clean landing and Perfect takeoff.", {
      betweenPotholes: true, avoidedPotholes: true, noMiss: true, controlledLanding: true, perfectTakeoff: true,
    }),
    prerequisites: ["open-mic"],
    john: {
      introduction: "Brandon has returned to Mapleton Road. The road has returned to being a problem.",
      characters: {
        jake: "Jake, these holes contain neither ice cream nor a shortcut.",
        brandon: "Brandon, one line per bump. The council has declined an encore.",
        owen: "Owen, night shift. The asphalt has already clocked out.",
      },
      results: {
        none: "The road has requested another draft.",
        bronze: "The jump is complete. The repair request remains open.",
        silver: "You found asphalt. The council calls that a premium service.",
        gold: "NO MISSED BEATS. EVEN THE POTHOLES HAVE STOPPED INTERRUPTING.",
      },
    },
  },
  {
    id: "quiet-please", name: "QUIET PLEASE",
    chapter: "santor-on-tour", bonus: true, estimatedMinutes: 3,
    description: "Clear the second kicker and its loose book stack, then land beyond the arrow. Try Good takeoff for a lower, quieter arc; level the cart and brace before contact.",
    objective: "The noise meter measures the first landing. Stay at or below 100% for a quiet impact. Gold needs Clean beyond the books; Santor adds a trick and zero books knocked over.",
    arena: { ...arena, course: "quiet-please" }, condition: null,
    optionalObjective: "attached-landing", upgradeReward: false,
    modifier: { id: "library-coach", focus: "library", name: "Library Rules" },
    bronze: goal("Complete a jump (crash landings count).", { completedJump: true }),
    silver: goal("Land past the book stack.", { pastBookStack: true }),
    gold: goal("Land Clean past the book stack with a quiet impact.", {
      pastBookStack: true, controlledLanding: true, quietImpact: true,
    }),
    santorMedal: { ...goal("Gold with a trick and zero books knocked over.", {
      pastBookStack: true, controlledLanding: true, quietImpact: true, uniqueTricks: 1,
    }), max: { propsFallen: 0 } },
    prerequisites: ["mapleton-night-shift"],
    john: {
      introduction: "brandon. this is the only place he is asked to use fewer words.",
      characters: {
        jake: "jake, this is a lending library. the cart is overdue.",
        brandon: "brandon, please submit the poem in writing. quietly.",
        owen: "owen, even the overtime must use its inside voice.",
      },
      results: {
        none: "please renew your attempt.",
        bronze: "jump filed. volume under review.",
        silver: "past the books. the librarian heard the ending.",
        gold: "clean. quiet. the librarian has approved a silent celebration.",
      },
    },
  },
];

export const libraryTooLoud = (world) => world.impactLoudness > QUIET_IMPACT_LIMIT;
export const noisePercent = (world) => Math.ceil((world.impactLoudness ?? 0) / QUIET_IMPACT_LIMIT * 100);

export function roadVerse(world) {
  if (world.course.id !== "mapleton-night-shift") return -1;
  return world.course.pieces.filter((p) => p.label.startsWith("poem-bump-") &&
    world.cart.position.x >= p.points[1].x).length - 1;
}

// Presentation only: never added to points, medals, achievements or saves.
export function applause(uniqueTricks, crashed) {
  const value = Math.min(100, uniqueTricks * 25);
  return crashed ? Math.floor(value / 4) : value;
}

export function crowdCue(score) {
  return !score.crashed && ["Clean", "Scrappy"].includes(score.landingQuality)
    ? "crowd" : "boo";
}

export function tourFacts(world) {
  const lids = world.course.pieces.filter((p) => p.type === "platform");
  const freezerLidLanding = world.course.id === "freezer-aisle" &&
    world.firstLandingOnTop && lids.includes(world.firstLandingPiece);
  const night = world.course.id === "mapleton-night-shift";
  const pits = night ? world.course.pieces.filter((p) => p.type === "pit") : [];
  const landingX = world.course.distanceOrigin + world.distancePixels;
  const stack = world.course.pieces.find((p) => p.label === "book-stack");
  return {
    freezerLidLanding: Boolean(freezerLidLanding),
    farthestFreezerLanding: Boolean(freezerLidLanding && world.firstLandingPiece === lids.at(-1)),
    micUntouched: world.course.id === "open-mic" && world.obstacleHits.size === 0,
    avoidedPotholes: night && world.crashClassification !== "pit-fall",
    betweenPotholes: night && world.landed && !world.firstLandingPiece && pits.some((p, i) =>
      i > 0 && landingX > pits[i - 1].x + pits[i - 1].width / 2 && landingX < p.x - p.width / 2),
    pastBookStack: Boolean(stack && world.landed && !world.firstLandingPiece && landingX > stack.x + stack.width / 2),
    quietImpact: world.course.id === "quiet-please" && Number.isFinite(world.impactLoudness) && !libraryTooLoud(world),
  };
}
