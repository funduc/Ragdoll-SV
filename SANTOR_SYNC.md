# SANTOR SYNC implementation and verification

Implemented September 25, 2026. The new bonus is isolated to Vault Run. Existing Party Tournament, tutorial drills, biographies, portraits, audio assets, controls outside Sync, medals, conditions, upgrades and save formats remain intact.

## Lifecycle and fairness

After the existing Begin jump confirmation, Game.startSync() commits a saved selection before starting the minigame. The existing session remains active while the centralized frame branch runs only SyncSequence.tick(); no PhysicsWorld.step(), Matter update, runway timer, brace, push, passive, condition or trick sampling occurs. Canvas rendering continues. Six notes take about 3 seconds, followed by a 0.7-second result display (about 4–4.4 seconds total including the lead-in). Blur/hidden pauses both clocks; gaps over 250 ms are discarded. Enter is consumed. R cancels the current opportunity and returns through the existing ready flow. The same lifetime Input listener owns keyboard events. SyncUI owns one lifetime delegated pointer listener set, removed on Game.destroy(). No timeout, interval, second RAF loop or second AudioContext is added.

Normal rate is 11%. After six eligible decisions without an occurrence, the next eligible decision is guaranteed. Used levels are ineligible for the remainder of that run; Gauntlet heats share one level opportunity. Retries before an occurrence are eligible, but refresh reuses the pending decision. After a triggered sequence, the earned grade is banked so refresh cannot reroll it. A new run clears used-level flags/count but preserves the pity count. Party Tournament and the interactive tutorial are excluded even under the force flag.

The companion save `santor-vault:sync` is version 1 and keyed to character plus run seed. It stores pity, occurrence count and per-level serial/used/pending decision/result. A pending false decision is saved too. It validates known level IDs, counts and grades, handles corrupt data, and preserves unsupported future versions. If saving the initial decision fails, it rolls back the decision/count and starts an ordinary jump. Existing run and medal version-1 keys and achievement version-2 records are not migrated or replaced. The existing achievement normalizer adds the six new definitions with locked defaults while preserving prior progress/timestamps. Writes happen on decisions, grade completion, attempt finish/cancel, and explicit reset—not on beat/physics frames.

## Rhythm, rewards and presentation

A shared deterministic internal clock judges both sides of the line. Perfect earns 1 credit; Good 0.7; Miss 0. Accuracy is `100 × (Perfect + 0.7 × Good) / (6 + off-beat extra inputs)`. Incorrect lanes consume the nearby note as Miss. Off-beat/spammed new inputs add denominator misses. A held key, repeat event, duplicate pointerdown or old held input across states is not a new hit. All input grades have visual feedback, a combo counter, charge meter and local lane beat flash. Muting does not affect timing. Reduced motion fixes note positions, varies opacity and disables the Perfect pop animation.

| Grade | Accuracy | Base horizontal launch speed | Ballistic height | Style factor |
|---|---:|---:|---:|---:|
| MISS | <60% | ×1.00 | ×1.00 | ×1.00 |
| GOOD | 60–79% | ×1.05 | ×1.05 | ×1.00 |
| GREAT | 80–94% | ×1.10 | ×1.12 | ×1.12 |
| PERFECT SYNC | 95–100% | ×1.12 | ×1.25 | ×1.25 |

Boosts apply exactly once at the existing takeoff transition after the normal timing bonus. Every dynamic body and carried cargo receives the same velocity delta, preserving relative joint motion. Upward velocity is multiplied by the square root of the height factor, not by 1.25 (which would unintentionally add 56% ballistic height). Existing faster motion is never reduced to satisfy a boost cap; only the added boost is capped. The existing camera already follows the apex. Landing physics still determines the result.

Jake gets 15% wider windows, 4% slower spacing, stronger spin damping and an ×1.18 style ceiling. Brandon alternates lanes more, and adds 0.08 style on Great/Perfect (×1.20 / ×1.33). Owen's spacing is 12% faster; his earned speed factor adds 0.03 (8/13/15% speed bonuses), with a small capped forward kick. A seeded 25% cosmetic warning never changes the outcome.

Music stays on its selected track, with a ×0.72 duck applied to the existing preference and normalization gains. Six original synthesized percussion cues follow the internal note clock; a short synthesized drop marks the return to gameplay. All cues use the existing mute/effects controls, bounded voice pool and node cleanup. Music volume is restored on finish, reset and disposal. No music files were changed.

