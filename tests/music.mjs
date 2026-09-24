import assert from "node:assert/strict";
import {
  AudioPreferences,
  AUDIO_SETTINGS_KEY,
  MUTE_KEY,
} from "../js/audio-preferences.js";
import { MusicPlayer, MusicDirector } from "../js/music.js";
import { MUSIC_TRACKS, MUSIC_MASTER_GAIN } from "../js/music-config.js";
import { musicDouble } from "./fake-music.mjs";
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
function fixture() {
  const data = new Map(),
    writes = [];
  const env = {
    Audio: musicDouble(),
    localStorage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        data.set(key, value);
        writes.push(key);
      },
    },
  };
  const prefs = new AudioPreferences(env),
    music = new MusicPlayer(prefs, { env });
  return { env, data, writes, prefs, music };
}
await check(
  "Music allocates/loads nothing until entry; loops with one streaming element",
  async () => {
    const { env, music } = fixture();
    music.setTrack("menu");
    assert.equal(env.Audio.instances.length, 0);
    music.enable();
    await flush();
    const a = music.media;
    assert.equal(a.loop, true);
    assert.equal(a.paused, false);
    a.advance(205);
    assert.equal(a.currentTime, 5);
    music.enable();
    music.setTrack("menu");
    assert.equal(env.Audio.instances.length, 1);
    assert.equal(a.playCalls, 1);
    music.destroy();
    assert.equal(a.src, "");
    assert.equal(a.paused, true);
  },
);
await check(
  "New levels avoid the last track; retries/replay retain their selection; all Gauntlet heats use championship",
  () => {
    const d = new MusicDirector(() => 0),
      run = {
        kind: "campaign",
        state: "ready",
        active: false,
        current: { id: "jake" },
        level: { id: "one" },
        runs: { run: { seed: 42 } },
      };
    assert.equal(d.scene(run), "menu");
    run.active = true;
    run.state = "active-attempt";
    const first = d.scene(run);
    run.active = false;
    run.state = "ready";
    assert.equal(d.scene(run), first);
    run.state = "campaign-map";
    assert.equal(d.scene(run), "menu");
    run.active = true;
    run.state = "active-attempt";
    assert.equal(d.scene(run), first);
    run.level = { id: "two" };
    const second = d.scene(run);
    assert.notEqual(second, first);
    run.level = { id: "gauntlet", stages: [1, 2, 3] };
    for (let i = 0; i < 3; i++) {
      run.active = true;
      run.state = "active-attempt";
      assert.equal(d.scene(run), "championship");
      run.active = false;
      run.state = "ready";
      assert.equal(d.scene(run), "championship");
    }
    run.level = { id: "three" };
    run.active = true;
    run.state = "active-attempt";
    assert.notEqual(d.scene(run), second);
    assert.equal(
      d.scene({ round: "championship", state: "championship-intro" }),
      "championship",
    );
    assert.equal(d.scene({ state: "title" }), "menu");
  },
);
await check(
  "Same-level retries preserve playback time; switching to menu stops the old source",
  async () => {
    const { music } = fixture();
    music.enable();
    await flush();
    music.setTrack("gameplay1");
    await flush();
    const a = music.media;
    a.advance(12);
    const calls = a.playCalls;
    music.setTrack("gameplay1");
    assert.equal(a.currentTime, 12);
    assert.equal(a.playCalls, calls);
    music.setTrack("menu");
    await flush();
    assert.equal(a.src, MUSIC_TRACKS.menu.src);
    assert.equal(a.currentTime, 0);
    music.destroy();
  },
);
await check(
  "Mute, independent volumes, pause/resume and refresh persist safely without autoplay",
  async () => {
    const { env, prefs, music, writes } = fixture();
    music.enable();
    await flush();
    const a = music.media;
    const before = a.volume;
    prefs.setVolume("effects", 0.2);
    assert.equal(a.volume, before);
    prefs.setVolume("music", 0.8);
    assert.ok(a.volume > before);
    prefs.setMuted(true);
    assert.equal(a.paused, true);
    assert.equal(a.volume, 0);
    prefs.setMuted(false);
    await flush();
    assert.equal(a.paused, false);
    a.advance(15);
    music.setPaused(true);
    assert.equal(a.paused, true);
    prefs.setMuted(true);
    music.setPaused(false);
    assert.equal(a.paused, true);
    prefs.setMuted(false);
    await flush();
    assert.equal(a.currentTime, 15);
    const count = writes.length;
    for (let i = 0; i < 100; i++) music.sync();
    assert.equal(writes.length, count);
    const restored = new AudioPreferences(env);
    assert.equal(restored.music, 0.8);
    assert.equal(restored.effects, 0.2);
    const fresh = new MusicPlayer(restored, { env });
    fresh.setTrack("menu");
    assert.equal(fresh.media, undefined);
    music.destroy();
    fresh.destroy();
  },
);
await check(
  "Missing files/rejected playback are contained; no request storm or stale-promise interference",
  async () => {
    const { music } = fixture();
    music.enable();
    await flush();
    const a = music.media;
    a.fail();
    const calls = a.playCalls;
    for (let i = 0; i < 50; i++) music.sync();
    assert.equal(a.playCalls, calls);
    music.setTrack("gameplay1");
    await flush();
    assert.equal(a.paused, false);
    a.rejection = Object.assign(new Error("blocked"), {
      name: "NotAllowedError",
    });
    music.setTrack("gameplay2");
    await flush();
    assert.equal(music.blocked, true);
    const blockedCalls = a.playCalls;
    music.sync();
    assert.equal(a.playCalls, blockedCalls);
    a.rejection = null;
    music.retryFromGesture();
    await flush();
    assert.equal(a.paused, false);
    let reject;
    a.deferred = new Promise((_, r) => (reject = r));
    music.setTrack("championship");
    a.deferred = null;
    music.setTrack("gameplay1");
    reject(new Error("old load failed"));
    await flush();
    assert.equal(music.failed.has("gameplay1"), false);
    music.destroy();
    a.fail();
  },
);
await check(
  "Web Audio music gain is separate, starts silent, stays below unity and disconnects",
  async () => {
    const { env, prefs } = fixture();
    const nodes = [];
    const ctx = {
      state: "running",
      currentTime: 0,
      destination: {},
      createGain() {
        const n = {
          gain: {
            setValueAtTime(v) {
              this.value = v;
            },
            setTargetAtTime(v) {
              this.value = v;
            },
          },
          connect() {},
          disconnect() {
            this.disconnected = true;
          },
        };
        nodes.push(n);
        return n;
      },
      createMediaElementSource() {
        const n = {
          connect() {},
          disconnect() {
            this.disconnected = true;
          },
        };
        nodes.push(n);
        return n;
      },
    };
    const m = new MusicPlayer(prefs, { env, getContext: () => ctx });
    m.enable();
    await flush();
    prefs.setVolume("music", 1);
    for (const id of Object.keys(MUSIC_TRACKS)) {
      m.setTrack(id);
      await flush();
      assert.ok(m.gain.gain.value <= 1);
      assert.equal(
        m.gain.gain.value,
        MUSIC_MASTER_GAIN * 10 ** (MUSIC_TRACKS[id].gainDb / 20),
      );
    }
    prefs.setMuted(true);
    assert.equal(m.gain.gain.value, 0);
    m.destroy();
    assert.ok(nodes.every((n) => n.disconnected));
  },
);
await check(
  "Corrupt/denied preferences use defaults and preserve unrelated campaign data",
  () => {
    const { env, data } = fixture();
    data.set(AUDIO_SETTINGS_KEY, "not-json");
    data.set(MUTE_KEY, "true");
    data.set("santor-vault:campaign", "keep");
    const p = new AudioPreferences(env);
    assert.equal(p.music, 0.45);
    assert.equal(p.muted, true);
    p.setVolume("music", 0.3);
    assert.equal(data.get("santor-vault:campaign"), "keep");
    const denied = {
      get localStorage() {
        throw Error("denied");
      },
    };
    const q = new AudioPreferences(denied);
    q.setMuted(true);
    q.setVolume("effects", 0.1);
    assert.equal(q.effects, 0.1);
  },
);
await check(
  "Rapid mute/unmute during a pending load cannot strand the newer play request",
  async () => {
    const { music, prefs } = fixture();
    music.enable();
    await flush();
    const a = music.media;
    let reject;
    a.deferred = new Promise((_, r) => (reject = r));
    music.setTrack("gameplay1");
    prefs.setMuted(true);
    a.deferred = null;
    prefs.setMuted(false);
    await flush();
    reject(
      Object.assign(new Error("cancelled old request"), { name: "AbortError" }),
    );
    await flush();
    assert.equal(a.paused, false);
    assert.equal(music.pending, false);
    music.destroy();
  },
);
console.log(`${checks} music groups passed.`);
