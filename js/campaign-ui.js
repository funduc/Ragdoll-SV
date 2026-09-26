import { CHARACTERS } from "./characters.js";
import { CampaignState as S } from "./campaign.js";
import {
  LEVELS,
  HARD_GAUNTLET,
  MEDALS,
  meetsThreshold,
} from "./campaign-levels.js";
import { escape, portrait, scoreDetails } from "./ui-content.js";
import {
  runInventory,
  runNotice,
  challengeMarkup,
  upgradeChoices,
  updateRunStatus,
} from "./run-ui.js";
import { CONDITIONS, OBJECTIVE_IDS } from "./run-config.js";
import { TRICK_CONFIG } from "./trick-config.js";

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
const notice = (save) =>
  `<p class="tiny campaign-save" role="status">${escape(save.notice || "Saved on this browser · separate progress for each character.")}</p>`;
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
function overtimeMarkup(run) {
  const level = HARD_GAUNTLET,
    unlocked = run.isUnlocked(level),
    best = run.save.entry(run.current.id, level.id);
  return `<article class="campaign-level${unlocked ? "" : " locked"}" data-level="${level.id}"><h3>OPTIONAL · ${escape(level.name)}</h3>${medal(best.medal)}${best.santor ? '<span class="campaign-medal">SANTOR ✓</span>' : ""}<p>${escape(level.description)}</p>${goals(level)}${seriesMarkup(run, level)}<div class="actions">${action(unlocked ? "Play Gauntlet Overtime" : "Beat the Santor Gauntlet to unlock", "level", level.id, false, !unlocked)}</div></article>`;
}

