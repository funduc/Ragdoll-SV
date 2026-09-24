import {
  ACHIEVEMENTS,
  ACHIEVEMENT_RULES,
  COSMETIC_REWARDS,
  COSMETIC_SLOTS,
} from "./achievement-config.js";
import { CHARACTERS } from "./characters.js";
import { OBJECTIVES } from "./run-config.js";
import { escape } from "./ui-content.js";

const button = (label, action, value = "", secondary = true) =>
  `<button type="button" class="btn${secondary ? " secondary" : ""}" data-achievement="${action}" data-value="${escape(value)}">${escape(label)}</button>`;
const dateLabel = (timestamp) =>
  timestamp
    ? new Date(timestamp).toISOString().slice(0, 10) + " UTC"
    : "Date unavailable · imported record";
export function achievementVaultMarkup(
  manager,
  reset = false,
  developer = false,
) {
  if (reset)
    return `<section class="menu-panel"><p class="eyebrow">ACHIEVEMENT VAULT / CONFIRM RESET</p><h2>RESET ACHIEVEMENTS?</h2><p>This clears achievement progress, unlock dates, objective badges, and cosmetic selections. Campaign medals, unlocks, temporary run upgrades, Party Tournament, and sound settings stay.</p><div class="actions">${button("Cancel — keep achievements", "cancel-reset", "", false)}${button("Reset achievements", "reset-confirm")}</div></section>`;
  const categories = [...new Set(ACHIEVEMENTS.map((a) => a.category))];
  const legacy = CHARACTERS.map(
    (c) =>
      `<div><h3>${escape(c.name)}</h3><ul>${
        Object.keys(manager.data.characters[c.id])
          .map(
            (id) =>
              `<li>${escape(OBJECTIVES[id].name)} <small>${escape(dateLabel(manager.data.objectiveDates[c.id][id]))}</small></li>`,
          )
          .join("") || "<li>No objective badges yet.</li>"
      }</ul></div>`,
  ).join("");
  return `<section class="menu-panel achievement-vault"><p class="eyebrow">THE SANTOR VAULT / PERMANENT RECORD</p><h2>ACHIEVEMENT VAULT</h2><p>${ACHIEVEMENTS.filter((a) => manager.data.records[a.id].unlocked).length} / ${ACHIEVEMENTS.length} unlocked · shared across Vault Run and Party Tournament.</p>${developer ? '<p class="run-dev">DEVELOPMENT MODE · ACHIEVEMENTS ARE NOT SAVED</p>' : ""}${manager.notice && !developer ? `<p class="tiny" role="status">${escape(manager.notice)}</p>` : ""}<div class="actions">${button("Main menu", "back", "", false)}${button("Reset achievements", "reset")}</div>
  <section class="achievement-cosmetics"><h3>COSMETIC LOADOUT</h3><p class="tiny">Optional visual and commentary rewards only. No score, input, or physics benefits.</p>${COSMETIC_SLOTS.map((slot) => `<p><b>${slot.toUpperCase()}:</b> ${escape(COSMETIC_REWARDS[manager.data.equipped[slot]]?.name || "Default")}${manager.data.equipped[slot] ? button("Use default", "default", slot) : ""}</p>`).join("")}</section>
  ${categories
    .map(
      (category) =>
        `<section class="achievement-category"><h3>${escape(category)}</h3><div class="achievement-grid">${ACHIEVEMENTS.filter(
          (a) => a.category === category,
        )
          .map((item) => {
            const record = manager.data.records[item.id],
              reward = COSMETIC_REWARDS[item.reward];
            return `<article class="achievement-card" data-achievement-id="${item.id}" data-unlocked="${record.unlocked}"><p class="tiny">${escape(item.category)} · <b>${record.unlocked ? "UNLOCKED" : "LOCKED"}</b></p><h4>${escape(item.name)}</h4><p>${escape(item.description)}</p>${record.unlocked ? `<p class="tiny">${escape(dateLabel(record.unlockedAt))}</p>` : ""}${!manager.available(item) ? `<p class="achievement-unavailable">FUTURE MECHANIC · ${escape(item.unavailable)}</p>` : ""}${item.target > 1 ? `<label>Progress: ${record.progress} / ${item.target}<progress value="${record.progress}" max="${item.target}">${record.progress} / ${item.target}</progress></label>` : ""}${reward ? `<p class="tiny">REWARD: ${escape(reward.name)}</p>${record.unlocked ? button(manager.data.equipped[reward.slot] === item.reward ? "Equipped" : "Equip reward", "equip", item.reward) : ""}` : ""}</article>`;
          })
          .join("")}</div></section>`,
    )
    .join(
      "",
    )}<section class="achievement-legacy"><h3>CAMPAIGN OBJECTIVE BADGES</h3><p class="tiny">Your existing per-character records are retained. Older records have no recorded unlock date.</p>${legacy}</section></section>`;
}
export function renderAchievementVault(ui, manager, reset, developer) {
  ui.root.dataset.state = reset ? "achievement-reset" : "achievement-vault";
  ui.overlay.classList.remove("title-overlay", "intro-overlay");
  ui.overlay.hidden = false;
  ui.overlay.innerHTML = achievementVaultMarkup(manager, reset, developer);
  ui.roundLabel.textContent = "ACHIEVEMENT VAULT";
  ui.overlay.querySelector("button")?.focus({ preventScroll: true });
}
export function showAchievementNotice(ui, manager) {
  const ids = manager.drainUnlocks();
  if (!ids.length) return;
  // In-flow results content: never overlays the Canvas or captures input/focus.
  const node = document.createElement("aside");
  node.className = "achievement-notice";
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  const visible = ids.slice(0, ACHIEVEMENT_RULES.notificationNames);
  node.textContent =
    "ACHIEVEMENT UNLOCKED · " +
    visible
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id).name)
      .join(" · ") +
    (ids.length > visible.length
      ? ` · +${ids.length - visible.length} more in the Achievement Vault`
      : "");
  ui.overlay.querySelector(".menu-panel")?.prepend(node);
}
export function applyAchievementCosmetics(ui, renderer, manager) {
  const values = manager.cosmeticValues();
  renderer.cosmetics = values;
  ui.root.style.setProperty(
    "--achievement-border",
    values.border || "transparent",
  );
  ui.root.dataset.rewardBorder = String(Boolean(values.border));
  const badge = document.getElementById("achievement-badge");
  badge.hidden = !values.badge;
  badge.textContent = values.badge || "";
}
