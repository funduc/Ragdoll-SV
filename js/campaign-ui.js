import { CHARACTERS } from "./characters.js";
import { CampaignState as S } from "./campaign.js";
import { LEVELS, MEDALS, meetsThreshold } from "./campaign-levels.js";
import { escape, portrait, scoreDetails } from "./ui-content.js";
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
    .join("")}</ul>`;
const notice = (save) =>
  `<p class="tiny campaign-save" role="status">${escape(save.notice || "Saved on this browser · separate progress for each character.")}</p>`;
const progressCount = (save, c) =>
  LEVELS.filter((l) => save.entry(c.id, l.id).medal > 0).length;

function profile(ui, c) {
  const john = ui.commentator.pick("introduction", c, "qualifying");
  ui.say(john);
  return `<section class="menu-panel intro-card" style="--person:${c.primaryColor}">
    <p class="eyebrow">VAULT RUN / CONFIRM YOUR COMPETITOR <span class="intro-countdown">PRESS ENTER WHEN READY.</span></p>
    <div class="handoff">${portrait(c)}<div><h2>${escape(c.fullName)}</h2><p class="tiny">Your competitor for all three lessons.</p></div></div>
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
      ? `VAULT RUN · ${LEVELS.indexOf(level) + 1} / ${LEVELS.length}`
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
  if (run.active) {
    ui.hudName.textContent = c.name.toUpperCase();
    ui.passiveStatus.textContent = c.passive.name;
    ui.passiveStatus.dataset.warning = "false";
    coach.dataset.focus = level.modifier.focus;
    coach.textContent = `${level.modifier.name} · ${level.description}`;
    return;
  }
  let html = "";
  switch (run.state) {
    case S.SELECT:
      html = `<section class="menu-panel"><p class="eyebrow">SINGLE PLAYER / THREE LESSONS</p><h2>VAULT RUN</h2><p>Choose your competitor. Earn Bronze to unlock the next lesson. Return for Silver and Gold; every character has a separate record.</p><div class="campaign-characters">${CHARACTERS.map((character) => `<article style="--person:${character.primaryColor}"><div class="handoff">${portrait(character)}<div><h3>${escape(character.fullName)}</h3><p class="tiny">${escape(character.passive.name)} · ${progressCount(run.save, character)}/3 lessons complete</p></div></div>${action(`Choose ${character.name.split(" ")[0]}`, "select", character.id)}</article>`).join("")}</div>${notice(run.save)}<div class="actions">${action("Main menu", "menu", "", true)}</div></section>`;
      ui.say("One competitor. Three lessons. The Vault keeps your place.");
      break;
    case S.PROFILE:
      ui.overlay.classList.add("intro-overlay");
      ui.root.dataset.introduction = "true";
      html = profile(ui, c);
      break;
    case S.MAP:
      html = `<section class="menu-panel campaign-map-panel"><p class="eyebrow">THE SANTOR VAULT / CAMPAIGN MAP</p><h2>VAULT RUN</h2><p><b>${escape(c.fullName)}</b> · ${escape(c.passive.name)}</p>${run.complete ? '<p class="subline">RUN COMPLETE · All three lessons cleared. Replay any level to upgrade your medals.</p>' : '<p class="tiny">Bronze unlocks the next level. Perfect pushes count toward Good-or-better. Replays keep your highest medal.</p>'}<ol class="campaign-map">${LEVELS.map(
        (l, index) => {
          const unlocked = run.isUnlocked(l),
            best = run.save.entry(c.id, l.id);
          return `<li class="campaign-level${unlocked ? "" : " locked"}" data-level="${l.id}"><div class="campaign-level-heading"><h3><span>${String(index + 1).padStart(2, "0")}</span> ${escape(l.name)}</h3>${medal(best.medal)}</div><p>${escape(l.description)}</p><p class="tiny">ACTIVE MODIFIER: ${escape(l.modifier.name)} · live coaching, standard physics</p>${goals(l)}<div class="actions">${action(unlocked ? (best.medal ? "Replay level" : "Play level") : "Locked", "level", l.id, false, !unlocked)}${!unlocked ? `<span class="tiny">Earn Bronze in ${escape(LEVELS.find((previous) => previous.id === l.prerequisites[0]).name)}.</span>` : ""}</div></li>`;
        },
      ).join(
        "",
      )}</ol>${notice(run.save)}<div class="actions">${action("Change character", "characters", "", true)}${action("Main menu", "menu", "", true)}${action("Reset campaign progress", "reset", "", true)}</div></section>`;
      ui.say(
        run.complete
          ? "Three lessons complete. Gold medals remain open to negotiation."
          : "Your next lesson is on the board. Bronze opens the next gate.",
      );
      break;
    case S.READY:
      html = `<section class="menu-panel"><p class="eyebrow">VAULT RUN / ${LEVELS.indexOf(level) + 1} OF ${LEVELS.length}</p><h2>${escape(level.name)}</h2><div class="handoff" style="--person:${c.primaryColor}">${portrait(c)}<div><h3>${escape(c.fullName)}</h3><p class="tiny">${escape(c.passive.name)} · ${escape(level.modifier.name)}</p></div></div><p>${escape(level.description)}</p>${goals(level)}<p class="tiny">Tap SPACE / ↑ or PUSH on the rhythm meter. Release between pushes. One push in the green takeoff zone. LEFT / RIGHT or A / D rotates; DOWN / S or BRACE braces once near landing.</p><p class="intro-john"><b>JOHN SANTOR:</b> ${escape(level.john.introduction)}</p><div class="actions">${action("Begin jump", "confirm")}${action("Back to map", "map", "", true)}</div></section>`;
      ui.say(level.john.introduction);
      break;
    case S.RESULTS: {
      const s = run.lastScore,
        result = run.lastMedal;
      const flavor = s.crashed
        ? `${c.crashDescriptions ? `<p class="character-flavor">${escape(c.crashDescriptions[s.quarterTurns % c.crashDescriptions.length])}</p>` : ""}<p class="crash-quote">${escape(c.name.split(" ")[0])}: “${escape(c.crashQuote)}”</p>`
        : "";
      html = `<section class="menu-panel"><p class="eyebrow">VAULT RUN / ATTEMPT COMPLETE</p><h2>${escape(level.name)}</h2><p>${escape(c.fullName)}</p><div class="campaign-award" id="campaign-award">${medal(result.medal)}<p>${result.medal ? "EARNED THIS ATTEMPT" : "OBJECTIVE NOT YET MET"}</p><p class="tiny">${result.upgraded ? "NEW BEST" : "BEST KEPT"}: ${MEDALS[result.best.medal]}${result.medal > 0 && LEVELS.indexOf(level) < LEVELS.length - 1 ? ` · ${escape(LEVELS[LEVELS.indexOf(level) + 1].name)} unlocked` : ""}</p></div>${goals(level, result.facts)}<p class="subline">${escape(s.reason)} · ${s.landingQuality.toUpperCase()} · ${s.attached ? "RIDER ATTACHED" : "RIDER DETACHED"}</p>${flavor}${scoreDetails(s)}${notice(run.save)}<div class="actions">${action("Return to map", "confirm")}</div></section>`;
      ui.say(
        level.john.results[["none", "bronze", "silver", "gold"][result.medal]],
      );
      break;
    }
    case S.RESET:
      html = `<section class="menu-panel"><p class="eyebrow">VAULT RUN / CONFIRM RESET</p><h2>RESET CAMPAIGN PROGRESS?</h2><p>This clears Vault Run medals and unlocks for <b>Jake, Brandon, and Owen</b> on this browser. Party Tournament and your sound preference are unchanged.</p><p class="tiny">This cannot be undone.</p><div class="actions">${action("Cancel — keep progress", "map")}${action("Confirm campaign reset", "reset-confirm", "", true)}</div></section>`;
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
        ? `${names.length}/2 different tricks · ${names.slice(0, 2).join(" + ")}${names.length > 2 ? " + more" : ""} · Land Clean or Scrappy for Silver / Gold.`
        : "Hold LEFT / RIGHT to complete a full flip, then counter-steer to wheels down. Partial spins do not count.";
      break;
    }
  }
  const message = `${run.level.modifier.name} · ${text}`;
  if (coach.textContent !== message) coach.textContent = message;
}
