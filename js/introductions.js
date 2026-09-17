export const INTRO_DURATION_MS = 5000;

// Uses the existing RAF clock, never an attempt timer. Dismissal only reveals
// Ready: the player's separate confirmation is still required to start physics.
export class Introduction {
  constructor() {
    this.deadline = null;
  }
  get active() {
    return this.deadline !== null;
  }
  start(now) {
    this.deadline = now + INTRO_DURATION_MS;
  }
  remaining(now) {
    return this.active ? Math.max(0, this.deadline - now) : 0;
  }
  expired(now) {
    return this.active && now >= this.deadline;
  }
  clear() {
    this.deadline = null;
  }
}
