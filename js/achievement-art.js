import { ACHIEVEMENT_TIERS } from "./achievement-config.js";

// Small, local arcade pictograms: no fonts, downloads or external sprites.
const GLYPHS = {
  trophy: '<path d="M9 4h14v9a7 7 0 0 1-14 0ZM9 7H4v4l5 5m14-9h5v4l-5 5M16 20v7m-7 1h14"/>',
  notes: '<path d="M10 23V7l16-3v16M10 12l16-3"/><ellipse cx="6" cy="24" rx="4" ry="3"/><ellipse cx="22" cy="21" rx="4" ry="3"/>',
  star: '<path d="m16 2 4 9 10 2-8 7 2 10-8-5-8 5 2-10-8-7 10-2Z"/>',
  orbit: '<path d="M7 9a12 12 0 1 1-2 14M2 4l5 5 7-3"/><path d="m11 19 5-9 5 9Z"/>',
  stamp: '<path d="m5 12 7-8 13 11-7 8Zm0 16h22M12 20l-5 6m14-10 5 5"/>',
  ticket: '<path d="M3 7h26v6a3 3 0 0 0 0 6v6H3v-6a3 3 0 0 0 0-6ZM21 9v3m0 3v3m0 3v2"/>',
  wings: '<path d="m16 25-3-13L2 5v7l7 4-7-1 3 7 8 3m3 0 3-13 11-7v7l-7 4 7-1-3 7-8 3ZM16 5v15"/>',
  target: '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="6"/><path d="M16 1v7m0 16v7M1 16h7m16 0h7"/>',
  parcel: '<path d="m3 9 13-6 13 6v16l-13 6-13-6Zm0 0 13 6 13-6M16 15v16M9 6l13 6v7"/>',
  tools: '<path d="m5 4 5 5 5-5a8 8 0 0 1-9 12L1 25l6 5 10-17m2 6 9 9m-5-6 5-5"/>',
  snow: '<path d="M16 2v28M4 9l24 14M4 23 28 9M11 5l5 4 5-4m-10 22 5-4 5 4M3 15l6-3-1-6m21 11-6 3 1 6M8 26l1-6-6-3m21-11-1 6 6 3"/>',
  face: '<rect x="5" y="5" width="22" height="22" rx="6"/><path d="M9 13h4m6 0h4M10 22h12"/>',
  wind: '<path d="M2 10h21a4 4 0 1 0-4-4M2 16h27M2 22h17a4 4 0 1 1-4 4"/>',
  book: '<path d="M16 8Q8 3 2 5v22q8-2 14 2 6-4 14-2V5q-6-2-14 3v21M6 11l6 2m-6 4 6 2m8-6 6-2m-6 8 6-2"/>',
  mask: '<path d="M4 4q12 6 24 0v11q-1 11-12 15C5 26 4 19 4 4ZM8 12l5 2m6 0 5-2M10 23q6-8 12 0"/>',
  bolt: '<path d="m18 2-14 17h11l-1 12 15-20H18Z"/>',
  icecream: '<path d="m8 17 8 14 8-14ZM5 17q-5-6 3-8a8 8 0 0 1 16 0q8 2 3 8ZM11 21l9 4m-6-7 7 7"/>',
  helmet: '<path d="M3 23h26v5H3ZM5 23V16A11 11 0 0 1 27 16v7M13 5v13m6-13v13"/>',
  cap: '<path d="m2 12 14-8 14 8-14 7Zm6 4v9q8 6 16 0v-9M29 13v13"/>',
  crew: '<circle cx="16" cy="8" r="5"/><circle cx="5" cy="12" r="3"/><circle cx="27" cy="12" r="3"/><path d="M8 29v-9q8-8 16 0v9M1 27v-8l6-2m24 10v-8l-6-2"/>',
  cart: '<path d="M2 6h5l4 17h15l4-13H8M12 15h14m-10-5v12m6-12v12"/><circle cx="13" cy="28" r="2"/><circle cx="25" cy="28" r="2"/>',
  crown: '<path d="m3 7 7 7 6-12 6 12 7-7-3 21H6ZM7 22h18"/>',
  bar: '<path d="M4 30V8m24 22V8M1 10h30m-19 4 4-11 4 11M9 24h14"/>',
  pin: '<path d="M13 10c-8 15-7 20 3 20s11-5 3-20a5 5 0 1 0-6 0ZM11 16h10m-9-4h8"/>',
  wheel: '<circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="4"/><path d="M16 3v9m0 8v9M3 16h9m8 0h9"/>',
  explosion: '<path d="m16 1 3 9 10-5-5 10 7 5-10 1 2 10-8-7-10 5 4-11-8-5 10-2Z"/>',
  laugh: '<path d="M5 4h22v19H16l-8 7v-7H5ZM9 10l4 1m6 0 4-1M10 16q6 9 12 0Z"/>',
  mystery: '<path d="M10 10a6 6 0 1 1 9 5l-3 3v4M16 27v2"/>',
};
export function achievementIcon(item, concealed = false) {
  const color = ACHIEVEMENT_TIERS[item.tier];
  return `<svg class="achievement-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="m16 3 32 0 13 13v32L48 61H16L3 48V16Z" fill="#132330" stroke="${color}" stroke-width="3"/><path d="M9 21V16l7-7h32" fill="none" stroke="#fff" opacity=".4"/><g transform="translate(16 15)" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[concealed ? "mystery" : item.icon]}</g><path d="m27 53 5-3 5 3-5 3Z" fill="${color}"/></svg>`;
}
const hatSVG = hat => hat === "headphones"
  ? '<path d="M-12 1v-6a12 12 0 0 1 24 0v6" fill="none" stroke="#b9a5ff" stroke-width="5"/><path d="M-13-1v9m26-9v9" stroke="#ffe17d" stroke-width="6"/>'
  : hat === "ice-cap" ? '<path d="M-13 0a13 13 0 0 1 26 0Z" fill="#8fe4ed"/><path d="M-14 0h28" stroke="#f1fbff" stroke-width="5"/><circle cy="-15" r="4" fill="#fff"/>'
  : hat === "pin-crown" ? '<path d="m-14 0-2-15 9 6 7-12 7 12 9-6-2 15Z" fill="#ffe17d" stroke="#8e5b27" stroke-width="2"/><path d="M-10-3h20" stroke="#ed5c45" stroke-width="3"/>' : "";
