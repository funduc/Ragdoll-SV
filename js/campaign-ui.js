import { AFTER_HOURS_LEVELS } from "./after-hours.js";
import { podiumRider } from "./achievement-art.js";
import { CHARACTERS } from "./characters.js";
import { CampaignState as S } from "./campaign.js";
import {
  LEVELS,
  HARD_GAUNTLET,
  MEDALS,
  meetsThreshold,
} from "./campaign-levels.js";
import {
  escape,
  portrait,
  scoreCard,
  scoreBreakdown,
  carnageDetails,
} from "./ui-content.js";
import {
  runInventory,
  upgradeIcons,
  upgradeControls,
  runNotice,
  challengeMarkup,
  conditionBadge,
  upgradeChoices,
  updateRunStatus,
} from "./run-ui.js";
import { CONDITIONS, OBJECTIVES, OBJECTIVE_IDS } from "./run-config.js";
import { TRICK_CONFIG } from "./trick-config.js";
import { TOUR_LEVELS, applause, crowdCue, ROAD_POEM, roadVerse, noisePercent, libraryTooLoud, factoryCycleRemaining, TOUR_CLOSING, ROOFTOP_FALL_LINE } from "./santor-tour.js";

const action = (label, name, value = "", secondary = false, disabled = false) =>
  `<button type="button" class="btn${secondary ? " secondary" : ""}" data-campaign="${name}" data-value="${escape(value)}"${disabled ? " disabled" : ""}>${escape(label)}</button>`;
const medal = (rank) =>
  `<span class="campaign-medal" data-medal="${rank}">${MEDALS[rank]}</span>`;
const goals = (level, facts = null) =>
  `<ul class="campaign-goals">${["bronze", "silver", "gold"]
    .map(
      (tier, i) =>
        `<li${facts ? ` data-met="${Boolean(facts.finished && !facts.invalid && meetsThreshold(level[tier], facts))}"` : ""}>${medal(i + 1)} <span>${escape(level[tier].label)}</span>${facts ? `<b>${facts.finished && !facts.invalid && meetsThreshold(level[tier], facts) ? "MET" : "—"}</b>` : ""}</li>`,
    )
    .join(
      "",
    )}${level.santorMedal ? `<li${facts ? ` data-met="${Boolean(facts.finished && !facts.invalid && meetsThreshold(level.santorMedal, facts))}"` : ""}><span class="campaign-medal">SANTOR</span><span>${escape(level.santorMedal.label)} (optional)</span>${facts ? `<b>${facts.finished && !facts.invalid && meetsThreshold(level.santorMedal, facts) ? "MET" : "—"}</b>` : ""}</li>` : ""}</ul>`;
