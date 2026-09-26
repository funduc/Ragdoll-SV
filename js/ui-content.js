import { syncBreakdown } from "./sync-ui.js";
import { trickBreakdown } from "./trick-ui.js";

export const unavailablePortraits = new Set();
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const portrait = (c) =>
  `<div class="portrait" style="--person:${c.primaryColor}" role="img" aria-label="${escape(c.name)} portrait"><span>${c.fallbackInitials}</span>${!c.portraitAvailable || unavailablePortraits.has(c.portraitPath) ? "" : `<img src="${escape(c.portraitPath)}" alt="" draggable="false" style="object-position:${escape(c.portraitPosition || "50% 50%")}" loading="eager">`}</div>`;

export const carnageDetails = (s) => s.crashed && s.carnage
  ? `<section class="carnage-card" aria-label="Crash carnage"><span>CARNAGE</span><strong>${s.carnage.total}</strong><p>${s.carnage.partsLost} parts lost · ${s.carnage.airtime.toFixed(1)} s rider airtime · ${s.carnage.bounces} bounces · ${s.carnage.distance.toFixed(1)} m rider travel</p><small>Separate crash score · normal points and medals stay unchanged</small></section>`
  : "";

export const crashOfNightMarkup = (award) => award
  ? `<section class="carnage-card" aria-label="Crash of the Night"><h3>CRASH OF THE NIGHT</h3><p>${escape(award.character.fullName)}</p><strong>${award.carnage.total} CARNAGE</strong><p>JOHN: THE CART ARRIVED AS ONE ITEM. ${escape(award.character.name.split(" ")[0].toUpperCase())} HAS REQUESTED SEPARATE RECEIPTS!</p></section>`
  : "";

// Shared verbatim by Party Tournament and Vault Run results.
export const scoreDetails = (s) =>
  `<div class="score-grid"><div class="score-item"><span>DISTANCE</span><strong>${s.distancePoints}</strong><small>${s.distanceMetres.toFixed(1)} m × 10</small></div><div class="score-item"><span>LANDING</span><strong>${s.landingPoints}</strong><small>${s.landingQuality}${s.landingQuality === "No landing" ? "" : ` · ${s.landingAngle}° tilt`}</small></div><div class="score-item"><span>AIR STYLE</span><strong>${s.stylePoints}</strong><small>${s.tricks.completedRotations} full rotations · ${s.tricks.unique} unique tricks</small></div><div class="score-item"><span>STAY ATTACHED</span><strong>${s.attachedPoints}</strong><small>${s.attachedPoints ? "Harness held through landing" : s.attached ? "No completed landing" : "Harness broke"}</small></div></div><div class="skill-result"><span>TAKEOFF: <b id="result-takeoff">${escape(s.takeoffGrade)}</b> · boost +${s.takeoffBonus}</span><span>LANDING INPUT: <b id="result-brace">${escape(s.braceGrade)}</b> · impact tolerance ×${s.impactTolerance.toFixed(2)}</span><span>PUSHES: ${s.pushCounts.Perfect} Perfect / ${s.pushCounts.Good} Good / ${s.pushCounts.Miss} Miss</span></div>${syncBreakdown(s)}${trickBreakdown(s)}<div class="score-total"><span>TOTAL POINTS</span><strong id="attempt-total">${s.total}</strong></div>${carnageDetails(s)}`;
