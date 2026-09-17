// Only an explicit confirmation dismisses a biography. Ready still requires
// a separate confirmation before physics starts.
export class Introduction {
  constructor() {
    this.active = false;
  }
  start() {
    this.active = true;
  }
  clear() {
    this.active = false;
  }
}