export function podiumRider(color, cosmetics = {}) {
  const pose = cosmetics.pose;
  const arms = pose === "air-guitar" ? "M35 46 19 60 47 65M45 46 60 58 36 66"
    : pose === "salute" ? "M35 46 21 34 35 25M45 46 55 66" : "M35 46 19 25M45 46 61 25";
  return `<svg class="podium-rider" viewBox="0 0 80 112" role="img" aria-label="${pose === "air-guitar" ? "Air guitar" : pose === "salute" ? "Saluting" : "Celebrating"} rider"><path d="M10 104h60v8H10Z" fill="#697d90"/><path d="M35 73 27 102m18-29 9 29" stroke="#607e95" stroke-width="9" stroke-linecap="round"/><path d="M40 44v30" stroke="${color}" stroke-width="17"/><path d="${arms}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/><circle cx="40" cy="28" r="11" fill="#e0c0a2"/><path d="M29 25a11 11 0 0 1 22 0" fill="${color}"/><g transform="translate(40 23)">${hatSVG(cosmetics.hat)}</g>${pose === "air-guitar" ? '<path d="m26 70 26-11" stroke="#ffe17d" stroke-width="4"/>' : ""}</svg>`;
}
export function rewardPreview(reward) {
  if (reward.slot === "pose") return podiumRider("#ff852b", { pose: reward.value });
  let art;
  if (reward.slot === "hat") art = `<circle cx="32" cy="34" r="12" fill="#e0c0a2"/><g transform="translate(32 29)">${hatSVG(reward.value)}</g>`;
  else if (reward.slot === "trail") art = `<path d="M3 22q15 18 27 0t29 0M3 36q15 18 27 0t29 0" stroke="${reward.value === "neon" ? "#b9a5ff" : "#ffe17d"}" stroke-width="5" fill="none"/><path d="m48 5 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="#eefcff"/>`;
  else if (reward.slot === "cart") art = `<path d="M11 17h43l-7 27H18Z" fill="${reward.value}" stroke="#edf8ff" stroke-width="3"/>${reward.pattern === "hazard" ? '<path d="m22 19 12 22m-1-22 12 22" stroke="#162533" stroke-width="5"/>' : '<g transform="translate(23 19) scale(.6)" fill="#162533">'+GLYPHS[reward.pattern === "star" ? "star" : "bolt"]+'</g>'}<circle cx="21" cy="50" r="6" fill="#c7e4f4"/><circle cx="46" cy="50" r="6" fill="#c7e4f4"/>`;
  else art = `<path d="M7 7h50v50H7Z" fill="#132330" stroke="${["border", "arena"].includes(reward.slot) ? reward.value : "#ffe17d"}" stroke-width="5"/><g transform="translate(16 16)" stroke="#e9f3fa" fill="none" stroke-width="2">${GLYPHS[reward.slot === "commentary" ? "laugh" : "star"]}</g>`;
  return `<svg class="reward-preview" viewBox="0 0 64 64" aria-hidden="true">${art}</svg>`;
}
export function drawRewardHat(c, hat) {
  if (!hat) return;
  c.save(); c.lineWidth = 3;
  if (hat === "headphones") {
    c.strokeStyle = "#b9a5ff"; c.lineWidth = 5; c.beginPath(); c.arc(0, -2, 14, Math.PI, Math.PI * 2); c.stroke();
    c.fillStyle = "#ffe17d"; c.fillRect(-16, -3, 5, 12); c.fillRect(11, -3, 5, 12);
  } else if (hat === "ice-cap") {
    c.fillStyle = "#8fe4ed"; c.beginPath(); c.arc(0, -3, 14, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = "#f1fbff"; c.fillRect(-14, -5, 28, 5); c.beginPath(); c.arc(0, -19, 4, 0, Math.PI * 2); c.fill();
  } else if (hat === "pin-crown") {
    c.fillStyle = "#ffe17d"; c.strokeStyle = "#8e5b27"; c.beginPath();
    for (const [i, [x, y]] of [[-13, -5], [-16, -21], [-7, -13], [0, -25], [7, -13], [16, -21], [13, -5]].entries()) i ? c.lineTo(x, y) : c.moveTo(x, y);
    c.closePath(); c.fill(); c.stroke(); c.fillStyle = "#ed5c45"; c.fillRect(-10, -9, 20, 3);
  }
  c.restore();
}
export function drawRewardTrail(c, world, trail, reducedMotion) {
  if (!trail || reducedMotion || !world.launched || world.landed || world.crashed) return;
  c.save(); c.strokeStyle = trail === "neon" ? "#b9a5ff" : "#ffe17d"; c.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    c.globalAlpha = (1 - i / 12) * .7;
    const x = world.cart.position.x - 65 - i * 15;
    const y = world.cart.position.y + Math.sin(world.elapsed * 7 - i * .6) * 12;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 10, y - (trail === "comet" ? 5 : 0)); c.stroke();
  }
  c.restore();
}
