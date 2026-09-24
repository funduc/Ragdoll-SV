// Media lifecycle double. Does not claim audible/browser decoding verification.
export function musicDouble(Target = EventTarget, EventType = Event) {
  return class Audio extends Target {
    static instances = [];
    constructor() {
      super();
      this.constructor.instances.push(this);
      this.paused = true;
      this.currentTime = 0;
      this.duration = 100;
      this.volume = 1;
      this.playCalls = 0;
      this.assignments = [];
    }
    set src(value) {
      this._src = value;
      this.currentTime = 0;
      this.assignments.push(value);
    }
    get src() {
      return this._src || "";
    }
    play() {
      this.playCalls++;
      if (this.rejection) return Promise.reject(this.rejection);
      this.paused = false;
      return this.deferred || Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    removeAttribute(name) {
      if (name === "src") this._src = "";
    }
    load() {
      this.loadedAfterClear = true;
    }
    advance(seconds) {
      if (this.paused) return;
      this.currentTime += seconds;
      if (this.loop) this.currentTime %= this.duration;
      else if (this.currentTime >= this.duration) {
        this.paused = true;
        this.dispatchEvent(new EventType("ended"));
      }
    }
    fail() {
      this.dispatchEvent(new EventType("error"));
    }
  };
}
