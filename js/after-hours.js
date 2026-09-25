// AFTER HOURS — optional bonus chapter, unlocked by Bronze in The Santor
// Gauntlet. Uses the same medal evaluator, score formula and save catalog as the
// main ten levels; it is excluded from main-campaign completion achievements.
const arena = { id: "santor-vault", gravity: 1.05 };
const goal = (label, all) => ({ label, all });
const coach = (focus, name) => ({ id: `${focus}-coach`, focus, name });
const john = (introduction, characters, success, failure, gold) => ({
  introduction,
  characters,
  results: {
    none: failure,
    bronze: success,
    silver: `${success} Silver confirmed.`,
    gold,
  },
});
// A real, collidable slab 49–56 m from the ramp edge. Concrete, not foam.
// Its leading edge is bevelled so a wheel rolls up instead of tripping.
export const CONCRETE_SLAB = Object.freeze({
  startMetres: 49,
  endMetres: 56,
  height: 16,
  bevel: 36,
  label: "CONCRETE+",
});
const slabArena = { ...arena, target: CONCRETE_SLAB };

export const AFTER_HOURS_LEVELS = [
  {
    id: "loading-dock-low-g",
    name: "LOADING DOCK: LOW-G",
    chapter: "after-hours",
    bonus: true,
    estimatedMinutes: 3,
    description:
      "The Vault is closed. The loading dock's anti-gravity promo is not. Gravity is down 40%, which is finally enough hang time for two full rotations.",
    objective:
      "Use the extra airtime: hold one direction for two complete rotations (a Double Flip), then counter-steer and land.",
    arena,
    condition: "low-gravity",
    optionalObjective: "two-tricks",
    upgradeReward: false,
    modifier: coach("lowg", "Hang-Time Coach"),
    bronze: goal("Take off and complete a landing.", { completedJump: true }),
    silver: goal("Land successfully with 2 unique tricks.", {
      successfulLanding: true,
      uniqueTricks: 2,
    }),
    gold: goal("Land a Double Flip successfully.", {
      doubleFlip: true,
      successfulLanding: true,
    }),
    santorMedal: goal("Double Flip, Clean landing and Perfect Brace.", {
      doubleFlip: true,
      controlledLanding: true,
      perfectBrace: true,
    }),
    prerequisites: ["the-santor-gauntlet"],
    john: john(
      "Welcome to After Hours. Gravity has gone home early.",
      {
        jake: "Jake rotates slowly. Low gravity has granted him an extension.",
        brandon:
          "Brandon, a Double Flip is two stanzas. Please end on the wheels.",
        owen: "Owen's rotation was already too fast. The dock has removed the only thing stopping him.",
      },
      "Landed in reduced gravity. The dock is impressed.",
      "Gravity eventually returned. The landing did not.",
      "DOUBLE FLIP. GRAVITY HAS FILED A COMPLAINT.",
    ),
  },
  {
    id: "concrete-plus-demo",
    name: "CONCRETE+ PRODUCT DEMO",
    chapter: "after-hours",
    bonus: true,
    estimatedMinutes: 3,
    description:
      "Concrete+ has installed a real 49–56 m demonstration slab. A sponsored leaf blower supplies a tailwind. Softness is sold separately and was not purchased.",
    objective:
      "Build maximum speed, nail the takeoff and ride the tailwind. First contact on the raised slab counts as a landing on it.",
    arena: slabArena,
    condition: "tailwind",
    optionalObjective: "attached-landing",
    upgradeReward: false,
    modifier: coach("slab", "Sponsor Relations"),
    bronze: goal("Take off and complete a landing.", { completedJump: true }),
    silver: goal("Reach at least 46 m.", { distanceMetres: 46 }),
    gold: goal("Land successfully on the Concrete+ slab.", {
      targetLanding: true,
    }),
    santorMedal: goal(
      "Land Clean on the slab with Perfect takeoff and Perfect Brace.",
      {
        targetLanding: true,
        controlledLanding: true,
        perfectTakeoff: true,
        perfectBrace: true,
      },
    ),
    prerequisites: ["loading-dock-low-g"],
    john: john(
      "Concrete+ is our proudest sponsor. Their slab is harder than their marketing.",
      {
        jake: "Jake has read the Concrete+ brochure. His expression has not.",
        brandon:
          "Brandon, the slab is not a metaphor for anything. It is concrete.",
        owen: "Owen checked the slab's certificate. It was printed on the slab.",
      },
      "Distance logged. Concrete+ thanks you for your interest.",
      "The leaf blower did its part. The takeoff has been asked to do more.",
      "LANDED ON THE SLAB. CONCRETE+ WOULD LIKE TO USE THIS FOOTAGE.",
    ),
  },
  {
    id: "karma-chameleon",
    name: "KARMA CHAMELEON",
    chapter: "after-hours",
    bonus: true,
    estimatedMinutes: 3,
    description:
      "The wind comes and goes. Once airborne, a gust hits the rider's upper body and flips direction every 0.45 seconds: forward pitches the nose down, backward pitches it up.",
    objective:
      "Read the status bar, counter-steer each gust change, then brace a level landing. The wind stops at first contact.",
    arena,
    condition: "shifting-wind",
    optionalObjective: "perfect-brace",
    upgradeReward: false,
    modifier: coach("chameleon", "Weathervane Coach"),
    bronze: goal("Take off and complete a landing.", { completedJump: true }),
    silver: goal("Land successfully with the rider attached.", {
      successfulLanding: true,
      riderAttached: true,
    }),
    gold: goal("Land Clean with Good Brace or better.", {
      controlledLanding: true,
      goodBrace: true,
    }),
    santorMedal: goal(
      "Clean landing, Perfect Brace and at least one recognized trick.",
      { controlledLanding: true, perfectBrace: true, uniqueTricks: 1 },
    ),
    prerequisites: ["concrete-plus-demo"],
    john: john(
      "Karma, karma, karma, karma, karma chameleon. The wind has chosen violence.",
      {
        jake: "Jake, this is your song. The wind is also singing it, badly.",
        brandon:
          "Brandon, the wind keeps changing its argument. Please keep yours.",
        owen: "Owen, the wind is not a Wrate Issue. It only behaves like one.",
      },
      "The wind changed. The landing stayed.",
      "The wind won this round. It changes its mind; perhaps you will too.",
      "CLEAN THROUGH THE CHAMELEON. JOHN IS HUMMING. PLEASE MAKE HIM STOP.",
    ),
  },
  {
    id: "closing-time",
    name: "CLOSING TIME",
    chapter: "after-hours",
    bonus: true,
    estimatedMinutes: 5,
    description:
      "Three heats before the lights go out: low gravity, the Concrete+ slab with tailwind, then the chameleon wind. Scores add together, as in the Gauntlet.",
    objective:
      "Bank three jumps. Use the low-G heat for rotations, the tailwind heat for distance, and survive the chameleon.",
    arena,
    modifier: coach("closing", "Last Call"),
    upgradeReward: false,
    stages: [
      {
        name: "HANG TIME",
        condition: "low-gravity",
        optionalObjective: "front-flip",
        introduction:
          "Closing heat one. Gravity is on a smoke break. Rotate while it lasts.",
      },
      {
        name: "SLAB SERVICE",
        condition: "tailwind",
        optionalObjective: "distance-35",
        arena: slabArena,
        introduction:
          "Heat two. THE SLAB IS OPEN FOR BUSINESS. The leaf blower is at maximum.",
      },
      {
        name: "LAST CALL",
        condition: "shifting-wind",
        optionalObjective: "attached-landing",
        introduction:
          "FINAL HEAT. THE WIND CANNOT DECIDE. THE LIGHTS HAVE DECIDED FOR IT.",
      },
    ],
    bronze: goal(
      "Complete all 3 jumps and bank at least 1,500 combined points.",
      { completedJumps: 3, combinedScore: 1500 },
    ),
    silver: goal(
      "Bank 2,600 points with 2 successful landings and 2 unique tricks.",
      { combinedScore: 2600, successfulLandings: 2, uniqueTricks: 2 },
    ),
    gold: goal(
      "Bank 3,300 points, 3 successful landings, a Double Flip and a slab landing.",
      {
        combinedScore: 3300,
        successfulLandings: 3,
        doubleFlips: 1,
        targetLandings: 1,
      },
    ),
    santorMedal: goal(
      "4,000 combined points, 3 Clean landings and 3 Perfect Braces.",
      { combinedScore: 4000, controlledLandings: 3, perfectBraces: 3 },
    ),
    prerequisites: ["karma-chameleon"],
    john: john(
      "Closing time. You don't have to go home, but you can't jump here.",
      {
        jake: "Jake has asked whether the Vault ever actually closes. It does not.",
        brandon:
          "Brandon, this is the epilogue. The final line should be a landing.",
        owen: "Owen has volunteered to lock up. Nobody has given Owen the keys.",
      },
      "LIGHTS OUT. THE VAULT HAS CLOSED AROUND YOU.",
      "All three heats banked. The cleaners would like to see a better total.",
      "CLOSING TIME, GOLD. THE VAULT IS YOURS. PLEASE TURN OFF THE LEAF BLOWER.",
    ),
  },
];
