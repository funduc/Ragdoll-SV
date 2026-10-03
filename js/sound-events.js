import { SFX_RULES } from "./sfx-config.js";
// Audio-only facts: never used by scoring, physics, progression or saves.
export function crashSound(world) {
  const parts = world.damage.lostParts.size;
  if (parts >= SFX_RULES.allParts && world.damage.ejected) return "crashMax";
  return parts >= SFX_RULES.heavyParts ? "crashHeavy" : parts >= 2 ? "crashMedium" : "crashLight";
}
export function landingSounds(world, score) {
  if (score.crashed || !["Clean", "Scrappy", "Rough"].includes(score.landingQuality)) return [];
  const events = [], step = world.syncSoundStep || 0;
  if (step >= 5) events.push("syncCombo5");
  else if (step >= 3) events.push("syncCombo3");
  else if (score.tricks.unique >= 2) events.push("trickCombo");
  if (score.landingQuality === "Clean") events.push(world.skills.brace === "Perfect Brace" ? "landPerfect" : "landClean");
  if (score.distanceMetres > SFX_RULES.cheerMetres) events.push("crowdCheer");
  return events;
}
export function syncSounds(sequence, world, play) {
  sequence.soundNotes ||= new Set();
  for (const note of sequence.notes) {
    if (!note.grade || sequence.soundNotes.has(note)) continue;
    sequence.soundNotes.add(note);
    if (note.grade === "Miss") { world.syncSoundStep = 0; play("syncMiss", "skill-miss"); }
    else { world.syncSoundStep = Math.min(5, (world.syncSoundStep || 0) + 1); play("syncStep" + world.syncSoundStep, "skill-" + note.grade.toLowerCase()); }
  }
  if (sequence.extra > (sequence.soundExtra || 0)) { world.syncSoundStep = 0; play("syncMiss", "skill-miss"); }
  sequence.soundExtra = sequence.extra;
  if (sequence.result?.grade === "PERFECT SYNC" && !sequence.soundPerfect) {
    sequence.soundPerfect = true; world.syncSoundStep = 6; play("syncStep6", "sync-drop");
  }
}
