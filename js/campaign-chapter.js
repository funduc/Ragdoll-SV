// Chapter content only. Arena additions are ordinary Matter bodies/constraints;
// conditions, objectives, upgrades and score components use the existing rules.
// Gravity is in Matter units; bumps/cargo sizes are world pixels. No random forces.
const arena = { id: "santor-vault", gravity: 1.05 };
const goal = (label, all) => ({ label, all });
const coach = (focus, name) => ({ id: `${focus}-coach`, focus, name });
const john = (introduction, characters, success, failure) => ({
  introduction,
  characters,
  results: {
    none: failure,
    bronze: success,
    silver: `${success} Silver confirmed.`,
    gold: `${success} GOLD. Please remain administratively calm.`,
  },
});

export const CHAPTER_LEVELS = [
  {
    id: "showboating-101",
    name: "SHOWBOATING 101",
    estimatedMinutes: 3,
    description:
      "Turn one stunt into a routine. A flip, recovered No Hands and a late recovery can make three different tricks.",
    objective:
      "Build unique trick variety, then land Clean or Scrappy. Repeating a flip does not add another unique trick.",
    arena,
    condition: null,
    optionalObjective: "two-tricks",
    upgradeReward: true,
    modifier: coach("tricks", "Combo Workshop"),
    bronze: goal("Perform 1 recognized trick.", { uniqueTricks: 1 }),
    silver: goal("Perform 2 unique tricks and land successfully.", {
      uniqueTricks: 2,
      successfulLanding: true,
    }),
    gold: goal("Perform 3 unique tricks and land successfully.", {
      uniqueTricks: 3,
      successfulLanding: true,
    }),
    santorMedal: goal("3 unique tricks, a Clean landing and Perfect Brace.", {
      uniqueTricks: 3,
      controlledLanding: true,
      perfectBrace: true,
    }),
    prerequisites: ["commit-to-the-bit"],
    john: john(
      "Three tricks. One landing. We are counting both parts.",
      {
        jake: "Jake has prepared a three-part routine. The cart has requested slower delivery.",
        brandon:
          "Brandon, variety is your strongest argument. Please supply a conclusion.",
        owen: "Owen can build rotation quickly. He still needs to stop building it.",
      },
      "The routine has landed.",
      "The audience liked the idea. The ground requires a complete routine.",
    ),
  },
  {
    id: "cross-examination",
    name: "CROSS EXAMINATION",
    estimatedMinutes: 2,
    description:
      "The arrow tells the truth: a steady crosswind pushes right throughout flight. Choose your launch speed for the marked 30–45 m target.",
    objective:
      "Land inside the green target zone with the rider still attached. A Good takeoff can help avoid overshooting.",
    arena,
    condition: "crosswind",
    optionalObjective: "landing-zone",
    upgradeReward: false,
    modifier: coach("wind", "Wind & Target Coach"),
    bronze: goal("Take off and complete a landing.", { completedJump: true }),
    silver: goal("Land inside the 30–45 m target zone.", { targetHit: true }),
    gold: goal("Hit the target zone with the rider attached at finish.", {
      targetHit: true,
      riderAttached: true,
    }),
    santorMedal: goal(
      "Hit the target with a Clean landing and Perfect Brace.",
      { targetHit: true, controlledLanding: true, perfectBrace: true },
    ),
    prerequisites: ["showboating-101"],
    john: john(
      "The wind is a witness. It will only answer right.",
      {
        jake: "Jake remains composed. The atmosphere has filed a contrary opinion.",
        brandon:
          "Brandon, cross-examine the arrow. Its testimony is remarkably consistent.",
        owen: "Owen, this is wind. Replacing the indicator will not repair it.",
      },
      "Contact entered into evidence.",
      "The hearing requires the cart to leave the ramp.",
    ),
  },
  {
    id: "fragile-cargo",
    name: "FRAGILE CARGO",
    estimatedMinutes: 2,
    description:
      "Deliver the boxed ceremonial mug. Its elastic safety cord releases after sustained inversion or a severe crash. A lost mug stays lost for this attempt.",
    objective:
      "Keep the cart near level and brace the landing. Gold requires a Clean landing with the physical cargo still secured.",
    arena: {
      ...arena,
      cargo: {
        label: "SANTOR'S MUG",
        size: 22,
        mass: 0.14,
        stiffness: 0.55,
        damping: 0.12,
        releaseAngle: 1.35,
        releaseSeconds: 0.18,
      },
    },
    condition: null,
    optionalObjective: "attached-landing",
    upgradeReward: true,
    modifier: coach("cargo", "Fragile Delivery"),
    bronze: goal("Complete the jump, cargo or no cargo.", {
      completedJump: true,
    }),
    silver: goal("Complete the jump without losing the cargo.", {
      completedJump: true,
      cargoRetained: true,
    }),
    gold: goal("Land Clean without losing the cargo.", {
      controlledLanding: true,
      cargoRetained: true,
    }),
    santorMedal: goal(
      "Keep the cargo, land Clean and earn Perfect takeoff + Perfect Brace.",
      {
        cargoRetained: true,
        controlledLanding: true,
        perfectTakeoff: true,
        perfectBrace: true,
      },
    ),
    prerequisites: ["cross-examination"],
    john: john(
      "That is my ceremonial mug. Its replacement is also my ceremonial mug.",
      {
        jake: "Jake, carry this like an ice cream cone with better risk assessment.",
        brandon:
          "Brandon, the mug is not a metaphor. Please return the actual mug.",
        owen: "Owen inspected the cord. Procurement inspected the price.",
      },
      "Delivery attempt logged. Check the cargo receipt.",
      "The mug has not completed its commute.",
    ),
  },
  {
    id: "the-mapleton-run",
    name: "THE MAPLETON RUN",
    estimatedMinutes: 2,
    description:
      "Brandon's Mapleton Road has three shallow, visible concrete repairs. Keep a measured rhythm over the bumps; frantic pushing adds wobble.",
    objective:
      "Cross the uneven runway with deliberate pushes, then recover for a controlled landing.",
    arena: {
      ...arena,
      bumps: [
        { x: 380, width: 100, height: 5 },
        { x: 530, width: 110, height: 7 },
        { x: 665, width: 90, height: 5 },
      ],
    },
    condition: null,
    optionalObjective: "no-miss",
    upgradeReward: false,
    modifier: coach("runway", "Mapleton Rhythm Coach"),
    bronze: goal("Reach the ramp and finish.", { reachedRamp: true }),
    silver: goal(
      "Complete the jump with 2 Good-or-better pushes and no Misses.",
      { completedJump: true, goodPushes: 2, noMiss: true },
    ),
    gold: goal(
      "Use 2 Good-or-better pushes, no Misses, and land successfully.",
      { goodPushes: 2, noMiss: true, successfulLanding: true },
    ),
    santorMedal: goal(
      "No Misses, Perfect takeoff, Perfect Brace and a Clean landing.",
      {
        noMiss: true,
        perfectTakeoff: true,
        perfectBrace: true,
        controlledLanding: true,
      },
    ),
    prerequisites: ["fragile-cargo"],
    john: john(
      "Brandon has submitted a poem about Mapleton Road. Every pothole gets a stanza.",
      {
        jake: "Jake is delivering Brandon's road poem without visible enthusiasm.",
        brandon:
          "Brandon returns to Mapleton Road. The road declines to apologize.",
        owen: "Owen can explain Brandon's road repairs. He cannot explain their approval.",
      },
      "Brandon's road has accepted your submission.",
      "Mapleton Road requests a revised draft with forward motion.",
    ),
  },
  {
    id: "ice-cream-weather",
    name: "ICE CREAM WEATHER",
    estimatedMinutes: 2,
    description:
      "Reduced runway traction and landing friction make the whole arena slippery. Jake has been asked to supervise cold resistance. His paperwork remains under review.",
    objective:
      "Use the visible icy surface, stay level and save your brace for first contact. Sliding after a Clean landing is allowed.",
    arena,
    condition: "icy-ramp",
    optionalObjective: "perfect-brace",
    upgradeReward: true,
    modifier: coach("ice", "Ice & Brace Coach"),
    bronze: goal("Take off and complete a landing.", { completedJump: true }),
    silver: goal("Land successfully with Good Brace or better.", {
      successfulLanding: true,
      goodBrace: true,
    }),
    gold: goal("Land Clean with Perfect Brace.", {
      controlledLanding: true,
      perfectBrace: true,
    }),
    santorMedal: goal(
      "Perfect takeoff, Perfect Brace, Clean landing and no Missed pushes.",
      {
        perfectTakeoff: true,
        perfectBrace: true,
        controlledLanding: true,
        noMiss: true,
      },
    ),
    prerequisites: ["the-mapleton-run"],
    john: john(
      "Jake's cold-resistance assessment has arrived. The envelope is empty.",
      {
        jake: "Jake, this time the ice cream is the weather. Protect the fingers.",
        brandon:
          "Brandon, describe the ice after landing. Jake has already provided the case study.",
        owen: "Owen, Jake says the surface is cold. Please consider that the entire briefing.",
      },
      "The landing survived cold review.",
      "Jake advises against blaming the ice cream.",
    ),
  },
  {
    id: "siemens-certified",
    name: "SIEMENS CERTIFIED",
    estimatedMinutes: 2,
    description:
      "Owen's speed inspection includes the announced Wrate Issue: one mild forward pulse, 0.65 seconds after launch. Counter-steer when the warning fires.",
    objective:
      "Build speed with Perfect pushes, recover from the signposted mechanical pulse, and land attached.",
    arena,
    condition: "wrate-issue",
    optionalObjective: "distance-35",
    upgradeReward: true,
    modifier: coach("speed", "Speed & Recovery Coach"),
    bronze: goal("Complete the jump after the mechanical pulse.", {
      completedJump: true,
      mechanicalFailure: true,
    }),
    silver: goal("Recover from the pulse and land successfully.", {
      mechanicalRecovered: true,
    }),
    gold: goal(
      "Reach maximum runway speed, recover and land successfully with the rider attached.",
      {
        runwayCapReached: true,
        mechanicalRecovered: true,
        riderAttached: true,
      },
    ),
    santorMedal: goal(
      "Reach maximum runway speed, land Clean after the pulse and earn Perfect Brace.",
      {
        runwayCapReached: true,
        mechanicalRecovered: true,
        controlledLanding: true,
        perfectBrace: true,
      },
    ),
    prerequisites: ["ice-cream-weather"],
    john: john(
      "Owen has certified the speed. The reliability certificate is making a noise.",
      {
        jake: "Jake, the warning is scheduled. Your indifference should remain unscheduled.",
        brandon:
          "Brandon may appeal the warning in writing. Counter-steering is faster.",
        owen: "Owen, this is within Wrate tolerances. Please demonstrate the recovery part.",
      },
      "Recovery entered in the service record.",
      "Certification requires an actual flight through the scheduled fault.",
    ),
  },
  {
    id: "the-santor-gauntlet",
    name: "THE SANTOR GAUNTLET",
    estimatedMinutes: 4,
    description:
      "Three short jumps. Three announced conditions. Each result is banked; all three ordinary attempt totals add to one Gauntlet score. Leaving or refreshing restarts the three-heat sequence.",
    objective:
      "Use rhythm, takeoff, tricks and bracing across all three heats. Complete Bronze to finish the campaign and unlock the harder Gauntlet.",
    arena,
    modifier: coach("gauntlet", "Santor Final Examination"),
    upgradeReward: false,
    stages: [
      {
        name: "SPEED",
        condition: "boost-strip",
        optionalObjective: "no-miss",
        introduction:
          "Heat one. Find your rhythm. This remains a supervised sporting event.",
      },
      {
        name: "CONTROL",
        condition: "icy-ramp",
        optionalObjective: "perfect-brace",
        introduction:
          "Heat two. Brace on ice. SUPERVISION IS NOW A THEORETICAL CONCEPT.",
      },
      {
        name: "COMMITMENT",
        condition: "wrate-issue",
        optionalObjective: "two-tricks",
        introduction:
          "FINAL HEAT. THE WARNING IS SCHEDULED. MY RESPONSE IS NOT.",
      },
    ],
    bronze: goal(
      "Complete all 3 jumps and bank at least 900 combined points.",
      { completedJumps: 3, combinedScore: 900 },
    ),
    silver: goal(
      "Bank 1,800 points, 2 successful landings, 1 Good-or-better Brace and 1 unique trick.",
      {
        combinedScore: 1800,
        successfulLandings: 2,
        goodBraces: 1,
        uniqueTricks: 1,
      },
    ),
    gold: goal(
      "Bank 2,400 points, 3 successful landings, 2 Good-or-better Braces and 2 unique tricks.",
      {
        combinedScore: 2400,
        successfulLandings: 3,
        goodBraces: 2,
        uniqueTricks: 2,
      },
    ),
    santorMedal: goal(
      "3,200 combined points, 3 Clean landings and 3 Perfect Braces.",
      { combinedScore: 3200, controlledLandings: 3, perfectBraces: 3 },
    ),
    prerequisites: ["siemens-certified"],
    john: john(
      "This is the final examination. I have misplaced the marking scheme.",
      {
        jake: "Jake has three attempts to demonstrate a measurable reaction.",
        brandon:
          "Brandon, three acts. A successful conclusion is permitted this time.",
        owen: "Owen's final service includes three jumps and no scheduled wheel replacement.",
      },
      "CAMPAIGN COMPLETE. THE HARDER GAUNTLET HAS ESCAPED CONTAINMENT.",
      "All three scores are banked. Review the requirements, then demand a rematch.",
    ),
  },
];

