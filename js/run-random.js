// Reproducible choices, independent of frame rate and all physics input.
export function hashSeed(text) {
  let value = 2166136261;
  for (const char of String(text))
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
export function seededShuffle(values, seed, label = "") {
  let state = (seed ^ hashSeed(label)) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
let fallbackSerial = 0;
export function newRunSeed() {
  try {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return hashSeed(`${Date.now()}:${++fallbackSerial}`);
  }
}
