// Semantic colours shared by Canvas and the CSS properties installed on the cabinet.
const standard = { good: "#b38a35", perfect: "#b4ef4b", bad: "#ff852b", miss: "#d55c42", neutral: "#f8d45e", target: "#b4ef4b", owen: "#b4ef4b" };
const safe = { good: "#0072B2", perfect: "#56B4E9", bad: "#E69F00", miss: "#D55E00", neutral: "#F0E442", target: "#56B4E9", owen: "#CC79A7" };
let enabled = false;
export const palette = () => enabled ? safe : standard;
export function setSheedy(value, root) {
  enabled = Boolean(value);
  if (!root) return;
  root.dataset.sheedy = enabled ? "on" : "off";
  for (const [key, colour] of Object.entries(palette())) {
    if (enabled) root.style.setProperty(`--cue-${key}`, colour);
    else root.style.removeProperty(`--cue-${key}`);
  }
}
export const characterColour = character => character.id === "owen" ? palette().owen : character.primaryColor;
export function gradeCue(grade) {
  return grade ? `${grade}${/^(perfect(?: brace| sync)?|clean|good(?: brace| sync)?|braced)$/i.test(grade) ? " ✓" : /miss|early|late|crash/i.test(grade) ? " ✕" : ""}` : "";
}

export const cueColour = (role, original) => enabled ? safe[role] : original;
export const characterCSS = character => character.id === "owen" ? "var(--cue-owen, #b4ef4b)" : character.primaryColor;
