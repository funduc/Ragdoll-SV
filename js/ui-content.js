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

// At-a-glance summary shown above the detailed breakdown. Presentation only:
// every number is copied from the finished score object.
export const scorecard = (s, recordFlags = "") => {
  const part = (label, points, detail) =>
    `<div><dt>${label}</dt><dd>${points}<small>${escape(detail)}</small></dd></div>`;
  const flags = [
    recordFlags,
    s.crashed
      ? '<span data-flag="crash">CRASH</span>'
      : `<span>${escape(s.landingQuality.toUpperCase())} LANDING</span>`,
    `<span>TAKEOFF ${escape(s.takeoffGrade.toUpperCase())}</span>`,
    `<span>${escape(s.braceGrade.toUpperCase())}</span>`,
  ].join("");
  return `<div class="scorecard" aria-label="Score summary"><div class="scorecard-total"><strong>${s.total.toLocaleString("en-US")}</strong><span>POINTS</span></div><dl class="scorecard-parts">${part("DISTANCE", s.distancePoints, `${s.distanceMetres.toFixed(1)} m`)}${part("LANDING", s.landingPoints, s.landingQuality)}${part("STYLE", s.stylePoints, `${s.tricks.unique} trick${s.tricks.unique === 1 ? "" : "s"} · ${s.tricks.completedRotations} rot.`)}${part("ATTACHED", s.attachedPoints, s.attachedPoints ? "Held" : "—")}</dl><p class="scorecard-flags">${flags}</p></div>`;
};
// Collapsible wrapper for the long, exact breakdown. Content stays in the DOM.
export const fullBreakdown = (inner, open = false) =>
  `<details class="full-breakdown"${open ? " open" : ""}><summary>FULL SCORE BREAKDOWN</summary>${inner}</details>`;

// Shared verbatim by Party Tournament and Vault Run results.
export const scoreDetails = (s) =>
  `<div class="score-grid"><div class="score-item"><span>DISTANCE</span><strong>${s.distancePoints}</strong><small>${s.distanceMetres.toFixed(1)} m × 10</small></div><div class="score-item"><span>LANDING</span><strong>${s.landingPoints}</strong><small>${s.landingQuality}${s.landingQuality === "No landing" ? "" : ` · ${s.landingAngle}° tilt`}</small></div><div class="score-item"><span>AIR STYLE</span><strong>${s.stylePoints}</strong><small>${s.tricks.completedRotations} full rotations · ${s.tricks.unique} unique tricks</small></div><div class="score-item"><span>STAY ATTACHED</span><strong>${s.attachedPoints}</strong><small>${s.attachedPoints ? "Harness held through landing" : s.attached ? "No completed landing" : "Harness broke"}</small></div></div><div class="skill-result"><span>TAKEOFF: <b id="result-takeoff">${escape(s.takeoffGrade)}</b> · boost +${s.takeoffBonus}</span><span>LANDING INPUT: <b id="result-brace">${escape(s.braceGrade)}</b> · impact tolerance ×${s.impactTolerance.toFixed(2)}</span><span>PUSHES: ${s.pushCounts.Perfect} Perfect / ${s.pushCounts.Good} Good / ${s.pushCounts.Miss} Miss</span></div>${syncBreakdown(s)}${trickBreakdown(s)}<div class="score-total"><span>TOTAL POINTS</span><strong id="attempt-total">${s.total}</strong></div>`;