export const HARD_GAUNTLET_DATA = {
  ...CHAPTER_LEVELS.at(-1),
  id: "santor-gauntlet-hard",
  name: "SANTOR GAUNTLET: OVERTIME",
  bonus: true,
  estimatedMinutes: 4,
  description:
    "An optional harder three-heat rematch: heavy cart, ice, then the Wrate Issue. Higher combined-score and landing requirements. Your campaign medals remain intact.",
  objective:
    "Bank the three scores with fewer mistakes. Overtime is optional and is not needed for campaign completion achievements.",
  stages: [
    {
      name: "HEAVY DUTY",
      condition: "heavy-cart",
      optionalObjective: "front-flip",
      introduction:
        "Overtime one. The cart is heavier. So are my expectations.",
    },
    {
      name: "COLD REVIEW",
      condition: "icy-ramp",
      optionalObjective: "perfect-brace",
      introduction:
        "Overtime two. ICE AGAIN. PROCUREMENT HAS ONLY FIVE CONDITIONS.",
    },
    {
      name: "FINAL NOTICE",
      condition: "wrate-issue",
      optionalObjective: "two-tricks",
      introduction:
        "FINAL NOTICE. LAND THE CART. I HAVE BECOME THE SCOREBOARD.",
    },
  ],
  bronze: goal(
    "Complete 3 jumps, land successfully twice and bank 1,800 points.",
    { completedJumps: 3, successfulLandings: 2, combinedScore: 1800 },
  ),
  silver: goal(
    "3 successful landings, 2 unique tricks and 2,800 combined points.",
    { successfulLandings: 3, uniqueTricks: 2, combinedScore: 2800 },
  ),
  gold: goal(
    "3 successful landings, 3 Perfect Braces, 3 unique tricks and 3,600 points.",
    {
      successfulLandings: 3,
      perfectBraces: 3,
      uniqueTricks: 3,
      combinedScore: 3600,
    },
  ),
  santorMedal: goal(
    "3,900 points, 3 Clean landings, 3 Perfect takeoffs and 3 Perfect Braces.",
    {
      combinedScore: 3900,
      controlledLandings: 3,
      perfectTakeoffs: 3,
      perfectBraces: 3,
    },
  ),
  prerequisites: ["the-santor-gauntlet"],
  john: john(
    "The harder Gauntlet is open. I was not consulted.",
    {
      jake: "Jake has returned for overtime. The expression remains on its lunch break.",
      brandon:
        "Brandon has requested an epilogue. It comes with three impact assessments.",
      owen: "Owen calls this preventive maintenance. I CALL IT OVERTIME.",
    },
    "OVERTIME COMPLETE. SOMEBODY SWITCH ME OFF.",
    "Overtime denied. The three-heat ledger will accept another application.",
  ),
};
