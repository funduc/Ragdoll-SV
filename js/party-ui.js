import { CHARACTERS } from "./characters.js";
import { CONDITIONS } from "./run-config.js";
import { CONDITION_BADGES } from "./run-ui.js";
import {
  PARTY_FORMATS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_LENGTH,
  CHAOS_LINES,
  ROUND_LINES,
} from "./party-config.js";
import { escape, portrait } from "./ui-content.js";

// Party Tournament screens. Pure markup, so tests can check them in Node.
const confirmButton = (label) =>
  `<button type="button" class="btn" data-action="confirm">${escape(label)} <small class="keyboard-note">ENTER ↵</small></button>`;
const setupButton = (label, action, index = "", attributes = "") =>
  `<button type="button" class="btn secondary" data-setup="${action}" data-index="${index}"${attributes}>${label}</button>`;
const face = (c) =>
  `<span class="pick-face" style="--person:${c.primaryColor}" aria-hidden="true">${c.fallbackInitials}</span>`;
const who = (player) =>
  `<b>${escape(player.name)}</b> <small>${escape(player.character.name)}</small>`;

export function conditionName(id) {
  return CONDITIONS[id]?.name || "Standard";
}
export function chaosBadge(id) {
  if (!id) return "";
  const [icon, words] = CONDITION_BADGES[id] || ["◆", ""];
  return `<p class="condition-badge" data-condition="${escape(id)}"><span class="condition-icon" aria-hidden="true">${icon}&#xFE0E;</span><b>${escape(conditionName(id))}</b>${words ? ` · ${escape(words)}` : ""}</p>`;
}
export function roundLabel(t) {
  const round = t.currentRound;
  return t.format === "elimination"
    ? `ROUND ${round.number} · ${round.order.length} LEFT`
    : `ROUND ${round.number} OF ${t.totalRounds}`;
}

export function setupMarkup(t) {
  const { players, format, chaos } = t.setup;
  const rows = players
    .map(
      (p, i) =>
        `<li class="setup-player"><span class="player-number">P${i + 1}</span><input type="text" data-setup="name" data-index="${i}" value="${escape(p.name)}" maxlength="${NAME_LENGTH}" placeholder="Player ${i + 1}" aria-label="Player ${i + 1} name" autocomplete="off" spellcheck="false"><span class="character-picks" role="radiogroup" aria-label="Player ${i + 1} character">${CHARACTERS.map(
          (c) =>
            `<label class="pick" style="--person:${c.primaryColor}"><input type="radio" name="party-character-${i}" value="${c.id}" data-setup="character" data-index="${i}"${p.characterId === c.id ? " checked" : ""}>${face(c)}<span>${escape(c.name.split(" ")[0])}</span></label>`,
        ).join(
          "",
        )}</span>${players.length > MIN_PLAYERS ? setupButton("✕", "remove", i, ` aria-label="Remove player ${i + 1}"`) : ""}</li>`,
    )
    .join("");
  const formats = Object.entries(PARTY_FORMATS)
    .map(
      ([id, f]) =>
        `<label class="format-option"><input type="radio" name="party-format" value="${id}" data-setup="format"${format === id ? " checked" : ""}><b>${escape(f.name)}</b><small>${escape(f.summary)}</small></label>`,
    )
    .join("");
  return `<section class="menu-panel party-setup"><p class="eyebrow">PARTY TOURNAMENT / GAME NIGHT SETUP</p><h2>WHO'S JUMPING?</h2><div class="setup-head"><p class="tiny">${players.length} players · 2–6 · any character, duplicates welcome</p>${players.length < MAX_PLAYERS ? setupButton("+ Add player", "add") : ""}</div><ol class="setup-players">${rows}</ol><div class="setup-options"><fieldset class="setup-format"><legend>FORMAT</legend>${formats}</fieldset><label class="chaos-toggle"><input type="checkbox" data-setup="chaos"${chaos ? " checked" : ""}><span><b>CHAOS</b><small>Every round rolls a random condition</small></span></label></div><div class="actions">${confirmButton("Start game night")}${setupButton("Back", "back")}</div></section>`;
}

export function roundLine(t) {
  const { condition, number } = t.currentRound;
  const lead = t.isFinalRound && t.format !== "quick" ? "FINAL ROUND. " : "";
  return (
    lead +
    (condition
      ? CHAOS_LINES[condition]
      : ROUND_LINES[(number - 1) % ROUND_LINES.length])
  );
}
export function roundIntroMarkup(t) {
  const { condition } = t.currentRound;
  const title =
    t.isFinalRound && t.format !== "quick" ? "FINAL ROUND" : `ROUND ${t.currentRound.number}`;
  return `<section class="menu-panel party-round"><p class="eyebrow">${escape(PARTY_FORMATS[t.format].name.toUpperCase())} / ${roundLabel(t)}</p><h2>${title}</h2>${condition ? `<div class="chaos-card"><span>CHAOS ROLL</span>${chaosBadge(condition)}<p>${escape(CONDITIONS[condition].description)}</p></div>` : ""}<p class="intro-john"><b>JOHN SANTOR:</b> ${escape(roundLine(t))}</p><p class="tiny">JUMP ORDER: ${t.roster.map((p) => escape(p.name)).join(" → ")}</p><div class="actions">${confirmButton("First hand-off")}</div></section>`;
}

