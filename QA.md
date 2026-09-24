# First campaign verification

Updated 2026-09-24. Vault Run now has ten main levels and an optional harder three-heat Gauntlet. The original Party Tournament, score formula, trick recognition, push/takeoff/brace tuning, character content and visual styles remain intact.

## What was actually run

- `npm test`: **125 deterministic assertion groups**, including the seven new first-campaign groups. The real static server passed **108 root/project-prefix requests**, JavaScript MIME checks, and the intentionally missing-asset 404 test.
- `node tests/first-campaign.mjs`: **45 actual Matter attempts** covering all ten main levels and Overtime with all three characters. Inputs were discrete left/right commands, timed pushes and a brace, sampled at 60 Hz into the unchanged 120 Hz world. No bodies, trick awards, scores or medals were injected to make these playthroughs succeed. Every new level and Overtime reached **Gold for each character without upgrades**.
- Additional real cargo-loss flights: one per character, plus isolated collision fixtures proving that a loose cargo box cannot count as the cart/rider’s first landing. The box’s constraint is removed once; both bodies and constraints are empty after disposal.
- `node --experimental-vm-modules tests/campaign-dom.mjs`: **63 attempts through the actual game, DOM event handlers, Matter and native Canvas**. All three characters completed all ten levels with upgrade choices; Jake also played Overtime and completed a fresh ten-level Factory Settings run by skipping rewards. Five reloads, a mode switch, eight deterministic developer cases, and achievement hooks were exercised.
- `MOBILE=1 node --experimental-vm-modules tests/campaign-dom.mjs`: **60 attempts** using simulated narrow layout and pointer controls. All three ten-level campaigns, a fresh no-upgrade Jake campaign, reload/reset cases and the eight developer cases completed. This run preceded the extra Overtime screen check; it did not exercise Overtime’s UI.
- `node --experimental-vm-modules tests/dom-flow.mjs`: **three complete desktop Party Tournaments with restarts**, 15 tournament jumps plus two fault/recovery attempts. Scores exactly matched the pre-expansion sequences: `[808,530,1094,806,1337]`, `[0,521,735,604,1337]`, `[0,0,0,0,0]`.
- Captured native Canvas images of secured cargo, lost orange cargo, Mapleton’s three collision repairs and a narrow cargo view; visually inspected all four. These are Canvas renders, not browser screenshots.

The full-game suites captured **zero game-console errors or warnings**. Node emitted its expected experimental VM-module notice outside the game console. No new game timers were called. A Party biography remained open for **15.035 real seconds** and all introductions remained manual. Input listeners/RAF ownership, held-Enter release, keyboard-repeat rejection, pointer push/brace, reset disposal, frame gaps, focus/visibility, exact score totals, portrait fallbacks, audio mute/lifecycle and particle limits retained their existing passing assertions.

Live browser preview was unavailable. These checks are not a manual browser playthrough, physical-device touch test, browser layout inspection, audible listening test, or deployed GitHub Pages test. HTTP checks at `/ragdoll-olympics/` were real. Automated play does not validate human pacing.

## Balance matrix

All entries below are **Gold**, using the same unmodified character data and no upgrades. Gauntlet entries sum their three actual scores. Score differences reflect the existing character style bonuses and physics; medal requirements are identical for everyone.

| Level | Jake | Brandon | Owen |
| --- | ---: | ---: | ---: |
| showboating-101 | 1395 | 1743 | 1389 |
| cross-examination | 701 | 718 | 715 |
| fragile-cargo | 791 | 866 | 811 |
| the-mapleton-run | 802 | 872 | 839 |
| ice-cream-weather | 833 | 873 | 836 |
| siemens-certified | 806 | 842 | 835 |
| the-santor-gauntlet | 3983 | 5271 | 3938 |
| santor-gauntlet-hard | 3976 | 5074 | 3929 |

The first ordinary one-flip policy earned Showboating Gold for Jake but only Silver for Brandon and Owen: their faster recovery happened too early for Last-Second Appeal. Controlled delayed-flip/recovery inputs produced Front Flip + No Hands + Last-Second Appeal and Clean landings for all three. No recognition threshold was loosened. Cross Examination used a deliberate Good takeoff to hit the same 30–45 m zone for each character; Perfect launch speed is not always the right choice.

Overtime’s optional Santor score target was reduced from 4,200 to **3,900**, while retaining three Clean landings, three Perfect takeoffs and three Perfect Braces. The tested no-upgrade routines earned 3,976 / 5,074 / 3,929, so Brandon’s larger style multiplier is not required. All other new Gold requirements were achieved with their authored thresholds. This proves attainable deterministic input sequences; it does not establish equal human difficulty or a forgiving timing window.

## State, save and content checks

