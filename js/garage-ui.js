import { UPGRADES } from "./run-config.js";
import { SLOT_LEVELS, stackCount } from "./loadout.js";
import { levelById } from "./campaign-levels.js";
import { upgradeIcon } from "./upgrade-art.js";
import { escape } from "./ui-content.js";

export const GARAGE_HELP = "Earn upgrade slots with Bronze in Orientation Day, Showboating 101 and Ice Cream Weather. Equip up to 3 in the Garage.";
export function garageButton(run) {
  return `<button type="button" class="btn secondary" data-campaign="garage" ${run.garageLocked ? "disabled" : ""}>${run.garageLocked ? "Locked until this level ends" : "GARAGE"}</button>`;
}
export function garageMarkup(run) {
  const counts = run.equipped, used = stackCount(counts);
  const filled = Object.entries(counts).flatMap(([id, n]) => Array(n).fill(id));
  const slots = SLOT_LEVELS.map((levelId, i) => {
    const unlocked = run.save.entry(run.current.id, levelId).medal >= 1;
    const id = unlocked ? filled.shift() : null;
    return `<li>${unlocked ? id ? `${upgradeIcon(id)}<b>${escape(UPGRADES[id].shortName)}</b>` : '<b>EMPTY</b>' : `<b>LOCKED</b><span>Bronze in ${escape(levelById(levelId).name)} to unlock</span>`}</li>`;
  }).join("");
  return `<header><h2 id="garage-heading">UPGRADE GARAGE</h2><p>${escape(run.current.name)} · ${used}/${run.slots} slots equipped</p><button type="button" class="btn" data-garage-close>Close</button></header><ol class="garage-slots">${slots}</ol><p class="tiny">${GARAGE_HELP}</p>${run.developer ? '<p class="tiny">Developer loadout override · editing disabled; slot limits bypassed.</p>' : ""}<div class="garage-cards">${Object.entries(UPGRADES).map(([id, item]) => {
    const count = counts[id] || 0;
    const reason = run.developer ? "Developer override" : count >= item.limit ? "Stack limit reached" : used >= run.slots ? "No free slot" : "";
    return `<article class="upgrade-card">${upgradeIcon(id)}<h3>${escape(item.shortName)}</h3><p class="upgrade-effect">${escape(item.effect)}</p><p aria-label="${count} of ${item.limit} stacks">${"●".repeat(count)}${"○".repeat(item.limit - count)}</p><details class="upgrade-details"><summary>Details</summary><p>${escape(item.description)}</p></details><div class="garage-adjust"><button type="button" class="btn secondary" data-garage-id="${id}" data-delta="-1" aria-label="Remove ${escape(item.shortName)}" ${!count || run.developer ? "disabled" : ""}>−</button><button type="button" class="btn" data-garage-id="${id}" data-delta="1" aria-label="Add ${escape(item.shortName)}" ${reason ? "disabled" : ""}>+</button></div><p class="tiny">${reason || "One stack uses one slot"}</p></article>`;
  }).join("")}</div><footer><button type="button" class="btn secondary" data-garage-clear ${!used || run.developer ? "disabled" : ""}>Clear all</button><p role="status" class="tiny">${escape(run.loadout.notice)}</p><button type="button" class="btn" data-garage-close>Close</button></footer>`;
}

export class GarageUI {
  constructor(root, onChange) {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "garage-dialog";
    this.dialog.setAttribute("aria-labelledby", "garage-heading");
    root.append(this.dialog); this.onChange = onChange;
    this.dialog.addEventListener("keydown", event => event.stopPropagation());
    this.dialog.addEventListener("keyup", event => event.stopPropagation());
    this.dialog.addEventListener("cancel", event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.hasAttribute("data-garage-close")) return this.close();
      const id = button.hasAttribute("data-garage-clear") ? "clear" : button.dataset.garageId;
      if (!id || !this.run.changeLoadout(id, Number(button.dataset.delta))) return;
      const label = button.getAttribute("aria-label");
      this.dialog.innerHTML = garageMarkup(this.run);
      const next = [...this.dialog.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === label && !b.disabled);
      (next || this.dialog.querySelector("[data-garage-close]")).focus({ preventScroll: true });
    });
  }
  get open() { return this.dialog.open; }
  show(run) {
    if (!run.canEditLoadout) return;
    this.run = run;
    this.dialog.innerHTML = garageMarkup(run);
    this.dialog.showModal();
    this.dialog.querySelector("[data-garage-close]").focus();
  }
  close() {
    this.dialog.close(); this.onChange();
    // The underlying map/briefing was rebuilt to reflect the new equipment.
    document.querySelector('[data-campaign="garage"]')?.focus({ preventScroll: true });
  }
  destroy() { this.dialog.remove(); }
}