export function handoffMarkup(t) {
  const p = t.currentPlayer,
    c = p.character,
    next = t.nextPlayer;
  return `<section class="menu-panel"><p class="eyebrow">PASS THE CONTROLS</p><span class="turn-number">${roundLabel(t)} · JUMP ${t.turn + 1} OF ${t.roster.length}</span><div class="handoff" style="--person:${c.primaryColor}">${portrait(c)}<div><h2>${escape(p.name)}</h2><span class="nickname">${escape(c.name)} “${escape(c.nickname)}”</span></div></div>${chaosBadge(t.currentRound.condition)}<p>Ready, ${escape(p.name)}?</p><p class="subline">${next ? `ON DECK: ${escape(next.name)}` : "LAST JUMP OF THE ROUND"}${t.jumpsFor(p.id).length ? ` · YOUR TOTAL ${t.totalFor(p.id)}` : ""}</p><p class="tiny"><b>${escape(c.passive.name)}</b> · Style ×${c.styleMultiplier.toFixed(2)} · Air control ×${c.rotationControl.toFixed(2)} · Stability ×${c.landingStability.toFixed(2)}</p><div class="actions">${confirmButton("Begin jump")}</div></section>`;
}

// The button label after a jump: next player, round results or final results.
export function resultsAction(t) {
  if (t.nextPlayer) return "Next competitor";
  const ends =
    t.format === "elimination"
      ? t.currentRound.order.length <= 2
      : t.roundIndex >= t.totalRounds - 1;
  return ends ? "Final results" : "Round results";
}

const bestLabel = (best) =>
  best ? `${best.score.total} · ${best.score.distanceMetres.toFixed(1)} m` : "—";
export function standingsTable(t) {
  return `<table class="results-table party-table"><thead><tr><th>#</th><th>PLAYER</th><th>BEST JUMP</th><th>TOTAL</th></tr></thead><tbody>${t.standings
    .map(
      (row, i) =>
        `<tr class="${row.out ? "eliminated" : ""}" style="--person:${row.player.character.primaryColor}"><td>${row.out ? "—" : i + 1}</td><td>${who(row.player)}${row.out ? `<span class="status-chip">OUT R${row.out.round}</span>` : ""}</td><td>${bestLabel(row.best)}</td><td>${row.total}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
export function scoreboardLine(t) {
  const [first, second] = t.standings.filter((row) => !row.out);
  if (t.lastEliminated)
    return `${t.lastEliminated.name} has left the building. The cart has been informed.`;
  if (!second) return `${first.player.name} stands alone.`;
  const gap = first.total - second.total;
  return gap === 0
    ? `${first.player.name} and ${second.player.name} are dead level. The ledger is sweating.`
    : `${first.player.name} leads by ${gap} points. Nobody panic. Everybody panic.`;
}
export function scoreboardMarkup(t) {
  return `<section class="menu-panel party-scoreboard"><p class="eyebrow">AFTER ${roundLabel(t).replace(/ · \d+ LEFT$/, "")}</p><h2>SCOREBOARD</h2>${t.lastEliminated ? `<p class="eliminated-banner">${escape(t.lastEliminated.name.toUpperCase())} IS OUT</p>` : ""}${standingsTable(t)}<p class="intro-john"><b>JOHN SANTOR:</b> ${escape(scoreboardLine(t))}</p><div class="actions">${confirmButton("Next round")}</div></section>`;
}

function awardCard(title, award, detail) {
  return award
    ? `<article class="award-card"><span>${title}</span><b>${escape(award.player.name)}</b><small>${detail}</small></article>`
    : "";
}
export function awardsMarkup(awards) {
  const a = awards || {};
  const cards = [
    awardCard(
      "LONGEST JUMP",
      a.longestJump,
      a.longestJump && `${a.longestJump.value.toFixed(1)} m · round ${a.longestJump.round}`,
    ),
    awardCard(
      "BEST STYLE",
      a.bestStyle,
      a.bestStyle && `${a.bestStyle.value} style points`,
    ),
    awardCard(
      "CRASH OF THE NIGHT",
      a.crashOfNight,
      a.crashOfNight &&
        `${a.crashOfNight.carnage.total} carnage · round ${a.crashOfNight.round}`,
    ),
    awardCard(
      "MOST CONSISTENT",
      a.mostConsistent,
      a.mostConsistent &&
        `±${Math.round(a.mostConsistent.spread)} points over ${a.mostConsistent.jumps} jumps`,
    ),
  ].join("");
  return cards ? `<div class="award-grid" aria-label="Awards">${cards}</div>` : "";
}
export function finalMarkup(t) {
  const tie = t.winners.length > 1,
    names = t.winners.map((p) => escape(p.name));
  return `<section class="menu-panel championship-panel winner-panel party-final"><div class="championship-ribbon" aria-hidden="true">OFFICIALLY EXCESSIVE CHAMPIONSHIP</div><div class="championship-seal" aria-hidden="true"><span>★</span> CERTIFIED CART LEGEND</div><p class="eyebrow orange">GAME NIGHT / ${escape(PARTY_FORMATS[t.format].name.toUpperCase())} FINAL RESULTS</p><h2>${tie ? "A SHARED VICTORY!" : `${names[0].toUpperCase()} WINS!`}</h2><p>${tie ? `${names.join(" & ")} finish level on ${t.totalFor(t.winners[0].id)} points.` : `${names[0]} as ${escape(t.winners[0].character.fullName)} · ${t.totalFor(t.winners[0].id)} points.`}</p>${standingsTable(t)}${awardsMarkup(t.awards)}<div class="actions">${confirmButton("Back to title")}<button type="button" class="btn secondary" data-party="rematch">Rematch</button></div></section>`;
}
