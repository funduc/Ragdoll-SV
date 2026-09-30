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
  EVENTS,
  HIGH_JUMP_LINES,
  HIGH_JUMP_TRIES,
} from "./party-config.js";
import { escape, portrait } from "./ui-content.js";
import { BOWLING } from "./bowling.js";

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
const metres = (m) => `${m.toFixed(2)} m`;
// High Jump commentary; each kind rotates through its lines.
const lineCursor = {};
export function highJumpLine(kind) {
  const lines = HIGH_JUMP_LINES[kind] || HIGH_JUMP_LINES.cleared;
  lineCursor[kind] = ((lineCursor[kind] ?? -1) + 1) % lines.length;
  return lines[lineCursor[kind]];
}
const eventName = (t) =>
  t.highJump ? "HIGH JUMP" : t.bowling ? "BOWLING" : PARTY_FORMATS[t.format].name.toUpperCase();
export function roundLabel(t) {
  const round = t.currentRound;
  if (t.highJump) return `HEIGHT ${round.number} · BAR ${metres(round.height)}`;
  if (t.bowling) return `FRAME ${round.number} OF ${t.totalRounds}`;
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
  const formatBlock = t.setup.event !== "long-jump"
    ? `<div class="setup-format hj-rules"><p class="tiny"><b>${escape(EVENTS[t.setup.event].name.toUpperCase())} RULES</b> ${escape(EVENTS[t.setup.event].summary)}</p></div>`
    : `<fieldset class="setup-format"><legend>FORMAT</legend>${formats}</fieldset>`;
  return `<section class="menu-panel party-setup"><p class="eyebrow">PARTY TOURNAMENT / ${escape(EVENTS[t.setup.event].name.toUpperCase())} SETUP</p><h2>WHO'S JUMPING?</h2><div class="setup-head"><p class="tiny">${players.length} players · 2–6 · any character, duplicates welcome</p>${players.length < MAX_PLAYERS ? setupButton("+ Add player", "add") : ""}</div><ol class="setup-players">${rows}</ol><div class="setup-options">${formatBlock}<label class="chaos-toggle"><input type="checkbox" data-setup="chaos"${chaos ? " checked" : ""}><span><b>CHAOS</b><small>Every round rolls a random condition</small></span></label></div><div class="actions">${confirmButton("Start game night")}${setupButton("Back", "back")}</div></section>`;
}

export function roundLine(t) {
  const { condition, number } = t.currentRound;
  if (t.bowling)
    return condition
      ? CHAOS_LINES[condition]
      : [
          "Ten boxes of Crunchos, standing proud. Not for long.",
          "The pins have been reset. The pins have been warned.",
          "Final frame. Somebody please hit the cereal.",
        ][Math.min(number - 1, 2)];
  if (t.highJump)
    return condition
      ? CHAOS_LINES[condition]
      : number === 1
        ? "The bar is set at a height a shopping trolley could clear. Please do not prove me wrong."
        : `The bar goes up to ${metres(t.currentRound.height)}. The Squishco mat has been fluffed.`;
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
  const title = t.bowling
    ? `FRAME ${t.currentRound.number}`
    : t.highJump
    ? `BAR AT ${metres(t.currentRound.height)}`
    : t.isFinalRound && t.format !== "quick"
      ? "FINAL ROUND"
      : `ROUND ${t.currentRound.number}`;
  const label = t.highJump
    ? `HEIGHT ${t.currentRound.number} OF ${t.totalRounds} · ${HIGH_JUMP_TRIES} TRIES EACH`
    : t.bowling
      ? `${roundLabel(t)} · ONE THROW EACH`
      : roundLabel(t);
  return `<section class="menu-panel party-round"><p class="eyebrow">${escape(eventName(t))} / ${label}</p><h2>${title}</h2>${condition ? `<div class="chaos-card"><span>CHAOS ROLL</span>${chaosBadge(condition)}<p>${escape(CONDITIONS[condition].description)}</p></div>` : ""}<p class="intro-john"><b>JOHN SANTOR:</b> ${escape(roundLine(t))}</p><p class="tiny">JUMP ORDER: ${t.roster.map((p) => escape(p.name)).join(" → ")}</p><div class="actions">${confirmButton("First hand-off")}</div></section>`;
}

