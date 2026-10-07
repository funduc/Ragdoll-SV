import {
  ACHIEVEMENTS,
  ACHIEVEMENT_TIERS,
  COSMETIC_REWARDS,
  COSMETIC_SLOTS,
} from "./achievement-config.js";
import { achievementIcon, rewardPreview } from "./achievement-art.js";
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
  const categories = [...new Set(ACHIEVEMENTS.map(a => a.category))];
  const available = ACHIEVEMENTS.filter(a => manager.available(a));
  const count = items => items.filter(a => manager.data.records[a.id].unlocked).length;
  const complete = count(available), percentage = Math.round(complete / available.length * 100);
  const characterProgress = CHARACTERS.map(c => {
    const challenges = available.filter(a => a.rules.some(([field, op, id]) => field === "characterId" && op === "eq" && id === c.id));
    const earned = count(challenges);
    return '<div><b>'+escape(c.name.split(" ")[0])+' · '+Math.round(earned/challenges.length*100)+'%</b><progress value="'+earned+'" max="'+challenges.length+'" aria-label="'+escape(c.name)+' character challenges">'+earned+'/'+challenges.length+'</progress><small>'+earned+'/'+challenges.length+'</small></div>';
  }).join("");
  const rewards = Object.entries(COSMETIC_REWARDS).map(([id, reward]) => {
    const item = ACHIEVEMENTS.find(a => a.reward === id), unlocked = manager.data.records[item.id].unlocked;
    const equipped = manager.data.equipped[reward.slot] === id;
    return '<article class="reward-card" data-owned="'+unlocked+'">'+rewardPreview(reward)+'<b>'+escape(reward.name)+'</b><small>'+escape(reward.slot.toUpperCase())+'</small>'+(unlocked ? button(equipped ? "Equipped" : "Equip", "equip", id) : '<p>Unlock: '+escape(item.hidden ? "??? — hidden challenge" : item.name)+'</p>')+'</article>';
  }).join("");
  const legacy = CHARACTERS.map(c => '<div><h3>'+escape(c.name)+'</h3><ul>'+(Object.keys(manager.data.characters[c.id]).map(id => '<li>'+escape(OBJECTIVES[id].name)+' · '+escape(dateLabel(manager.data.objectiveDates[c.id][id]))+'</li>').join("") || '<li>No objective badges yet.</li>')+'</ul></div>').join("");
  return '<section class="menu-panel achievement-vault"><p class="eyebrow">THE SANTOR VAULT / PERMANENT RECORD</p><h2>ACHIEVEMENT VAULT</h2><div class="vault-completion"><strong>'+percentage+'% COMPLETE</strong><span>'+complete+' / '+available.length+' available achievements</span><progress value="'+complete+'" max="'+available.length+'" aria-label="Overall achievement completion">'+percentage+'%</progress></div><p class="tiny character-completion-label">CHARACTER CHALLENGES</p><div class="character-completion">'+characterProgress+'</div><p class="tiny">Shared across Vault Run and Party. Future mechanics are outside the completion total.</p>'+(developer ? '<p class="run-dev">DEVELOPMENT MODE · ACHIEVEMENTS ARE NOT SAVED</p>' : '')+(manager.notice && !developer ? '<p class="tiny" role="status">'+escape(manager.notice)+'</p>' : '')+'<div class="actions">'+button("Main menu", "back", "", false)+button("Cosmetic rewards", "garage")+'</div>'+categories.map(category => '<section class="achievement-category"><h3>'+escape(category)+'</h3><div class="achievement-grid">'+ACHIEVEMENTS.filter(a => a.category === category).map(item => {
    const record = manager.data.records[item.id], concealed = item.hidden && !record.unlocked;
    const name = concealed ? "???" : item.name, reward = COSMETIC_REWARDS[item.reward];
    return '<details class="achievement-card" name="achievement-tile" data-achievement-id="'+item.id+'" data-unlocked="'+record.unlocked+'" style="--tier:'+ACHIEVEMENT_TIERS[item.tier]+'"><summary>'+achievementIcon(item, concealed)+'<span class="achievement-tier">'+item.tier+'</span><h4>'+escape(name)+'</h4>'+(concealed ? '<p class="achievement-hint">'+escape(item.hint)+'</p>' : '<span class="achievement-progress-label">'+(record.unlocked ? '✓ UNLOCKED' : record.progress+' / '+item.target)+'</span><progress value="'+record.progress+'" max="'+item.target+'" aria-label="'+escape(item.name)+' '+record.progress+'/'+item.target+'">'+record.progress+'/'+item.target+'</progress>')+'</summary><div class="achievement-tile-detail"><p>'+escape(concealed ? item.hint : item.description)+'</p>'+(record.unlocked ? '<p class="tiny">'+escape(dateLabel(record.unlockedAt))+'</p>' : '')+(!manager.available(item) ? '<p class="achievement-unavailable">FUTURE MECHANIC'+(concealed ? '' : ' · '+escape(item.unavailable))+'</p>' : '')+(reward && !concealed ? '<div class="tile-reward">'+rewardPreview(reward)+'<span>REWARD · '+escape(reward.name)+'</span></div>' : '')+'</div></details>';
  }).join("")+'</div></section>').join("")+'<section class="achievement-cosmetics"><h3>THE TROPHY GARAGE</h3><p class="tiny">Preview every prize. Paint, trails and hats appear in play; poses appear on Party and Tour podiums. Cosmetics never change physics or scores.</p><div class="cosmetic-slots">'+COSMETIC_SLOTS.map(slot => '<p><b>'+slot.toUpperCase()+':</b> '+escape(COSMETIC_REWARDS[manager.data.equipped[slot]]?.name || "Default")+(manager.data.equipped[slot] ? button("Use default", "default", slot) : '')+'</p>').join("")+'</div><div class="reward-grid">'+rewards+'</div></section><details class="achievement-legacy"><summary>Campaign objective badges</summary><p class="tiny">Original per-character records are retained. Imported records may have no date.</p>'+legacy+'</details><div class="actions">'+button("Reset achievements", "reset")+'</div></section>';
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
  return ui.achievementToasts?.enqueue(manager.drainUnlocks()) || false;
}
// Counters that can genuinely advance, ordered by completion fraction.
export function almostAchievements(manager, characterId, campaignFacts = null) {
  return ACHIEVEMENTS.filter(item => !item.hidden && manager.available(item) &&
    !manager.data.records[item.id].unlocked && item.target > 1 &&
    !item.rules.some(([field, op, id]) => field === "characterId" && op === "eq" && id !== characterId))
    .map(item => {
      const progress = item.event === "campaign-progress" && item.aggregation === "max" && campaignFacts
        ? Math.min(item.target, campaignFacts[item.field] || 0) : manager.data.records[item.id].progress;
      const remaining = item.target - progress;
      const message = item.id === "parts-department"
        ? 'Reach 1,000 carnage in one crash (best '+progress+').'
        : remaining+' more '+item.huntUnits?.[remaining === 1 ? 0 : 1]+' for '+item.name+'.';
      return { item, progress, ratio: progress / item.target, message };
    }).filter(a => a.progress > 0 && a.ratio < 1 && (a.item.huntUnits || a.item.id === "parts-department"))
    .sort((a, b) => b.ratio - a.ratio).slice(0, 2);
}
export function showAchievementHunts(ui, manager, characterId, facts) {
  ui.overlay.querySelector('.achievement-hunts')?.remove();
  const almost = almostAchievements(manager, characterId, facts);
  if (!almost.length) return;
  const node = document.createElement('aside'); node.className = 'achievement-hunts';
  node.innerHTML = '<h3>ALMOST THERE</h3>'+almost.map(({item, message}) => '<p>'+achievementIcon(item)+'<span>'+escape(message)+'</span></p>').join('');
  const panel = ui.overlay.querySelector('.menu-panel');
  const actions = panel?.querySelector('.actions');
  if (actions) actions.before(node); else panel?.append(node);
}
export function applyAchievementCosmetics(ui, renderer, manager) {
  const values = manager.cosmeticValues();
  renderer.cosmetics = values;
  ui.cosmetics = values;
  ui.root.style.setProperty(
    "--achievement-border",
    values.border || "transparent",
  );
  ui.root.dataset.rewardBorder = String(Boolean(values.border));
  const badge = document.getElementById("achievement-badge");
  badge.hidden = !values.badge;
  badge.textContent = values.badge || "";
}