The results show accuracy, Perfect/Good/Miss counts, extra inputs, launch factors and the Sync style multiplier in the existing score equation. Style is rounded once after trick subtotal × character × landing × Sync, and remains capped at 5,000. Score component totals retain their existing arithmetic.

## Achievement hooks

All use the existing normalized event manager and standard post-attempt notifications; the minigame has no achievement UI.

- In Sync: complete Sync and finish a valid attempt.
- Physics Lost Jurisdiction: Perfect Sync, valid attempt.
- Beat the Landing: Perfect Sync and successful landing.
- Triple Time: at least three completed rotations after an earned Sync boost.
- Legally Valid: all six notes missed but a medal earned; Gauntlet prior-heat results are considered when its medal is finalized.
- Encore in the Vault: at least two occurrences in one completed campaign run.

No gameplay reward is gated by these achievements.

## Tests actually performed

- `npm test`: all core suites, 7 new Sync groups, the expanded 9-group music suite and 207 static HTTP requests passed. Static checks cover root, `/ragdoll-olympics/` and exact `/Ragdoll-SV/`, including each new module and stylesheet.
- `SYNC_TEST=1 npm run test:campaign:dom`: 12 forced keyboard cases (each character × MISS/GOOD/GREAT/PERFECT), muted audio, repeat/duplicate prevention, Enter isolation, frozen Matter timestamp/body positions, stall/blur pause, fresh runway input, result arithmetic, same-level replay, restart during/after Sync, and disposal. Additional normal-save reloads tested pending event and banked grade reuse plus exact music-volume restoration.
- `MOBILE=1 SYNC_TEST=1 npm run test:campaign:dom`: the same 12 grades using four directional pointer buttons at simulated 360×740. Desktop was simulated 1366×768.
- `npm run test:campaign:dom`: 63 attempts across all characters and complete campaigns, replay, refresh/save/reset integrity and Gauntlet. This baseline driver deliberately misses bonus notes so ordinary physics expectations remain comparable.
- `TOURNAMENTS=1 npm run test:dom`: a complete desktop Party Tournament plus restart/recovery checks.
- `SYNC_FORCE=1 MOBILE=1 TOURNAMENTS=1 npm run test:dom`: complete touch-input Party Tournament and restart/recovery checks, explicitly asserting no Sync overlay even under the force flag. Developer-mode achievements correctly stay in memory.
- `node tests/sync-controls-dom.mjs`: A/S/W/D mappings, repeat/held input, Enter isolation, release gate, reduced-motion fixed note positions and disposal.
- `node tests/accessibility-dom.mjs` and `node tests/portraits-dom.mjs`: existing keyboard controls/audio controls and portrait fallback tests passed.
- Audio lifecycle tests include the new beat/drop cues: each source and gain disconnects; the single master remains until disposal. Music tests verify duck/restore through mute and hidden/pause without preference writes or track changes.
- Deterministic tests cover symmetric early/late judgments, every grade for every character, 10,000 seeded decisions, six real misses followed by guaranteed appearance, repeat prevention, failed/future/corrupt saves, one-shot capped boosts, score totals, refresh and once-only achievement unlocks.
- Source comparison confirmed every music/portrait asset byte-identical to the prior delivery; character content, tournament, campaign progression, conditions, upgrades, original skill/trick logic and save owners were not rewritten.

Captured game console errors/warnings were empty. Node/npm emitted environment warnings for experimental VM modules and proxy configuration; these were not game warnings.

## Measured physics and limitations

With identical timed pushes and controlled-air inputs, perfect boosted peak rise compared with ordinary peak rise was Jake 224.15 vs 180.46 pixels (+24.2%), Brandon 231.10 vs 186.17 (+24.1%), Owen 206.29 vs 165.76 (+24.5%). Airtime rose from 1.475 to 1.583 seconds, 1.492 to 1.608 seconds, and 1.433 to 1.542 seconds respectively. MISS matched the ordinary jump exactly. The longer flight allowed Owen to register two flips instead of one in the tested constant-rotation attempts.

Triple Time's normalized-event hook is tested, but a three-rotation playable attempt was not achieved: sampled constant-rotation runs, including maximum existing upgrades across conditions, reached at most two. The boost stays within the requested height range rather than changing the existing rotation cap. This achievement's practical balance remains unverified.

The available browser rejected the local `/Ragdoll-SV/?syncdev=1` preview with `net::ERR_BLOCKED_BY_CLIENT`. No live-browser rendering, human rhythm/playability, screen-reader, real touch hardware or audible music/cue check is claimed. DOM/physics and audio lifecycle tests use JSDOM, real Matter.js, native Canvas rendering and media/audio doubles. Actual GitHub deployment was not modified; its relative paths were tested locally.

