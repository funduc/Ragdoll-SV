export const GENERAL_CAPTIONS = Object.freeze({
  introduction: [
    "Welcome to The Santor Vault. One jump each; make it count.",
    "The field is ready. Our first concern is distance.",
  ],
  launch: [
    "A clean departure. Watch the landing.",
    "The cart is airborne. Judges, eyes up.",
  ],
  longJump: [
    "Past thirty metres. A strong jump.",
    "That is useful distance on the board.",
  ],
  weakJump: [
    "A short attempt. The score still counts.",
    "A modest distance; the judges have their numbers.",
  ],
  rotation: [
    "Rotation registered. Find the wheels.",
    "Style points are available; so is the floor.",
  ],
  goodLanding: [
    "Wheels down. A clean landing for the judges.",
    "A controlled landing. That earns its bonus.",
  ],
  crash: [
    "Physics has reviewed the appeal and denied it.",
    "That landing has created several administrative questions.",
  ],
  elimination: [
    "ONE IS OUT. I HAVE LOST CONTROL OF THE CLIPBOARD.",
    "THE CUT IS FINAL. PLEASE STOP NEGOTIATING WITH GRAVITY.",
  ],
  championship: [
    "TWO FINALISTS. ONE CART. MY NOTES ARE JUST EXCLAMATION MARKS.",
    "THE FINAL! ALL PREVIOUS POINTS HAVE LEFT THE BUILDING!",
  ],
  victory: [
    "{name} WINS! THIS WILL BE DISCUSSED WITHOUT CONTEXT FOR YEARS!",
    "{name} TAKES IT! SOMEONE FRAME THE RECEIPT!",
  ],
  tie: [
    "TWO CHAMPIONS! THE CART HAS ENTERED JOINT CUSTODY!",
    "A SHARED VICTORY! I NEED TWO CLIPBOARDS!",
  ],
  wrateWarning: [
    "Wrate warning received. All parts remain accounted for.",
    "The warning light is doing its best work.",
  ],
});
const FINAL_CAPTIONS = {
  introduction: [
    "{name}, THE FINAL AWAITS. THE RAMP HAS RETAINED COUNSEL!",
    "{name}, FIVE SECONDS TO LOOK LIKE THIS WAS PLANNED!",
  ],
  launch: [
    "FINAL FLIGHT! NOBODY ASK THE CART FOR ITS QUALIFICATIONS!",
    "WE HAVE LIFTOFF AND NO APPROVED LANDING PAPERWORK!",
  ],
  longJump: [
    "THIRTY METRES! THE MEASURING TAPE HAS FILED A COMPLAINT!",
    "THAT DISTANCE HAS ESCAPED MY SPREADSHEET!",
  ],
  weakJump: [
    "A SHORT FINAL JUMP! MY EXPECTATIONS NEED A MOMENT!",
    "THE DISTANCE IS SMALL. THE ADMINISTRATION IS ENORMOUS!",
  ],
  rotation: [
    "THE FINAL IS TURNING INTO A LITERAL TURNING POINT!",
    "COUNT THE ROTATIONS! I HAVE RUN OUT OF FINGERS!",
  ],
  goodLanding: [
    "WHEELS DOWN! SOMEONE VERIFY THIS IS LEGAL!",
    "A CLEAN FINAL LANDING! I WAS NOT PREPARED FOR COMPETENCE!",
  ],
  crash: [
    "THE FINAL HAS BECOME AN INCIDENT REPORT!",
    "THAT LANDING WILL REQUIRE ITS OWN PRESS CONFERENCE!",
  ],
};

export class Commentator {
  constructor() {
    this.lastLine = "";
    this.cursors = new Map();
    this.resetAttempt();
  }
  resetAttempt() {
    this.pending = [];
    this.nextAt = 0;
  }
  pick(type, character = null, round = "qualifying") {
    const general =
      (round === "championship" && FINAL_CAPTIONS[type]) ||
      GENERAL_CAPTIONS[type] ||
      [];
    const personal = character?.commentary?.[type] || [];
    const pool =
      round === "championship" && type !== "victory"
        ? [...general, ...personal]
        : [...personal, ...general];
    if (!pool.length) return null;
    const key = `${round}:${type}:${character?.id || "field"}`;
    let cursor = this.cursors.get(key) || 0;
    for (let i = 0; i < pool.length; i++) {
      const line = pool[cursor++ % pool.length].replaceAll(
        "{name}",
        character?.name || "THE FIELD",
      );
      if (line !== this.lastLine) {
        this.cursors.set(key, cursor);
        this.lastLine = line;
        return line;
      }
    }
    return null;
  }
  enqueue(type, character, round, time) {
    if (this.pending.some((item) => item.type === type)) return;
    if (type === "crash") {
      this.pending = [];
      this.nextAt = time;
    }
    this.pending.push({ type, character, round });
    if (this.pending.length > 3) this.pending.shift();
  }
  tick(time) {
    if (time < this.nextAt || !this.pending.length) return null;
    const event = this.pending.shift();
    this.nextAt = time + 1.6;
    return this.pick(event.type, event.character, event.round);
  }
}
