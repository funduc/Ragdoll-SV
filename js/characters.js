// Optimized portraits; object position can be adjusted per character without reprocessing.
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const CHARACTERS = freeze([
  {
    id: "jake",
    fullName: "Jake “Hardened Vet” Eckler",
    name: "Jake Eckler",
    nickname: "Hardened Vet",
    primaryColor: "#ff852b",
    portraitPath: "./assets/portraits/jake.webp",
    portraitAvailable: true,
    portraitPosition: "50% 50%",
    fallbackInitials: "JE",
    baseAcceleration: 0.0029,
    rotationControl: 0.9,
    styleMultiplier: 1.0,
    landingStability: 1.15,
    biography:
      "A nonchalant, ironic stand-up comic with terrible gaming skills. An ice-cream cone once gave him finger frostbite. His entirely imaginary Syria comedy tour was booked inside a freezer.",
    associatedPhrase: "Karma, karma, karma, karma, chameleon",
    strength: "Steady hands when the cart is nearly level.",
    weakness: "Once over-rotated, recovery comes slowly.",
    passive: {
      id: "cold-blooded",
      name: "Cold-Blooded",
      description:
        "Slower turns; release rotation near level for gentle settling. Counter-steering is weaker beyond 66°.",
      levelWindow: 0.72,
      levelAssist: 0.000009,
      damping: 0.985,
      recoveryAngle: 1.15,
      recoveryScale: 0.62,
    },
    statistics: [
      ["Comedic Timing", "96"],
      ["Gaming Ability", "11"],
      ["Cold Resistance", "Under Review"],
      ["Unearned Composure", "99"],
    ],
    crashQuote: "Yeah, that seems about right.",
    commentary: {
      introduction: [
        "Jake Eckler: composed, experienced, allegedly holding the correct keys.",
      ],
      launch: ["Jake looks relaxed. This is not proof of competence."],
      rotation: ["The vet is turning. His confidence has declined to comment."],
      goodLanding: ["Jake has landed. He will insist this was ironic."],
      crash: ["Jake's timing remains better on stage."],
      victory: ["Jake wins! Someone check whether he meant to do that."],
    },
  },
  {
    id: "brandon",
    fullName: "Brandon “Wordsmith” Hale",
    name: "Brandon Hale",
    nickname: "Wordsmith",
    primaryColor: "#52cefa",
    portraitPath: "./assets/portraits/brandon.webp",
    portraitAvailable: true,
    portraitPosition: "50% 50%",
    fallbackInitials: "BH",
    baseAcceleration: 0.00285,
    rotationControl: 1.12,
    styleMultiplier: 1.35,
    landingStability: 1.0,
    biography:
      "Mapleton Road's poetic, sharp and witty scholar wears a beret with more coordination than he possesses. A small child once bit him at daycare. Luck has been proofreading him ever since.",
    strength: "Literary flair earns the largest style bonus.",
    weakness: "An occasional small wobble interrupts the sentence.",
    passive: {
      id: "poetic-license",
      name: "Poetic License",
      description:
        "Style ×1.35. A brief, mild airborne wobble can be countered with normal rotation controls.",
      wobbleStart: 0.35,
      wobbleDuration: 0.28,
      wobblePeriod: 1.65,
      wobbleStrength: 0.2,
    },
    statistics: [
      ["Vocabulary", "100"],
      ["Coordination", "8"],
      ["Child Evasion", "4"],
      ["Beret Authority", "94"],
      ["Luck", "Statistically Concerning"],
    ],
    crashQuote: "A predictable tragedy in three acts.",
    crashDescriptions: [
      "Upon the indifferent asphalt, his final stanza misplaced its narrator.",
      "Thus ended the brief republic of balance, its last decree a wheel-shaped elegy.",
      "The pavement received his thesis with the devastating silence of an unread sonnet.",
    ],
    commentary: {
      introduction: [
        "Brandon Hale: a formidable vocabulary approaches a modest ramp.",
      ],
      launch: ["Brandon opens with a soaring clause."],
      rotation: ["A parenthetical spin. Mind the closing bracket."],
      goodLanding: ["Brandon has found both his feet and his conclusion."],
      crash: ["The metaphor has struck the pavement."],
      victory: ["Brandon wins! THE PAVEMENT HAS ACCEPTED HIS MANUSCRIPT!"],
    },
  },
  {
    id: "owen",
    fullName: "Owen “Sparky” Wrate",
    name: "Owen Wrate",
    nickname: "Sparky",
    primaryColor: "#b4ef4b",
    portraitPath: "./assets/portraits/owen.webp",
    portraitAvailable: true,
    portraitPosition: "50% 50%",
    fallbackInitials: "OW",
    baseAcceleration: 0.00305,
    rotationControl: 1.28,
    styleMultiplier: 1.1,
    landingStability: 0.9,
    biography:
      "Kind, funny and hardworking, this car-loving mechanic can fix almost anything. Siemens has his admiration; recurring “Wrate Issues” have his tools. His Temu purchase remains officially censored.",
    strength: "The fastest acceleration in the field.",
    weakness: "A slightly less steady cart; suspicious warning lights.",
    passive: {
      id: "wrate-issues",
      name: "Wrate Issues",
      description:
        "Fastest run-up; slightly lower cart stability. “Wrate Issue Detected” is a cosmetic warning only.",
      cartInertiaScale: 0.94,
    },
    keepsake: { label: "Temu D***o.", kind: "censored" },
    statistics: [
      ["Mechanical Knowledge", "97"],
      ["Work Ethic", "95"],
      ["Component Reliability", "6"],
      ["Siemens Affinity", "100"],
      ["Temu Purchase Judgment", "Classified"],
    ],
    crashQuote: "I can fix that.",
    commentary: {
      introduction: [
        "Owen Wrate: our quickest mechanic, with all components currently accounted for.",
      ],
      launch: ["Owen has diagnosed the cart as airborne."],
      rotation: ["Owen calls that a mobile inspection."],
      goodLanding: ["Owen lands it. The service history survives."],
      crash: ["That failure remains within expected Wrate tolerances."],
      wrateWarning: ["Wrate alert. Owen says it is probably a sensor."],
      victory: ["Owen wins! HE HAS REPAIRED THE CONCEPT OF VICTORY!"],
    },
  },
]);