// Short medal phrases for the briefing and the results checklist. The full
// requirement text (each level's label) stays under Details.
const SHORT_GOALS = {
  "orientation-day": ["Reach the ramp", "2 good pushes", "Perfect takeoff", "Perfect takeoff, no Misses"],
  "wheels-down": ["Land it (crashes count)", "Good Brace", "Perfect Brace + Clean landing", "Perfect takeoff + Brace, Clean"],
  "commit-to-the-bit": ["Pull off 1 trick", "1 trick + land it", "2 different tricks + land", "2 tricks, Clean, Perfect Brace"],
  "showboating-101": ["Pull off 1 trick", "2 tricks + land", "3 tricks + land", "3 tricks, Clean, Perfect Brace"],
  "cross-examination": ["Land the jump", "Land in the target zone", "Target zone, rider attached", "Target, Clean, Perfect Brace"],
  "fragile-cargo": ["Finish the jump", "Keep the mug", "Keep the mug + land Clean", "Mug, Clean, Perfect takeoff + Brace"],
  "the-mapleton-run": ["Reach the ramp", "2 good pushes, no Misses", "No Misses + land it", "No Misses, Perfect takeoff + Brace, Clean"],
  "ice-cream-weather": ["Land the jump", "Land with Good Brace", "Perfect Brace + Clean landing", "Perfect everything, no Misses"],
  "siemens-certified": ["Finish after the pulse", "Recover and land", "Max speed, land attached", "Max speed, Clean, Perfect Brace"],
  "the-santor-gauntlet": ["3 jumps, 1,050 points", "2,250 points + 2 landings", "3,000 points + 3 landings", "3,950 points, all Clean"],
  "santor-gauntlet-hard": ["2 landings, 2,250 points", "3 landings, 3,400 points", "3 Perfect Braces, 4,250 points", "4,600 points, all Perfect"],
  "freezer-aisle": ["Complete a jump", "Land on a freezer lid", "Clean on a lid", "Lid 5, Clean, Perfect Brace"],
  "open-mic": ["Complete a jump", "2 different tricks + land", "3 different tricks + land", "3 tricks, Clean, mic untouched"],
  "mapleton-night-shift": ["Complete a jump", "Avoid the potholes", "Between potholes, no Misses", "Gold + Clean + Perfect takeoff"],
  "quiet-please": ["Complete a jump", "Land beyond the books", "Beyond books, Clean + quiet", "Gold + a trick, zero books tipped"],
  "siemens-floor": ["Complete a jump", "Land on the belt", "Clean + stay aboard until rest", "Gold, Perfect Brace, 60 m+"],
  "temu-warehouse": ["Complete a jump", "10 boxes down", "20 boxes + land attached", "30 boxes, attached + Clean"],
};
const TIERS = [
  ["bronze", 1, "Bronze"],
  ["silver", 2, "Silver"],
  ["gold", 3, "Gold"],
  ["santorMedal", 4, "Santor"],
];
// Letter + colour, so the medal never relies on colour alone.
const medalIcon = (rank) =>
  `<span class="medal-icon" data-medal="${rank}" aria-hidden="true">${["–", "B", "S", "G", "★"][rank]}</span>`;