## Files changed or created

Changed:

- `index.html`
- `js/achievement-config.js`
- `js/achievement-events.js`
- `js/achievements.js`
- `js/audio.js`
- `js/game.js`
- `js/input.js`
- `js/music.js`
- `js/physics.js`
- `js/scoring.js`
- `js/trick-ui.js`
- `js/ui-content.js`
- `package.json`
- `tests/achievements.mjs`
- `tests/campaign-dom.mjs`
- `tests/dom-flow.mjs`
- `tests/music.mjs`
- `tests/presentation.mjs`
- `tests/static-files.mjs`
- `README.md`
- `QA.md`
- `deliverables/ragdoll-olympics-vertical-slice.zip`

Created:

- `js/sync-config.js`
- `js/sync-save.js`
- `js/sync-ui.js`
- `js/sync.js`
- `sync.css`
- `tests/sync-controls-dom.mjs`
- `tests/sync-flow-helper.mjs`
- `tests/sync.mjs`
- `SANTOR_SYNC.md`

Temporary logs and the pre-edit checkpoint under `.qa/sync/` are excluded from delivery.

## Complete added configuration

All tuning is in `js/sync-config.js`; units are seconds and Matter velocity/angular-velocity units at 60 Hz. Lane IDs are 0=Left, 1=Down, 2=Up, 3=Right. The default force flag is false. The URL override is `syncdev=1` and uses the existing memory-only developer save mode.

```json
{
  "SYNC_CONFIG": {
    "chance": 0.11,
    "pity": 6,
    "force": false,
    "firstBeat": 1,
    "spacing": 0.48,
    "notes": 6,
    "preview": 1,
    "perfectWindow": 0.075,
    "goodWindow": 0.15,
    "goodCredit": 0.7,
    "resultSeconds": 0.7,
    "maximumFrameGap": 0.25,
    "musicDuck": 0.72,
    "maximumSpeed": 35,
    "maximumUpwardSpeed": 20,
    "maximumStyle": 1.35,
    "maximumSpin": 0.16,
    "maximumExtraMisses": 1000,
    "beatFlashSeconds": 0.12,
    "grades": [
      {
        "name": "PERFECT SYNC",
        "minimum": 95,
        "speed": 1.12,
        "height": 1.25,
        "style": 1.25
      },
      {
        "name": "GREAT",
        "minimum": 80,
        "speed": 1.1,
        "height": 1.12,
        "style": 1.12
      },
      {
        "name": "GOOD",
        "minimum": 60,
        "speed": 1.05,
        "height": 1.05,
        "style": 1
      },
      {
        "name": "MISS",
        "minimum": 0,
        "speed": 1,
        "height": 1,
        "style": 1
      }
    ],
    "characters": {
      "jake": {
        "windows": 1.15,
        "spacing": 1.04,
        "damping": 0.6,
        "speedExtra": 0,
        "styleExtra": 0,
        "styleCap": 1.18,
        "kick": 0,
        "pattern": [
          0,
          1,
          2,
          3,
          0,
          3
        ]
      },
      "brandon": {
        "windows": 1,
        "spacing": 1,
        "damping": 0.85,
        "speedExtra": 0,
        "styleExtra": 0.08,
        "styleCap": 1.35,
        "kick": 0,
        "pattern": [
          0,
          2,
          1,
          3,
          1,
          0
        ]
      },
      "owen": {
        "windows": 1,
        "spacing": 0.88,
        "damping": 0.95,
        "speedExtra": 0.03,
        "styleExtra": 0,
        "styleCap": 1.25,
        "kick": 0.008,
        "pattern": [
          0,
          1,
          2,
          3,
          0,
          3
        ]
      }
    },
    "wrateWarningChance": 0.25,
    "lines": {
      "intro": "The Vault has detected rhythm. This was not in the risk assessment.",
      "MISS": "No rhythm whatsoever. The attempt remains legally valid.",
      "GOOD": "They are weaponizing the beat!",
      "GREAT": "They are weaponizing the beat!",
      "PERFECT SYNC": "Perfect synchronization! Physics has lost jurisdiction.",
      "wrate": "Someone check whether Owen wired this correctly."
    }
  },
  "SYNC_KEYS": {
    "ArrowLeft": 0,
    "KeyA": 0,
    "ArrowDown": 1,
    "KeyS": 1,
    "ArrowUp": 2,
    "KeyW": 2,
    "ArrowRight": 3,
    "KeyD": 3
  }
}
```