function profile(ui, c, run) {
  const john = ui.commentator.pick("introduction", c, "qualifying");
  ui.say(john);
  return `<section class="menu-panel intro-card" style="--person:${c.primaryColor}">
    ${runNotice(run)}<p class="eyebrow">VAULT RUN / CONFIRM YOUR COMPETITOR <span class="intro-countdown">PRESS ENTER WHEN READY.</span></p>
    <div class="handoff">${portrait(c)}<div><h2>${escape(c.fullName)}</h2><p class="tiny">${run.runs.run?.characterId === c.id ? "Resume your current run and upgrades." : "Start a new run as this competitor. Temporary upgrades and pending rewards from a different character will clear; medals and achievements remain."}</p></div></div>
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
  ui.campaignSession = run;
  ui.roundLabel.textContent =
    run.active || [S.READY, S.RESULTS].includes(run.state)
      ? `VAULT RUN · ${level.bonus ? "OVERTIME" : `${LEVELS.indexOf(level) + 1} / ${LEVELS.length}`}${run.stage ? ` · HEAT ${run.stageIndex + 1}/3` : ""}`
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
      html = `<section class="menu-panel"><p class="eyebrow">SINGLE PLAYER / TEN LEVELS</p><h2>VAULT RUN</h2><p>Choose your competitor. Earn Bronze to unlock the next lesson. Return for Silver and Gold; every character has a separate record. Aim for 20–30 minutes including practice and retries.</p><div class="campaign-characters">${CHARACTERS.map((character) => `<article style="--person:${character.primaryColor}"><div class="handoff">${portrait(character)}<div><h3>${escape(character.fullName)}</h3><p class="tiny">${escape(character.passive.name)} · ${progressCount(run.save, character)}/${LEVELS.length} levels complete</p></div></div>${action(`Choose ${character.name.split(" ")[0]}`, "select", character.id)}</article>`).join("")}</div>${notice(run.save)}<div class="actions">${action("Main menu", "menu", "", true)}</div></section>`;
      ui.say("One competitor. Ten levels. The Vault keeps your place.");
      break;
    case S.PROFILE:
      ui.overlay.classList.add("intro-overlay");
      ui.root.dataset.introduction = "true";
      html = profile(ui, c, run);
      break;
    case S.MAP:
      html = `<section class="menu-panel campaign-map-panel"><p class="eyebrow">THE SANTOR VAULT / CAMPAIGN MAP</p><h2>VAULT RUN</h2><p><b>${escape(c.fullName)}</b> · ${escape(c.passive.name)}</p>${progressCount(run.save, c) === LEVELS.length ? '<p class="subline">RUN COMPLETE · All ten levels cleared. Gauntlet Overtime is open. Replay levels to upgrade medals.</p>' : '<p class="tiny">Bronze unlocks the next level. Perfect pushes count toward Good-or-better. Replays keep your highest medal. The condition and optional objective stay fixed for this run.</p>'}${runNotice(run)}${runInventory(run)}<p class="tiny">OBJECTIVE ACHIEVEMENTS: ${Object.keys(run.runs.achievements.characters[c.id]).length} / ${OBJECTIVE_IDS.length} · preserved across new runs.</p><ol class="campaign-map">${LEVELS.map(
        (l, index) => {
          const unlocked = run.isUnlocked(l),
            best = run.save.entry(c.id, l.id);
          return `<li class="campaign-level${unlocked ? "" : " locked"}" data-level="${l.id}"><div class="campaign-level-heading"><h3><span>${String(index + 1).padStart(2, "0")}</span> ${escape(l.name)}</h3>${medal(best.medal)}${best.santor ? '<span class="campaign-medal">SANTOR ✓</span>' : ""}</div><p>${escape(l.description)}</p><p class="tiny">COACHING: ${escape(l.modifier.name)}${l.upgradeReward ? " · Bronze earns one upgrade choice per run" : ""}</p>${goals(l)}${seriesMarkup(run, l)}${challengeMarkup(run, l)}<div class="actions">${action(unlocked ? (best.medal ? "Replay level" : "Play level") : "Locked", "level", l.id, false, !unlocked)}${!unlocked ? `<span class="tiny">Earn Bronze in ${escape(LEVELS.find((previous) => previous.id === l.prerequisites[0]).name)}.</span>` : ""}</div></li>`;
        },
      ).join(
        "",
      )}</ol>${overtimeMarkup(run)}${notice(run.save)}<div class="actions">${action("New run", "new-run", "", true)}${action("Change character", "characters", "", true)}${action("Main menu", "menu", "", true)}${action("Reset campaign progress", "reset", "", true)}</div></section>`;
      ui.say(
        progressCount(run.save, c) === LEVELS.length
          ? "Ten levels complete. Overtime is optional. John is not taking questions."
          : "Your next lesson is on the board. Bronze opens the next gate.",
      );
      break;
    case S.READY:
      html = `<section class="menu-panel"><p class="eyebrow">VAULT RUN / ${level.bonus ? "OVERTIME" : `${LEVELS.indexOf(level) + 1} OF ${LEVELS.length}`}${run.stage ? ` / HEAT ${run.stageIndex + 1} OF 3 · ${escape(run.stage.name)}` : ""}</p><h2>${escape(level.name)}</h2><div class="handoff" style="--person:${c.primaryColor}">${portrait(c)}<div><h3>${escape(c.fullName)}</h3><p class="tiny">${escape(c.passive.name)} · ${escape(level.modifier.name)}</p></div></div><p>${escape(level.description)}</p><p><b>OBJECTIVE:</b> ${escape(level.objective)}</p>${seriesMarkup(run, level)}${runNotice(run)}${challengeMarkup(run, level)}${goals(level)}${runInventory(run)}<p class="tiny">Tap SPACE / ↑ or PUSH on the rhythm meter. Release between pushes. One push in the green takeoff zone. LEFT / RIGHT or A / D rotates; DOWN / S or BRACE braces once near landing.</p><p class="intro-john"><b>JOHN SANTOR:</b> ${escape(run.introduction)} ${escape(level.john.characters[c.id])}</p><div class="actions">${action("Begin jump", "confirm")}${action("Back to map", "map", "", true)}</div></section>`;
      ui.say(run.introduction);
      break;
    case S.RESULTS: {
      const s = run.lastScore,
        result = run.lastMedal;
      const flavor = s.crashed
        ? `${c.crashDescriptions ? `<p class="character-flavor">${escape(c.crashDescriptions[s.quarterTurns % c.crashDescriptions.length])}</p>` : ""}<p class="crash-quote">${escape(c.name.split(" ")[0])}: “${escape(c.crashQuote)}”</p>`
        : "";
      html = `<section class="menu-panel"><p class="eyebrow">VAULT RUN / ATTEMPT COMPLETE</p><h2>${escape(level.name)}</h2><p>${escape(c.fullName)}</p><div class="campaign-award" id="campaign-award">${result.provisional ? `<span class="campaign-medal">HEAT ${run.stageIndex + 1} BANKED</span>` : medal(result.medal)}<p>${result.provisional ? "NEXT HEAT REQUIRES CONFIRMATION" : result.medal ? (level.stages ? "EARNED THIS GAUNTLET" : "EARNED THIS ATTEMPT") : "OBJECTIVE NOT YET MET"}</p><p class="tiny">${result.provisional ? "LEVEL MEDAL AFTER HEAT 3 · BEST KEPT" : result.upgraded ? "NEW BEST" : "BEST KEPT"}: ${MEDALS[result.best.medal]}${result.best.santor ? " · SANTOR MEDAL ✓" : ""}${result.medal > 0 && LEVELS.indexOf(level) >= 0 && LEVELS.indexOf(level) < LEVELS.length - 1 ? ` · ${escape(LEVELS[LEVELS.indexOf(level) + 1].name)} unlocked` : ""}</p></div>${level.stages ? heatLedger(run) : ""}${result.provisional ? "" : goals(level, result.facts)}${!result.provisional && result.medal > 0 && level.id === "the-santor-gauntlet" ? '<p class="subline">CAMPAIGN COMPLETE · GAUNTLET OVERTIME UNLOCKED</p>' : ""}${level.arena.cargo ? `<p class="subline">CARGO: ${result.facts.cargoRetained ? "MUG DELIVERED · secured at finish" : "MUG RESIGNED · replacement required"}</p>` : ""}${challengeMarkup(run, level, true)}${runNotice(run)}<p class="subline">${escape(s.reason)} · ${s.landingQuality.toUpperCase()} · ${s.attached ? "RIDER ATTACHED" : "RIDER DETACHED"}</p>${flavor}${scoreDetails(s)}${runInventory(run)}${notice(run.save)}<div class="actions">${action(!run.levelFinished ? `Continue to heat ${run.stageIndex + 2}` : run.runs.run?.pendingLevel ? "Choose an upgrade" : "Return to map", "confirm")}${action("RETRY", "retry")}<button type="button" class="btn secondary" data-replay>WATCH REPLAY</button></div><p class="tiny">R: retry this level immediately${run.runs.run?.pendingLevel ? " after choosing or skipping your upgrade" : ""}${level.stages ? " · restarts at heat 1" : ""}.</p></section>`;
      ui.say(
        result.provisional
          ? `Heat ${run.stageIndex + 1} banked. ${run.combinedScore} points. ${run.stageIndex ? "THE LEDGER IS GETTING LOUDER." : "Please retain the cart for the next examination."}`
          : level.john.results[
              ["none", "bronze", "silver", "gold"][result.medal]
            ],
      );
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
        ? `${names.length}/${run.level.gold.all.uniqueTricks || 2} different tricks · ${names.slice(0, 2).join(" + ")}${names.length > 2 ? " + more" : ""} · Land Clean or Scrappy for Silver / Gold.`
        : "Hold LEFT / RIGHT to complete a full flip, then counter-steer to wheels down. Partial spins do not count.";
      break;
    }
    case "cargo":
      text = world.cargoLost
        ? "MUG RESIGNED · the orange box is free. Finish to bank Bronze; retry to deliver it."
        : `CARGO SECURED · ${world.cargoStrainTime > 0 ? "CORD STRAINING — return toward level!" : "Stay near level, then brace. Gold needs a Clean landing."}`;
      break;
    case "wind":
      text =
        "CROSSWIND → · aim for the green 30–45 m zone. Gold needs the rider attached. Try Good takeoff if you overshoot.";
      break;
    case "runway":
      text = `${skills.pushCounts.Miss} Misses · ${skills.pushCounts.Good + skills.pushCounts.Perfect} Good-or-better pushes · Use the rhythm meter over the marked concrete repairs.`;
      break;
    case "ice":
      text = `${skills.braceGrade} · Ice stays slippery after contact. Gold needs Perfect Brace and a Clean landing.`;
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