export function handoffMarkup(t) {
  const p = t.currentPlayer,
    c = p.character,
    next = t.nextPlayer;
  return `<section class="menu-panel"><p class="eyebrow">PASS THE CONTROLS</p><span class="turn-number">${roundLabel(t)} · ${t.highJump ? `TRY ${t.attemptNumber} OF ${HIGH_JUMP_TRIES}` : `${t.bowling ? "THROW" : "JUMP"} ${t.turn + 1} OF ${t.roster.length}`}</span><div class="handoff" style="--person:${c.primaryColor}">${portrait(c)}<div><h2>${escape(p.name)}</h2><span class="nickname">${escape(c.name)} “${escape(c.nickname)}”</span></div></div>${chaosBadge(t.currentRound.condition)}<p>Ready, ${escape(p.name)}?</p><p class="subline">${next ? `ON DECK: ${escape(next.name)}` : "LAST JUMP OF THE ROUND"}${!t.jumpsFor(p.id).length ? "" : t.highJump ? ` · YOUR BEST ${t.bestHeightFor(p.id) ? metres(t.bestHeightFor(p.id)) : "—"}` : ` · YOUR TOTAL ${t.totalFor(p.id)}`}</p><p class="tiny"><b>${escape(c.passive.name)}</b> · Style ×${c.styleMultiplier.toFixed(2)} · Air control ×${c.rotationControl.toFixed(2)} · Stability ×${c.landingStability.toFixed(2)}</p><div class="actions">${confirmButton("Begin jump")}</div></section>`;
}

// The button label after a jump: next player, round results or final results.
export function resultsAction(t) {
  if (t.nextPlayer) return "Next competitor";
  if (t.bowling) return t.isFinalRound ? "Final results" : "Frame results";
  if (t.highJump) {
    const round = t.currentRound;
    const stillIn = t.alive.some((id) =>
      round.attempts.some((a) => a.playerId === id && a.highJump.cleared),
    );
    return stillIn && !t.isFinalRound ? "Round results" : "Final results";
  }
  const ends =
    t.format === "elimination"
      ? t.currentRound.order.length <= 2
      : t.roundIndex >= t.totalRounds - 1;
  return ends ? "Final results" : "Round results";
}

// The High Jump verdict shown on the results screen instead of the points card.
export function highJumpResultMarkup(t) {
  const hj = t.lastScore.highJump,
    p = t.currentPlayer;
  const attempt = t.currentRound.attempts.at(-1)?.attempt ?? 1;
  const verdict = {
    cleared: hj.fosbury ? "FOSBURY CLEAR!" : "CLEARED!",
    knocked: hj.face ? "BAR DOWN · FACE FIRST" : "BAR DOWN",
    under: "UNDER THE BAR",
    short: "DIDN'T REACH THE BAR",
  }[hj.result];
  const left = HIGH_JUMP_TRIES - attempt;
  const note = hj.cleared
    ? `${escape(p.name)} is through to the next height.`
    : left > 0
      ? `${left} ${left === 1 ? "try" : "tries"} left at ${metres(hj.height)}.`
      : `Three misses at ${metres(hj.height)}. ${escape(p.name)} is out${t.bestHeightFor(p.id) ? ` with ${metres(t.bestHeightFor(p.id))}` : ""}.`;
  return `<div class="hj-verdict" data-result="${hj.result}"><span>${metres(hj.height)} · TRY ${attempt} OF ${HIGH_JUMP_TRIES}</span><strong>${verdict}</strong>${hj.fosbury ? '<b class="fosbury-bonus">FOSBURY STYLE BONUS</b>' : ""}<p>${note}</p></div>`;
}
// The bowling verdict shown on the results screen instead of the points card.
export function bowlingResultMarkup(t) {
  const b = t.lastScore.bowling;
  const verdict = b.riderOnly
    ? "STRIKE · BY RIDER!"
    : b.strike
      ? "STRIKE!"
      : b.pins === 0
        ? "GUTTER CART"
        : `${b.pins} ${b.pins === 1 ? "PIN" : "PINS"}`;
  const pins = Array.from({ length: 10 }, (_, i) => `<i data-down="${i < b.pins}"></i>`).join("");
  const parts = [
    `${b.pins} × ${BOWLING.pinPoints} = ${b.pinPoints}`,
    b.strike ? `STRIKE +${b.strikeBonus}` : "",
    b.carnage ? `RIDER CARNAGE +${b.carnageBonus}` : "",
  ].filter(Boolean);
  return `<div class="hj-verdict bowl-verdict" data-result="${b.strike ? "cleared" : "pins"}"><span>${roundLabel(t)}</span><strong>${verdict}</strong><div class="pin-row" role="img" aria-label="${b.pins} of 10 pins down">${pins}</div><p>${parts.join(" · ")} · <b>${b.points} POINTS</b></p></div>`;
}
const bestLabel = (best) =>
  best ? `${best.score.total} · ${best.score.distanceMetres.toFixed(1)} m` : "—";
