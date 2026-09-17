// A small scheduling/lifecycle double, not an audible Web Audio implementation.
import assert from "node:assert/strict";
class Param {
  setValueAtTime(value, time) {
    assert.ok(Number.isFinite(value) && Number.isFinite(time));
  }
  linearRampToValueAtTime(value, time) {
    this.setValueAtTime(value, time);
  }
  exponentialRampToValueAtTime(value, time) {
    assert.ok(value > 0);
    this.setValueAtTime(value, time);
  }
}
export function audioDouble(clock = () => 0) {
  return class AudioContext {
    static instances = [];
    constructor() {
      this.constructor.instances.push(this);
      this.state = "running";
      this.sampleRate = 8000;
      this.destination = {};
      this.connected = new Set();
      this.sources = new Set();
      this.createdSources = 0;
      this.resumeCount = 0;
    }
    get currentTime() {
      return clock();
    }
    node(source = false) {
      const context = this;
      const node = {
        frequency: new Param(),
        Q: new Param(),
        gain: new Param(),
        connect() {
          context.connected.add(this);
        },
        disconnect() {
          context.connected.delete(this);
        },
        start(time) {
          assert.ok(Number.isFinite(time));
          context.sources.add(this);
        },
        stop(time = context.currentTime) {
          this.stopTime = time;
        },
      };
      if (source) this.createdSources++;
      return node;
    }
    createGain() {
      return this.node();
    }
    createOscillator() {
      return this.node(true);
    }
    createBufferSource() {
      return this.node(true);
    }
    createBiquadFilter() {
      return this.node();
    }
    createBuffer(channels, length) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
    resume() {
      this.resumeCount++;
      this.state = "running";
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
      this.tick(Infinity);
      return Promise.resolve();
    }
    tick(time = this.currentTime) {
      for (const node of this.sources) {
        if (node.stopTime <= time) {
          this.sources.delete(node);
          node.onended?.();
        }
      }
    }
  };
}
