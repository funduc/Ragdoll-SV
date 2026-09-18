// Vault Run content and rules. All three lessons use the existing Vault arena.
// Coaching modifiers only add live guidance; they never change scoring or input.
// Thresholds use facts from a finished attempt, not the displayed total score.
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const arena = { id: "santor-vault", gravity: 1.05 };
export const MEDALS = freeze(["No medal", "Bronze", "Silver", "Gold"]);
export const LEVELS = freeze([
  {
    id: "orientation-day",
    name: "ORIENTATION DAY",
    description:
      "Find the rhythm, then spend one well-timed push at the ramp edge.",
    objective: "Teach rhythmic acceleration and takeoff timing.",
    arena,
    modifier: { id: "rhythm-coach", name: "Rhythm Coach", focus: "push" },
    bronze: {
      label: "Reach the ramp and finish the attempt.",
      all: { reachedRamp: true },
    },
    silver: {
      label: "Finish with at least 2 Good-or-better pushes.",
      all: { reachedRamp: true, goodPushes: 2 },
    },
    gold: {
      label: "Finish with a Perfect takeoff.",
      all: { reachedRamp: true, perfectTakeoff: true },
    },
    santorMedal: null,
    prerequisites: [],
    john: {
      introduction: "Welcome to orientation. Release the key between pushes.",
      results: {
        none: "The ramp is still accepting applications.",
        bronze: "You found the ramp. Wheels Down is open.",
        silver: "Two good pushes. A rhythm section with wheels.",
        gold: "Perfect takeoff. Orientation has exceeded expectations.",
      },
    },
  },
  {
    id: "wheels-down",
    name: "WHEELS DOWN",
    description:
      "Rotate toward level, then tap Brace shortly before first contact.",
    objective:
      "Teach landing brace timing while keeping the wheels underneath you.",
    arena,
    modifier: { id: "brace-coach", name: "Brace Coach", focus: "brace" },
    bronze: {
      label: "Take off and complete a landing. Crashes count.",
      all: { completedJump: true },
    },
    silver: {
      label: "Complete the jump with a Good Brace or better.",
      all: { completedJump: true, goodBrace: true },
    },
    gold: {
      label: "Earn Perfect Brace and a Clean, controlled landing.",
      all: { completedJump: true, perfectBrace: true, controlledLanding: true },
    },
    santorMedal: null,
    prerequisites: ["orientation-day"],
    john: {
      introduction:
        "Wheels down. Brace near contact. These are separate instructions.",
      results: {
        none: "The landing lesson requires an actual landing.",
        bronze: "Contact confirmed. Commit to the Bit is open.",
        silver: "That brace had useful timing. Please repeat it.",
        gold: "Perfect Brace. Clean landing. The paperwork is suspiciously tidy.",
      },
    },
  },
  {
    id: "commit-to-the-bit",
    name: "COMMIT TO THE BIT",
    description:
      "Commit to a complete flip or controlled flight. Variety earns Gold.",
    objective: "Recognize a trick, build variety, and bring the cart home.",
    arena,
    modifier: { id: "trick-coach", name: "Trick Coach", focus: "tricks" },
    bronze: {
      label: "Finish with at least 1 recognized trick.",
      all: { uniqueTricks: 1 },
    },
    silver: {
      label: "Perform 1 trick and land successfully (Clean or Scrappy).",
      all: { uniqueTricks: 1, successfulLanding: true },
    },
    gold: {
      label: "Perform 2 different tricks and land successfully.",
      all: { uniqueTricks: 2, successfulLanding: true },
    },
    santorMedal: null,
    prerequisites: ["wheels-down"],
    john: {
      introduction:
        "Commit to the bit. Then remember that the bit has to land.",
      results: {
        none: "A suggestion of a flip is not a complete flip.",
        bronze:
          "A recognized trick. Your Vault Run has reached the final stamp.",
        silver: "Style, followed by a landing. An ambitious combination.",
        gold: "Two different tricks. Successful landing. THE VAULT HAS SEEN ENOUGH.",
      },
    },
  },
]);
export const levelById = (id) => LEVELS.find((level) => level.id === id);

// Numeric conditions mean "at least"; boolean conditions require an exact match.
export function meetsThreshold(threshold, facts) {
  return (
    Boolean(threshold?.all) &&
    Object.entries(threshold.all).every(([key, value]) =>
      typeof value === "number"
        ? Number.isFinite(facts[key]) && facts[key] >= value
        : facts[key] === value,
    )
  );
}
export function evaluateMedal(level, facts) {
  if (!facts.finished || facts.invalid) return { medal: 0, santor: false };
  let medal = 0;
  for (const [index, name] of ["bronze", "silver", "gold"].entries()) {
    if (meetsThreshold(level[name], facts)) medal = index + 1;
  }
  return {
    medal,
    santor: medal > 0 && meetsThreshold(level.santorMedal, facts),
  };
}