export function standingsTable(t) {
  if (t.bowling)
    return `<table class="results-table party-table"><thead><tr><th>#</th><th>PLAYER</th><th>STRIKES</th><th>PINS</th><th>POINTS</th></tr></thead><tbody>${t.standings
      .map(
        (row, i) =>
          `<tr style="--person:${row.player.character.primaryColor}"><td>${i + 1}</td><td>${who(row.player)}</td><td>${row.strikes}</td><td>${row.pins}</td><td>${row.total}</td></tr>`,
      )
      .join("")}</tbody></table>`;
  if (t.highJump)
    return `<table class="results-table party-table"><thead><tr><th>#</th><th>PLAYER</th><th>MISSES</th><th>FOSBURYS</th><th>BEST HEIGHT</th></tr></thead><tbody>${t.standings
      .map(
        (row, i) =>
          `<tr class="${row.out ? "eliminated" : ""}" style="--person:${row.player.character.primaryColor}"><td>${i + 1}</td><td>${who(row.player)}${row.out ? `<span class="status-chip">OUT AT ${metres(row.out.height)}</span>` : ""}</td><td>${row.misses}</td><td>${row.fosburys}</td><td>${row.height ? metres(row.height) : "—"}</td></tr>`,
      )
      .join("")}</tbody></table>`;
  return `<table class="results-table party-table"><thead><tr><th>#</th><th>PLAYER</th><th>BEST JUMP</th><th>TOTAL</th></tr></thead><tbody>${t.standings
    .map(
      (row, i) =>
        `<tr class="${row.out ? "eliminated" : ""}" style="--person:${row.player.character.primaryColor}"><td>${row.out ? "—" : i + 1}</td><td>${who(row.player)}${row.out ? `<span class="status-chip">OUT R${row.out.round}</span>` : ""}</td><td>${bestLabel(row.best)}</td><td>${row.total}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
export function scoreboardLine(t) {
  const [first, second] = t.standings.filter((row) => !row.out);
  if (t.highJump) {
    const out = t.lastEliminatedAll || [];
    if (out.length)
      return `${out.map((p) => p.name).join(" and ")} ${out.length === 1 ? "has" : "have"} run out of tries. The bar sends its regards.`;
    return `Everyone is still in. The bar goes up. The bar always goes up.`;
  }
  if (t.lastEliminated)
    return `${t.lastEliminated.name} has left the building. The cart has been informed.`;
  if (!second) return `${first.player.name} stands alone.`;
  const gap = first.total - second.total;
  return gap === 0
    ? `${first.player.name} and ${second.player.name} are dead level. The ledger is sweating.`
    : `${first.player.name} leads by ${gap} points. Nobody panic. Everybody panic.`;
}
export function scoreboardMarkup(t) {
  return `<section class="menu-panel party-scoreboard"><p class="eyebrow">AFTER ${t.highJump ? `HEIGHT ${t.currentRound.number} · ${metres(t.currentRound.height)}` : roundLabel(t).replace(/ · \d+ LEFT$/, "")}</p><h2>SCOREBOARD</h2>${t.highJump ? ((t.lastEliminatedAll || []).length ? `<p class="eliminated-banner">${escape(t.lastEliminatedAll.map((p) => p.name.toUpperCase()).join(" & "))} ${t.lastEliminatedAll.length === 1 ? "IS" : "ARE"} OUT</p>` : "") : t.lastEliminated ? `<p class="eliminated-banner">${escape(t.lastEliminated.name.toUpperCase())} IS OUT</p>` : ""}${standingsTable(t)}<p class="intro-john"><b>JOHN SANTOR:</b> ${escape(scoreboardLine(t))}</p><div class="actions">${confirmButton("Next round")}</div></section>`;
}

function awardCard(title, award, detail) {
  return award
    ? `<article class="award-card"><span>${title}</span><b>${escape(award.player.name)}</b><small>${detail}</small></article>`
    : "";
}
export function awardsMarkup(awards) {
  const a = awards || {};
  if ("strikeLeader" in a) {
    const cards = [
      awardCard("PIN COLLECTOR", a.pinCollector, a.pinCollector && `${a.pinCollector.value} ${a.pinCollector.value === 1 ? "pin" : "pins"} in all`),
      awardCard("STRIKE LEADER", a.strikeLeader, a.strikeLeader && `${a.strikeLeader.value} ${a.strikeLeader.value === 1 ? "strike" : "strikes"}`),
      awardCard("CRASH OF THE NIGHT", a.crashOfNight, a.crashOfNight && `${a.crashOfNight.carnage.total} carnage · frame ${a.crashOfNight.round}`),
      awardCard("HUMAN BOWLING BALL", a.bowlingBall, a.bowlingBall && `rider into the pins ${a.bowlingBall.value}×`),
      awardCard("GUTTER GLORY", a.gutterGlory, a.gutterGlory && `${a.gutterGlory.value} zero-pin ${a.gutterGlory.value === 1 ? "throw" : "throws"}`),
    ].join("");
    return cards ? `<div class="award-grid" aria-label="Awards">${cards}</div>` : "";
  }
  if ("fosburyKing" in a) {
    const hjCards = [
      awardCard("FOSBURY KING", a.fosburyKing, a.fosburyKing && `${a.fosburyKing.value} upside-down ${a.fosburyKing.value === 1 ? "clear" : "clears"}`),
      awardCard("CRASH OF THE NIGHT", a.crashOfNight, a.crashOfNight && `${a.crashOfNight.carnage.total} carnage · height ${a.crashOfNight.round}`),
      awardCard("CLEAN SHEET", a.cleanSheet, a.cleanSheet && `${a.cleanSheet.misses} ${a.cleanSheet.misses === 1 ? "miss" : "misses"} in ${a.cleanSheet.clears} clears`),
      awardCard("BAR BREAKER", a.barBreaker, a.barBreaker && `${a.barBreaker.value} ${a.barBreaker.value === 1 ? "bar" : "bars"} knocked off`),
    ].join("");
    return hjCards ? `<div class="award-grid" aria-label="Awards">${hjCards}</div>` : "";
  }
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
function finalSummary(t, names, tie) {
  const lead = t.winners[0];
  if (t.highJump) {
    const best = t.bestHeightFor(lead.id);
    const height = best ? `a best clearance of ${metres(best)}` : "no clearance at all";
    return tie
      ? `${names.join(" & ")} share it with ${height}.`
      : `${names[0]} as ${escape(lead.character.fullName)} · ${height}.`;
  }
  return tie
    ? `${names.join(" & ")} finish level on ${t.totalFor(lead.id)} points.`
    : `${names[0]} as ${escape(lead.character.fullName)} · ${t.totalFor(lead.id)} points.`;
}
export function finalMarkup(t) {
  const tie = t.winners.length > 1,
    names = t.winners.map((p) => escape(p.name));
  return `<section class="menu-panel championship-panel winner-panel party-final"><div class="championship-ribbon" aria-hidden="true">OFFICIALLY EXCESSIVE CHAMPIONSHIP</div><div class="championship-seal" aria-hidden="true"><span>★</span> CERTIFIED CART LEGEND</div><p class="eyebrow orange">GAME NIGHT / ${escape(eventName(t))} FINAL RESULTS</p><h2>${tie ? "A SHARED VICTORY!" : `${names[0].toUpperCase()} WINS!`}</h2><p>${finalSummary(t, names, tie)}</p>${standingsTable(t)}${awardsMarkup(t.awards)}<div class="actions">${confirmButton("Back to title")}<button type="button" class="btn secondary" data-party="rematch">Rematch</button></div></section>`;
}
