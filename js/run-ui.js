import { CONDITIONS, OBJECTIVES, UPGRADES } from "./run-config.js";
import { escape } from "./ui-content.js";
import { upgradeIcon } from "./upgrade-art.js";

// Popovers use the browser's top layer, escaping the scrolling map's stacking context.
export function installUpgradeDetails(root, env = window) {
  let active = null;
  const close = () => {
    if (!active) return;
    const detail = active; active = null;
    if (detail.isConnected) detail.querySelector("div").hidePopover?.();
    detail.open = false;
  };
  const position = () => {
    if (!active) return;
    const panel = active.querySelector("div"), box = active.querySelector("summary").getBoundingClientRect();
    const viewportWidth = Math.min(env.innerWidth, root.ownerDocument.documentElement.clientWidth);
    const margin = 8, width = Math.min(280, viewportWidth - margin * 2);
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${env.innerHeight - margin * 2}px`;
    const height = panel.getBoundingClientRect().height;
    panel.style.left = `${Math.max(margin, Math.min(box.left, viewportWidth - width - margin))}px`;
    panel.style.top = `${Math.max(margin, Math.min(box.bottom + 6, env.innerHeight - height - margin))}px`;
  };
  const toggle = event => {
    const detail = event.target;
    if (!detail.matches?.(".owned-upgrade")) return;
    if (!detail.open) { if (active === detail) close(); return; }
    if (active !== detail) close();
    active = detail;
    const panel = detail.querySelector("div");
    panel.classList.add("upgrade-popover");
    panel.setAttribute("popover", "manual");
    panel.showPopover?.();
    position();
  };
  const outside = event => { if (active && !active.contains(event.target)) close(); };
  const key = event => {
    if (event.key === "Escape" && active) { event.preventDefault(); close(); }
  };
  root.addEventListener("toggle", toggle, true);
  env.addEventListener("pointerdown", outside);
  env.addEventListener("keydown", key);
  env.addEventListener("resize", position);
  // Close before a scrolled icon can leave its detached panel behind.
  root.addEventListener("scroll", close, true);
  return () => {
    close();
    root.removeEventListener("toggle", toggle, true);
    root.removeEventListener("scroll", close, true);
    env.removeEventListener("pointerdown", outside);
    env.removeEventListener("keydown", key);
    env.removeEventListener("resize", position);
  };
}

const stackPips = (count, limit) => `<span class="upgrade-pips" aria-label="${count} of ${limit} stacks owned">${"●".repeat(count)}${"○".repeat(limit - count)}</span>`;
export function upgradeIcons(run, counts = run.equipped || run.runs.run?.upgrades || {}) {
  const entries = Object.entries(UPGRADES).filter(([id]) => counts[id]);
  if (!entries.length) return "";
  return `<div class="owned-upgrades" aria-label="Owned upgrades">${entries.map(([id, item]) => `<details class="owned-upgrade" name="owned-upgrades"><summary title="${escape(item.name)} · ${counts[id]}/${item.limit}" aria-label="${escape(item.name)}: ${counts[id]} of ${item.limit} stacks. Details">${upgradeIcon(id)}${stackPips(counts[id], item.limit)}</summary><div><b>${escape(item.shortName)}</b><p>${escape(item.description)}</p></div></details>`).join("")}</div>`;
}
export function upgradeControls(run) {
  const n = run.equipped || run.runs.run?.upgrades || {}, hints = [];
  if (n["rocket-booster"]) hints.push("In air: Space / Up or BOOST fires once.");
  if (n["air-brake"]) hints.push("Early Down / BRACE tap brakes once; tap again near landing to brace.");
  if (n.focus) hints.push("5 Perfect pushes in a row slows the takeoff approach.");
  return hints.length ? `<p class="tiny upgrade-controls">${hints.join(" ")}</p>` : "";
}

export function runInventory(run) {
  const counts = run.equipped || run.runs.run?.upgrades || {};
  const entries = Object.entries(UPGRADES).filter(([id]) => counts[id]);
  return `<section class="run-inventory" aria-label="Current run upgrades"><h3>EQUIPPED GARAGE · ${entries.reduce((sum, [id]) => sum + counts[id], 0)}</h3>${entries.length ? `<ul>${entries.map(([id, upgrade]) => `<li><b>${escape(upgrade.name)} · ${counts[id]}/${upgrade.limit}</b><span>${escape(upgrade.description)}</span></li>`).join("")}</ul>` : '<p class="tiny">Empty Garage. Earn slots with Bronze in Orientation Day, Showboating 101 and Ice Cream Weather.</p>'}<p class="tiny">Equip up to 3 stacks in the Garage. Your loadout stays with this character across new runs.</p></section>`;
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
  const ability = effects.focusActive ? " · FOCUS · ½ SPEED"
    : world.elapsed < effects.rocketUntil ? " · ROCKET BOOST!"
    : world.elapsed < effects.brakeUntil ? " · AIR BRAKE" : "";
  const message = effects.status(world) + extra + ability;
  if (node.textContent !== message) node.textContent = message;
}
