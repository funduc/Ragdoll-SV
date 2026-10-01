// SANTOR ON TOUR — optional, per-character medals in the existing save catalog.
// Like After Hours, this chapter is separate from the ten main lessons.
const arena = { id: "santor-vault", gravity: 1.05 };
const goal = (label, all) => ({ label, all });

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
];

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
  return {
    freezerLidLanding: Boolean(freezerLidLanding),
    farthestFreezerLanding: Boolean(freezerLidLanding && world.firstLandingPiece === lids.at(-1)),
    micUntouched: world.course.id === "open-mic" && world.obstacleHits.size === 0,
  };
}