const LOCK = `<svg class="lock-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
// "Gold: 2 tricks + land" phrases; with facts, a ticked checklist.
function goalList(level, facts = null) {
  const short = SHORT_GOALS[level.id] || [];
  return `<ul class="goal-list">${TIERS.filter(([key]) => level[key])
    .map(([key, rank, name]) => {
      const met = Boolean(
        facts?.finished && !facts.invalid && meetsThreshold(level[key], facts),
      );
      return `<li${facts ? ` data-met="${met}"` : ""}>${facts ? `<span class="goal-tick" role="img" aria-label="${met ? "Met" : "Not met"}">${met ? "✓" : "✗"}</span>` : ""}${medalIcon(rank)}<span><b>${name}${rank === 4 ? " (optional)" : ""}:</b> ${escape(short[rank - 1] || level[key].label)}</span></li>`;
    })
    .join("")}</ul>`;
}
const firstSentence = (text) => text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
const details = (content, label = "Details") =>
  `<details class="brief-details"><summary>${label}</summary>${content}</details>`;
// The default save line appears once, on character select; real notices
// (storage errors, newer saves) show wherever they occur.
const notice = (save, always = false) =>
  save.notice || always
    ? `<p class="tiny campaign-save" role="status">${escape(save.notice || "Saved on this browser · separate progress for each character.")}</p>`
    : "";
const progressCount = (save, c) =>
  LEVELS.filter((l) => save.entry(c.id, l.id).medal > 0).length;

function seriesMarkup(run, level) {
  if (!level.stages) return "";
  return `<div class="run-challenge"><p><b>THREE-HEAT SCHEDULE · scores add together</b><span>${level.stages.map((stage, i) => `${i + 1}. ${escape(stage.name)} — ${escape(CONDITIONS[run.runs.plan(level.id, run.developer, i).condition]?.name || "Standard")}`).join(" · ")}</span><small>Each heat has a separate Ready screen. Replaying or refreshing starts at heat one.</small></p></div>`;
}
function heatLedger(run) {
  const sum = (key) => run.heats.reduce((n, h) => n + h.score[key], 0);
  return `<section class="run-inventory" aria-label="Combined Gauntlet score"><h3>COMBINED SCORE · ${run.combinedScore}</h3><ul>${run.heats.map((h, i) => `<li><b>HEAT ${i + 1} · ${escape(h.name)} · ${h.score.total} POINTS</b><span>${escape(CONDITIONS[h.condition]?.name || "Standard")} · Distance ${h.score.distancePoints} + Style ${h.score.stylePoints} + Landing ${h.score.landingPoints} + Attachment ${h.score.attachedPoints}</span></li>`).join("")}</ul><p class="tiny">TOTAL: Distance ${sum("distancePoints")} + Style ${sum("stylePoints")} + Landing ${sum("landingPoints")} + Attachment ${sum("attachedPoints")} = ${run.combinedScore}. No hidden bonus.</p></section>`;
}
function levelTile(run, level, number, lockedHint) {
  const unlocked = run.isUnlocked(level),
    best = run.save.entry(run.current.id, level.id);
  const status = unlocked
    ? `${MEDALS[best.medal]}${best.santor ? " + Santor medal" : ""}`
    : `Locked. ${lockedHint}`;
  return `<li><button type="button" class="level-tile${unlocked ? "" : " locked"}" data-campaign="level" data-value="${level.id}" data-medal="${best.medal}" aria-label="${escape(`${number} ${level.name}: ${status}`)}" title="${escape(unlocked ? level.name : lockedHint)}"${unlocked ? "" : " disabled"}><span class="tile-number">${number}</span><span class="tile-name">${escape(level.name)}</span><span class="tile-status">${unlocked ? `${medalIcon(best.medal)}${best.santor ? medalIcon(4) : ""}` : LOCK}</span></button></li>`;
}
// Optional chapters stay separate from main-campaign completion.
function bonusRow(run) {
  return `<section class="bonus-row" aria-label="Bonus levels"><h3>BONUS</h3><ul class="level-grid">${levelTile(run, HARD_GAUNTLET, "OT", "Beat the Santor Gauntlet to unlock.")}</ul></section>`;
}
function afterHoursRow(run) {
  return `<section class="bonus-row" aria-label="After Hours"><h3>AFTER HOURS</h3><ul class="level-grid">${AFTER_HOURS_LEVELS.map((level, i) => levelTile(run, level, `AH${i + 1}`, `Earn Bronze in ${i ? AFTER_HOURS_LEVELS[i - 1].name : "The Santor Gauntlet"}.`)).join("")}</ul></section>`;
}
function tourRow(run) {
  return `<section class="bonus-row tour-row" aria-label="Santor on Tour"><h3>SANTOR ON TOUR</h3><p class="tiny">Bronze in The Santor Gauntlet opens the Tour. Earn Bronze in each stop to open the next.</p><ul class="level-grid">${TOUR_LEVELS.map((level, i) => levelTile(run, level, `T${i + 1}`, `Earn Bronze in ${i ? TOUR_LEVELS[i - 1].name : "The Santor Gauntlet"}.`)).join("")}</ul></section>`;
}

function tourEnding(run, cosmetics = {}) {
  if (run.level.id !== "grand-reopening" || run.lastMedal.provisional || run.lastMedal.medal < 1) return "";
  const others = CHARACTERS.filter((c) => c !== run.current);
  return `<section class="tour-ending" aria-label="Tour ending"><div class="tour-fireworks" aria-hidden="true">✺ ✧ ✺ ✧ ✺</div><p class="eyebrow">EIGHT STOPS · EVERYONE HOME</p><h2>TOUR COMPLETE</h2><div class="tour-podium">${[others[0], run.current, others[1]].map((c) => `<div class="tour-podium-person">${cosmetics.pose || cosmetics.hat ? podiumRider(c.primaryColor, cosmetics) : portrait(c)}<b>${escape(c.name.split(" ")[0])}</b><span aria-hidden="true">★</span></div>`).join("")}</div><p class="intro-john"><b>JOHN SANTOR:</b> ${escape(TOUR_CLOSING)}</p><p class="tiny">TOUR COMPLETE ACHIEVEMENT · THANK YOU FOR PLAYING</p></section>`;
}

function tourResultNotes(level, facts) {
  if (level.id === "rooftop-delivery")
    return `<p class="subline">${facts.farRoofLanding ? "FAR ROOF REACHED" : facts.rooftopJump ? "DELIVERY MISSED · BRONZE ONLY" : "DELIVERY NOT COMPLETED"} · ${facts.cargoRetained && facts.farRoofLanding ? "MUG DELIVERED" : "MUG NOT DELIVERED"}</p>`;
  if (level.id === "grand-reopening")
    return `<p class="subline">${facts.ribbonCut ? "RIBBON CUT · THE VAULT IS OPEN" : facts.finished ? "RIBBON NOT CUT" : "RIBBON AWAITS THE FINAL HEAT"}</p>`;
  if (level.id === "siemens-floor")
    return `<p class="subline">${facts.conveyorLanding ? "BELT CONTACT" : "MISSED THE BELT"} · ${facts.stayedOnConveyor ? "STAYED ABOARD" : "DID NOT SETTLE ON BELT"} · DISTANCE MEASURED AT FIRST CONTACT</p>`;
  if (level.id === "temu-warehouse")
    return `<p class="subline">${facts.propsFallen} / 36 BOXES KNOCKED DOWN${facts.propsFallen ? " · OWEN: I ordered these." : ""}</p>`;
  if (level.id === "mapleton-night-shift" && facts.successfulLanding)
    return `<p class="subline">BRANDON: ${escape(ROAD_POEM[3])}</p>`;
  if (level.id === "quiet-please") {
    const noise = facts.impactLoudness == null ? "NO IMPACT RECORDED"
      : `${noisePercent(facts)}% NOISE · ${facts.quietImpact ? "quiet" : "shhh! too loud for Gold"}`;
    return `<p class="subline">${noise} · ${facts.propsFallen} BOOKS KNOCKED OVER</p>`;
  }
  return "";
}

function profile(ui, c, run) {
  const john = ui.commentator.pick("introduction", c, "qualifying");
  ui.say(john);
  return `<section class="menu-panel intro-card" style="--person:${c.primaryColor}">
    ${runNotice(run)}<p class="eyebrow">VAULT RUN / CONFIRM YOUR COMPETITOR <span class="intro-countdown">PRESS ENTER WHEN READY.</span></p>
    <div class="handoff">${portrait(c)}<div><h2>${escape(c.fullName)}</h2><p class="tiny">${run.runs.run?.characterId === c.id ? "Resume your current run and upgrades." : "Starts a new run. Medals and achievements stay; another character’s upgrades clear."}</p></div></div>
    <p class="intro-bio">${escape(c.biography)}</p>
    ${c.associatedPhrase ? `<p class="tiny intro-phrase">“${escape(c.associatedPhrase)}”</p>` : ""}
    ${c.keepsake?.kind === "censored" ? `<span class="censored-keepsake"><span class="censored-icon" role="img" aria-label="Black-bar-censored novelty item">CENSORED</span><span>${escape(c.keepsake.label)}</span></span>` : ""}
    <div class="intro-traits"><p><b>STRENGTH</b>${escape(c.strength)}</p><p><b>WEAKNESS</b>${escape(c.weakness)}</p></div>
    <dl class="intro-stats">${c.statistics.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>
    <p class="intro-passive"><b>${escape(c.passive.name)}</b> · ${escape(c.passive.description)}</p>
    <p class="crash-quote">“${escape(c.crashQuote)}”</p>
    <p class="intro-john"><b>JOHN SANTOR:</b> ${escape(john)}</p>
    <div class="actions">${action("Confirm character", "confirm")}${action("Choose another", "characters", "", true)}</div>
  </section>`;
}

export function renderCampaign(ui, run) {
  const c = run.current,
    level = run.level;
  ui.root.dataset.mode = "vault-run";
  ui.eventLabel.innerHTML = "<b>01</b> SHOPPING-CART LONG JUMP";
  ui.campaignSession = run;
  ui.roundLabel.textContent =
    run.active || [S.READY, S.RESULTS].includes(run.state)
      ? `VAULT RUN · ${level.chapter === "santor-on-tour" ? "SANTOR ON TOUR" : level.chapter === "after-hours" ? "AFTER HOURS" : level.bonus ? "OVERTIME" : `${LEVELS.indexOf(level) + 1} / ${LEVELS.length}`}${run.stage ? ` · HEAT ${run.stageIndex + 1}/3` : ""}`
      : "VAULT RUN · CAMPAIGN";
  document.getElementById("session-mode").textContent = "SINGLE PLAYER";
  document.getElementById("session-players").textContent = "VAULT RUN";
  document.getElementById("standings-title").textContent = "VAULT RUN PROGRESS";
  document.getElementById("standings-subtitle").textContent =
    "BRONZE UNLOCKS THE NEXT LESSON";
  ui.standings.innerHTML = CHARACTERS.map(
    (character) =>
      `<article class="competitor${character.id === c?.id ? " current" : ""}" style="--person:${character.primaryColor}">${portrait(character)}<div class="person-info"><div class="person-name">${escape(character.name)}</div><div class="person-nick">“${escape(character.nickname)}”</div><div class="score-line"><span>LEVELS <b>${progressCount(run.save, character)} / ${LEVELS.length}</b></span><span>GOLD <b>${LEVELS.filter((l) => run.save.entry(character.id, l.id).medal === 3).length}</b></span></div></div></article>`,
  ).join("");
  const coach = document.getElementById("campaign-coach");
  coach.hidden = !run.active;
  const runStatus = document.getElementById("run-status");
  runStatus.hidden = !run.active;
  if (run.active) {
    ui.hudName.textContent = c.name.toUpperCase();
    ui.passiveStatus.textContent = c.passive.name;
    ui.passiveStatus.dataset.warning = "false";
    runStatus.textContent = `CONDITION: ${CONDITIONS[run.attemptSpec.condition]?.name || "Standard"}`;
    coach.dataset.focus = level.modifier.focus;
    coach.textContent = `${level.modifier.name} · ${level.description}`;
    return;
  }
  let html = "";
  switch (run.state) {
    case S.SELECT:
      html = `<section class="menu-panel"><p class="eyebrow">SINGLE PLAYER / TEN LEVELS</p><h2>VAULT RUN</h2><p>Choose your competitor. Each one keeps a separate record.</p><div class="campaign-characters">${CHARACTERS.map((character) => `<article style="--person:${character.primaryColor}"><div class="handoff">${portrait(character)}<div><h3>${escape(character.fullName)}</h3><p class="tiny">${escape(character.passive.name)} · ${progressCount(run.save, character)}/${LEVELS.length} levels complete</p></div></div>${action(`Choose ${character.name.split(" ")[0]}`, "select", character.id)}</article>`).join("")}</div><div class="actions">${action("Main menu", "menu", "", true)}${notice(run.save, true)}</div></section>`;
      ui.say("One competitor. Ten levels. The Vault keeps your place.");
      break;
    case S.PROFILE:
      ui.overlay.classList.add("intro-overlay");
      ui.root.dataset.introduction = "true";
      html = profile(ui, c, run);
      break;
    case S.MAP: {
      const cleared = progressCount(run.save, c);
      html = `<section class="menu-panel campaign-map-panel"><p class="eyebrow">THE SANTOR VAULT / CAMPAIGN MAP</p><div class="map-head"><h2>VAULT RUN</h2><p><b>${escape(c.fullName)}</b> · ${cleared}/${LEVELS.length} cleared</p></div>${cleared === LEVELS.length ? '<p class="subline">RUN COMPLETE · Gauntlet Overtime and Santor on Tour are open.</p>' : ""}${runNotice(run)}${notice(run.save)}${upgradeIcons(run)}<ol class="level-grid">${LEVELS.map(
        (l, index) =>
          levelTile(
            run,
            l,
            String(index + 1).padStart(2, "0"),
            index
              ? `Earn Bronze in ${LEVELS.find((previous) => previous.id === l.prerequisites[0]).name}.`
              : "",
          ),
      ).join(
        "",
      )}</ol>${bonusRow(run)}${afterHoursRow(run)}${tourRow(run)}<div class="actions compact">${action("Change character", "characters", "", true)}${action("New run", "new-run", "", true)}${action("Main menu", "menu", "", true)}${action("Reset progress", "reset", "", true)}</div>${details(`${runInventory(run)}<p class="tiny">OBJECTIVE ACHIEVEMENTS: ${Object.keys(run.runs.achievements.characters[c.id]).length} / ${OBJECTIVE_IDS.length} · kept across new runs.</p><p class="tiny">${escape(c.passive.name)} · replays keep your best medal.</p>`)}</section>`;
      ui.say(
        cleared === LEVELS.length
          ? "Ten levels complete. Overtime is optional. John is not taking questions."
          : "Your next lesson is on the board. Bronze opens the next gate.",
      );
      break;
    }
    case S.READY: {
      const number = level.bonus
        ? level.chapter === "santor-on-tour" ? "SANTOR ON TOUR" : "BONUS"
        : `LEVEL ${String(LEVELS.indexOf(level) + 1).padStart(2, "0")} / ${LEVELS.length}`;
      html = `<section class="menu-panel briefing-panel"><p class="eyebrow">${number}${run.stage ? ` · HEAT ${run.stageIndex + 1} OF 3 · ${escape(run.stage.name)}` : ""} · ${escape(c.name.toUpperCase())}</p><h2>${escape(level.name)}</h2><p class="brief-line">${escape(firstSentence(level.description))}</p>${conditionBadge(run, level)}${upgradeIcons(run)}${upgradeControls(run)}${goalList(level)}<p class="tiny">5 Perfect pushes + Perfect takeoff = Santor Sync.</p>${runNotice(run)}<p class="intro-john"><b>JOHN SANTOR:</b> ${escape(run.introduction)} ${escape(level.john.characters[c.id])}</p><div class="actions">${action("Begin jump", "confirm")}${action("Back to map", "map", "", true)}</div>${details(`<div class="handoff" style="--person:${c.primaryColor}">${portrait(c)}<div><h3>${escape(c.fullName)}</h3><p class="tiny">${escape(c.passive.name)} · ${escape(level.modifier.name)}</p></div></div><p>${escape(level.description)}</p><p><b>OBJECTIVE:</b> ${escape(level.objective)}</p>${seriesMarkup(run, level)}${challengeMarkup(run, level)}<p class="tiny">FULL MEDAL REQUIREMENTS</p>${goals(level)}${level.upgradeReward ? '<p class="tiny">Bronze earns one upgrade choice per run.</p>' : ""}${runInventory(run)}`)}</section>`;
      ui.say(run.introduction);
      break;
    }
    case S.RESULTS: {
      const s = run.lastScore,
        result = run.lastMedal;
      const flavor = s.crashed
        ? `${c.crashDescriptions ? `<p class="character-flavor">${escape(c.crashDescriptions[s.quarterTurns % c.crashDescriptions.length])}</p>` : ""}<p class="crash-quote">${escape(c.name.split(" ")[0])}: “${escape(c.crashQuote)}”</p>`
        : "";
      const next =
        result.medal > 0 &&
        LEVELS.indexOf(level) >= 0 &&
        LEVELS.indexOf(level) < LEVELS.length - 1
          ? ` · ${escape(LEVELS[LEVELS.indexOf(level) + 1].name)} unlocked`
          : "";
      html = `<section class="menu-panel results-panel"><p class="eyebrow">${escape(level.name)} / ${escape(c.name.toUpperCase())}</p><div class="campaign-award" id="campaign-award">${result.provisional ? `<span class="campaign-medal">HEAT ${run.stageIndex + 1} BANKED</span>` : medal(result.medal)}<p>${result.provisional ? `COMBINED SCORE ${run.combinedScore} · NEXT HEAT READY` : result.medal ? (level.stages ? "EARNED THIS GAUNTLET" : "EARNED THIS ATTEMPT") : "OBJECTIVE NOT YET MET"}</p><p class="tiny">${result.provisional ? "LEVEL MEDAL AFTER HEAT 3" : `${result.upgraded ? "NEW BEST" : "BEST KEPT"}: ${MEDALS[result.best.medal]}${result.best.santor ? " · SANTOR MEDAL ✓" : ""}${next}`}</p></div>${tourEnding(run, ui.cosmetics)}${scoreCard(s)}${tourResultNotes(level, result.facts)}${level.id === "open-mic" ? `<p class="subline">${crowdCue(s) === "boo" ? "BOOO!" : "CHEERS!"} · APPLAUSE ${applause(s.tricks.unique, s.crashed)}% · ${s.tricks.unique} UNIQUE TRICKS</p>` : ""}${level.stages && !result.provisional ? `<p class="subline">GAUNTLET COMBINED SCORE · ${run.combinedScore}</p>` : ""}${result.provisional ? "" : goalList(level, result.facts)}${!result.provisional && result.medal > 0 && level.id === "the-santor-gauntlet" ? '<p class="subline">CAMPAIGN COMPLETE · OVERTIME + AFTER HOURS + SANTOR ON TOUR UNLOCKED</p>' : ""}${runNotice(run)}${notice(run.save)}${flavor}${carnageDetails(s)}<div class="actions">${action(!run.levelFinished ? `Continue to heat ${run.stageIndex + 2}` : run.runs.run?.pendingLevel ? "Choose an upgrade" : "Return to map", "confirm")}${action("RETRY (R)", "retry")}<button type="button" class="btn secondary" data-replay>WATCH REPLAY</button></div>${scoreBreakdown(s, `${level.stages ? heatLedger(run) : ""}${level.arena.cargo ? `<p class="subline">CARGO: ${result.facts.cargoRetained ? "MUG DELIVERED · secured at finish" : "MUG RESIGNED · replacement required"}</p>` : ""}${challengeMarkup(run, level, true)}${result.provisional ? "" : `<p class="tiny">FULL MEDAL REQUIREMENTS</p>${goals(level, result.facts)}`}${runInventory(run)}${run.runs.run?.pendingLevel || level.stages ? `<p class="tiny">Retry${run.runs.run?.pendingLevel ? " after choosing or skipping your upgrade" : ""}${level.stages ? " · restarts at heat 1" : ""}.</p>` : ""}`)}</section>`;
      ui.say(
        result.provisional
          ? `Heat ${run.stageIndex + 1} banked. ${run.combinedScore} points. ${run.stageIndex ? "THE LEDGER IS GETTING LOUDER." : "Please retain the cart for the next examination."}`
          : level.id === "rooftop-delivery" && s.crashCause === "pit-fall" ? ROOFTOP_FALL_LINE
          : level.id === "grand-reopening" && result.medal > 0 ? TOUR_CLOSING
          : level.john.results[
              ["none", "bronze", "silver", "gold"][result.medal]
            ],
      );
      if (s.crashCause) ui.caption(s.crashCause, c, run.round);
      break;
    }
    case S.UPGRADES:
      html = upgradeChoices(run, action);
      ui.say("One upgrade. Choose from the available specifications.");
      break;
    case S.NEW_RUN:
      html = `<section class="menu-panel"><p class="eyebrow">VAULT RUN / FRESH START</p><h2>START A NEW RUN?</h2><p>This clears temporary upgrades, refreshes the first three lessons’ seeded plans, and restores level rewards. Later levels keep their announced conditions. Your medals, unlocks, and objective achievements stay.</p>${runNotice(run)}<div class="actions">${action("Cancel — keep this run", "map")}${action("Start new run", "new-run-confirm", "", true)}</div></section>`;
      break;
    case S.RESET:
      html = `<section class="menu-panel"><p class="eyebrow">VAULT RUN / CONFIRM RESET</p><h2>RESET CAMPAIGN PROGRESS?</h2><p>This clears Vault Run medals, temporary upgrades, and unlocks for <b>Jake, Brandon, and Owen</b> on this browser. Achievements, objective badges, Party Tournament, and your sound preference are unchanged.</p><p class="tiny">This cannot be undone.</p><div class="actions">${action("Cancel — keep progress", "map")}${action("Confirm campaign reset", "reset-confirm", "", true)}</div></section>`;
      break;
  }
  ui.overlay.innerHTML = html;
  const preferred =
    run.state === S.SELECT && run.save.data.selectedCharacter
      ? ui.overlay.querySelector(
          `[data-campaign="select"][data-value="${run.save.data.selectedCharacter}"]`,
        )
      : run.state === S.MAP
        ? ui.overlay.querySelector('.level-tile[data-medal="0"]:not(:disabled)')
        : null;
  (preferred || ui.overlay.querySelector("button:not(:disabled)"))?.focus({
    preventScroll: true,
  });
}

export function updateCampaignCoach(world, run) {
  if (!run?.active) return;
  const coach = document.getElementById("campaign-coach"),
    skills = world.skills.metrics();
  let text;
  switch (run.level.modifier.focus) {
    case "factory":
      text = !world.landed
        ? "Recover from the Wrate Issue, aim far along the belt and brace. Four seconds backwards; keep clear of the return chute."
        : world.leftConveyor ? "OFF BELT · The return chute is a pit. Retry and aim farther along the belt."
          : `${factoryCycleRemaining(world).toFixed(1)} s until belt stops · Stay aboard until rest. First-contact distance is already banked.`;
      break;
    case "warehouse": {
      const count = world.propFacts().propsFallen;
      text = `${count}/36 boxes down · Silver 10 · Gold 20 + attached · Santor 30 + attached + Clean${count ? " · OWEN: I ordered these." : ""}`;
      break;
    }
    case "night-road": {
      const verse = roadVerse(world);
      text = `${verse >= 0 ? ROAD_POEM[verse] : "Three bumps. Three verses. Watch the push meter."} · ${skills.pushCounts.Miss} Misses`;
      break;
    }
    case "library":
      text = world.impactLoudness == null
        ? "Clear the books; try Good takeoff for a quieter arc. Brace near contact. Quiet means noise ≤100%."
        : `${libraryTooLoud(world) ? "shhh! too loud for Gold" : "Quiet impact"} · ${noisePercent(world)}% noise · ${world.propFacts().propsFallen} books knocked over`;
      break;
    case "push":
      text = world.launched
        ? `Takeoff: ${skills.takeoffGrade} · Gold needs Perfect takeoff. Finish the attempt to bank it.`
        : `${skills.pushCounts.Good + skills.pushCounts.Perfect}/2 Good-or-better pushes · Tap in green, release, wait for the next beat. Holding gives one push.`;
      break;
    case "brace":
      text = !world.launched
        ? "Get airborne, then aim wheels down. Save your one BRACE for near contact."
        : world.landed
          ? `${skills.braceGrade} · Gold also needs a Clean landing.`
          : world.skills.braceAt !== null
            ? "Brace committed. Keep the wheels down; the actual contact decides the grade."
            : "Watch the landing meter. Tap DOWN / S or BRACE in green; bracing early reduces air control.";
      break;
    case "tricks": {
      const names = [...world.tricks.unique].map(
        (id) => TRICK_CONFIG.tricks[id].name,
      );
      text = names.length
        ? `${names.length}/${run.level.gold.all.uniqueTricks || 2} different tricks · ${names.slice(0, 2).join(" + ")}${names.length > 2 ? " + more" : ""} · Land Clean or Scrappy for ${run.level.id === "open-mic" ? "Gold" : "Silver / Gold"}.`
        : "Hold LEFT / RIGHT to complete a full flip, then counter-steer to wheels down. Partial spins do not count.";
      break;
    }
    case "cargo":
      text = world.cargoLost
        ? "MUG RESIGNED · the orange box is free. Finish to bank Bronze; retry to deliver it."
        : `CARGO SECURED · ${world.cargoStrainTime > 0 ? "CORD STRAINING — return toward level!" : "Stay near level, then brace. Gold needs a Clean landing."}`;
      break;
    case "wind":
      text = `CROSSWIND → · aim for the green ${OBJECTIVES["landing-zone"].minimum}–${OBJECTIVES["landing-zone"].maximum} m zone. Gold needs the rider attached. Try Good takeoff if you overshoot.`;
      break;
    case "runway":
      text = `${skills.pushCounts.Miss} Misses · ${skills.pushCounts.Good + skills.pushCounts.Perfect} Good-or-better pushes · Use the rhythm meter over the marked concrete repairs.`;
      break;
    case "ice":
      text = `${skills.braceGrade} · Ice stays slippery after contact. Gold needs Perfect Brace and a Clean landing.`;
      break;
    case "freezer":
      text = world.landed
        ? `${world.firstLandingOnTop ? world.firstLandingPiece?.sign || "Floor contact" : "Missed the lid"} · ${skills.braceGrade} · Keep the wheels underneath you.`
        : "Five raised lids; gaps are pits. Aim wheels down, then brace before the lid. Lid 5 is farthest.";
      break;
    case "speed":
      text = `${world.skills.runwayCapReached ? "MAX RUNWAY SPEED REACHED" : "Build to maximum speed with Perfect pushes"} · Counter-steer the announced pulse, then land attached.`;
      break;
    case "gauntlet":
      text = `HEAT ${run.stageIndex + 1}/3 · ${run.stage.name} · ${run.combinedScore} points banked · ${run.introduction}`;
      break;
    default:
      text = run.level.objective;
  }
  updateRunStatus(world);
  const message = `${run.level.modifier.name} · ${text}`;
  if (coach.textContent !== message) coach.textContent = message;
}