- **Progression:** ten sequential main levels, each with description, objective, three medal rules, optional Santor criterion, every character’s commentary and success/failure lines. Bronze remains the unlock gate. Overtime unlocks after the main Gauntlet and is excluded from campaign-completion achievements.
- **Gauntlet:** fresh world and explicit Ready confirmation per heat; three different announced conditions; exact combined score/component ledger; union of unique tricks, not summed duplicates. Heat-one/two results cannot save a medal or unlock Overtime. Duplicate `record` calls are rejected. Holding Enter on heat results stops at Ready.
- **Gauntlet restarts:** prelaunch R repeats the current heat while retaining earlier banked scores. Leaving, replaying, or refreshing resets the unfinished sequence to heat one. New run and campaign reset clear transient heat data; saved medals and achievements retain their defined reset separation.
- **Cargo:** 18 bodies/16 constraints while secured; one real box and one tether beyond the baseline. A real flip releases it for each character, persists the loss and limits that attempt to Bronze. Box contact alone cannot finalize brace/tricks/distance. Clean delivery reached Gold for every character.
- **Uneven runway:** exactly three additional static collision triangles, matching the drawn outlines. Default Party worlds still contain 17 bodies/15 constraints and no cargo, repairs or run effects.
- **Storage extension:** loaded old v1 records containing only the original nine character/level Gold medals. All remained; new IDs defaulted safely. Existing seed, upgrade stack, pending offer and claimed rewards remained intact. An already-unlocked v2 Graduate/Favourite record kept its original timestamp. No schema bump was needed because only catalog entries were added. New completion awards now require ten main levels; old earned awards are grandfathered.
- **Achievement attribution:** real level-eight Jake and level-nine Owen flights unlocked only their matching new achievement. Reset/new run did not erase achievements. Campaign reset cleared Overtime access and new medals without touching the achievement bytes.
- **Menus and assets:** full biographies remained manual, intended missing PNG portraits produced initials without requests, every heat/objective appeared before play, and all new imports loaded under a project URL. Main-level and Overtime results preserve the ordinary per-attempt score breakdown.
- **Map after a resumed campaign:** completion copy uses permanent main-level medals; a newly started temporary run does not hide an already completed campaign. Factory Settings still uses all ten clears in the current run.

During integration review, the generic next-level result message treated optional Overtime’s `indexOf = -1` as a main-level index, which would label Orientation Day as newly unlocked. The new result guard requires a real main-level index; the Overtime DOM check verifies that the incorrect label is absent. Map challenge previews were also limited to heat one so a finished Gauntlet’s last condition cannot become its replay preview.

## Files and functions changed

| File | Changes |
| --- | --- |
| `js/campaign-chapter.js` (new) | Data for levels 4–10 and Overtime: arena variants, fixed conditions/objectives, rewards, thresholds, schedules and captions. |
| `js/campaign-levels.js` | `LEVELS`, `ALL_LEVELS`, `HARD_GAUNTLET`, `levelById`; original three levels gain optional Santor criteria, character captions and planning budgets. Original Bronze/Silver/Gold rules stay intact. |
| `js/campaign-save.js` | Existing save creation, normalization and `award` use the expanded catalog, preserving schema v1. |
| `js/run-save.js` | Expanded valid IDs; `RunSave.plan(levelId, developer, stageIndex)` selects authored level/heat conditions before the legacy seeded fallback. |
| `js/campaign.js` | `campaignFacts`, new `combinedFacts`; stage/heat state in constructor, `startLevel`, `confirm`, `record`, resets and character change; `stage`, `attemptArena`, `levelFinished`, `combinedScore`, `introduction` getters. |
| `js/game.js` | `replaceWorld` reads `attemptArena`, allowing the existing attempt flow to use the current heat’s arena. |
| `js/physics.js` | Constructor, `createCourse`, new `createCargo`/`updateCargo`, `step`, `handleCollisions`: optional ordinary Matter cargo/terrain, one tether release, cargo excluded from rider landing detection. |
| `js/renderer.js` | `draw` renders configured repair triangles and the secured/lost cargo with readable status labels. |
| `js/campaign-ui.js` | `goals`, `renderCampaign`, `updateCampaignCoach`; new `seriesMarkup`, `heatLedger`, `overtimeMarkup`. Ten-level progress, Santor results, per-character briefs, heat transitions and combined ledgers reuse existing styles. |
| `js/run-ui.js` | `runInventory` reward wording; `challengeMarkup` reads the active heat but previews heat one on the map. |
| `js/achievement-config.js` | Two optional character achievements; new completion targets are ten main levels; retained unlocks remain valid. |
| `js/achievement-events.js`, `js/achievements.js` | `attemptAchievementFacts` and event normalization include level ID and rider attachment for the new declarative rules. |
| `tests/first-campaign.mjs`, `tests/chapter-helpers.mjs` (new) | Real-physics matrix, discrete input policy, progression, cargo, reset, migration and achievement assertions. |
| `tests/campaign.mjs`, `tests/campaign-dom.mjs`, `tests/achievements.mjs`, `tests/static-files.mjs` | Extended catalog/count expectations, original-lesson regressions, complete ten-level input flows, Overtime UI and new relative module requests. |
| `package.json`, `README.md`, `CAMPAIGN.md` (new), `QA.md` | Test command, mechanics/persistence documentation, full level guide, this evidence report. |

`index.html`, all stylesheets, character biographies/data, `tournament.js`, `scoring.js`, input/touch owners, skills, trick recognition, condition forces and upgrade tuning were not changed. The source archive was rebuilt with the complete static project and tests.

## Remaining limitations

- The 24-minute content budget assumes first-time reading, practice and retries. **20–30-minute human pacing is unverified**; skilled players can finish faster. No extra waits or changed attempt timers were added.
- Showboating Gold asks for a genuine three-trick routine. The deterministic successes establish possibility; live human difficulty, mobile readability and cross-browser feel remain unverified.
- Unfinished Gauntlet heats are deliberately not saved; this is announced before play. All completed medals persist.
- Six pre-existing future achievement gates remain. In particular, combined Gauntlet near-miss scores are not yet connected to Physics Has Denied Your Appeal; Karma Chameleon still requires conditions changing within one attempt, not the announced between-attempt changes. Cargo is not a lost cart component or wheel.
- No live preview/deployment was performed. Saves remain local to the browser and origin; denied storage cannot persist beyond the page.
