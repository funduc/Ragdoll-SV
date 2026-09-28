import { CONDITIONS, OBJECTIVES, UPGRADES } from "./run-config.js";
import { escape } from "./ui-content.js";

export function runInventory(run) {
  const counts = run.runs.run?.upgrades || {};
  const entries = Object.entries(UPGRADES).filter(([id]) => counts[id]);
  return `<section class="run-inventory" aria-label="Current run upgrades"><h3>CURRENT RUN UPGRADES · ${entries.reduce((sum, [id]) => sum + counts[id], 0)}</h3>${entries.length ? `<ul>${entries.map(([id, upgrade]) => `<li><b>${escape(upgrade.name)} · ${counts[id]}/${upgrade.limit}</b><span>${escape(upgrade.description)}</span></li>`).join("")}</ul>` : '<p class="tiny">No upgrades yet. Earn Bronze in levels marked with an upgrade reward. Each grants one choice per run.</p>'}<p class="tiny">Temporary · kept through replays and refresh · cleared by New run or a different character.</p></section>`;
}
export function runNotice(run) {
  if (run.developer)
    return `<p class="run-dev">DETERMINISTIC TEST RUN · SEED ${run.runs.run?.seed ?? run.developer.seed} · CAMPAIGN SAVES DISABLED</p>`;
  return run.runs.notice
    ? `<p class="tiny" role="status">${escape(run.runs.notice)}</p>`
    : "";
}
const planFor = (run, level) =>
  run.runs.plan(
    level.id,
    run.developer,
    run.level === level && run.state !== "campaign-map" ? run.stageIndex : 0,
  );
// Briefing badge: an icon plus a few words. Full descriptions stay in Details.
// U+FE0E keeps the symbols as plain text glyphs rather than emoji.
export const CONDITION_BADGES = {
  crosswind: ["➜", "pushes you right"],
  "icy-ramp": ["❄", "slippery everywhere"],
  "heavy-cart": ["⚓", "slower, but steadier"],
  "boost-strip": ["⚡", "free +3 speed"],
  "wrate-issue": ["⚠", "forward wobble mid-air"],
  "low-gravity": ["⇡", "40% less gravity"],
  tailwind: ["»", "pushes you forward"],
  "shifting-wind": ["⇄", "gusts flip mid-air"],
};
export function conditionBadge(run, level) {
  const plan = planFor(run, level);
  if (!plan) return "";
  const condition = CONDITIONS[plan.condition];
  const [icon, words] = condition
    ? CONDITION_BADGES[plan.condition] || ["◆", ""]
    : ["✓", "no surprises"];
  return `<p class="condition-badge" data-condition="${escape(plan.condition || "standard")}"><span class="condition-icon" aria-hidden="true">${icon}&#xFE0E;</span><b>${escape(condition?.name || "Standard")}</b>${words ? ` · ${escape(words)}` : ""}</p>`;
}
export function challengeMarkup(run, level, result = false) {
  const plan = planFor(run, level);
  if (!plan) return "";
  const condition = CONDITIONS[plan.condition],
    objective = OBJECTIVES[plan.objective];
  const earned =
    run.runs.achievements.characters[run.current.id]?.[plan.objective];
  return `<div class="run-challenge"><p><b>CONDITION: ${escape(condition?.name || "Standard")}</b><span>${escape(condition?.description || "No additional forces or traction changes.")}</span></p><p><b>OPTIONAL: ${escape(objective.name)}</b><span>${escape(objective.description)}</span>${result ? `<strong class="objective-outcome" data-objective-result="${run.lastObjective?.passed ? "success" : "failure"}">${run.lastObjective?.passed ? "SUCCESS" : "NOT MET"}</strong><span>${escape(run.lastObjective?.measured || "Attempt not valid")}</span><small>${run.newAchievement ? "NEW ACHIEVEMENT · retained for this character" : earned ? "Previously earned achievement retained" : "Optional objectives do not block medals or unlocks."}</small>` : `<small>${earned ? "Achievement already earned · replay freely" : "Optional achievement · does not block level progression"}</small>`}</p></div>`;
}
export function upgradeChoices(run, action) {
  return `<section class="menu-panel"><p class="eyebrow">VAULT RUN / ONE REWARD</p><h2>CHOOSE AN UPGRADE</h2><p>Pick one. The others expire.</p>${runNotice(run)}<div class="upgrade-choices">${run.runs.run.offers
    .map((id) => {
      const item = UPGRADES[id],
        count = run.runs.run.upgrades[id];
      return `<article><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><p class="tiny">${count} → ${count + 1} / ${item.limit} stacks</p>${action(`Choose ${item.name}`, "upgrade", id)}</article>`;
    })
    .join(
      "",
    )}</div><div class="actions">${action("Keep factory settings — skip reward", "skip-upgrade")}</div><details class="brief-details"><summary>Details</summary><p class="tiny">Replaying this level cannot grant another reward during this run.</p>${runInventory(run)}</details></section>`;
}
export function updateRunStatus(world) {
  const node = document.getElementById("run-status");
  if (!node || !world.runEffects) return;
  const effects = world.runEffects;
  const extra = effects.upgrades["emergency-stabilizer"]
    ? world.elapsed < effects.stabilizerUntil
      ? " · STABILIZER ACTIVE"
      : effects.stabilizerUsed
        ? " · Stabilizer spent"
        : " · Stabilizer ready"
    : "";
  const message = effects.status(world) + extra;
  if (node.textContent !== message) node.textContent = message;
}
