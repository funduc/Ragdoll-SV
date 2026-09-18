# Vault Run verification

Updated 2026-09-18. This report covers the campaign addition. The existing skill-loop, trick, scoring, and Party Tournament code remains the basis for every jump.

## Implemented flow

Main menu → **Vault Run** → choose Jake / Brandon / Owen → full, manual biography and ability confirmation → campaign map → level briefing → Begin jump → shared physics attempt → medal and existing score breakdown → Return to map. Bronze or better unlocks the following lesson. All cleared levels can be replayed. Switching characters preserves the other two characters' records.

**Party Tournament** remains a separate main-menu choice. Its three qualifying jumps, elimination, two championship jumps, score rules, manual introductions, and restart behavior are unchanged. The exact desktop score sequences in the regression suite matched the pre-campaign baseline.

## Verification performed

| Requirement                      | Actual check and result                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three separate campaigns         | In each of two full-game DOM runs, selected every character, inspected their full biography/all statistics/ability/quote, kept the profile open for 16 simulated seconds, explicitly confirmed, and completed all three levels. Each new character began with only Orientation Day unlocked.                                                                                    |
| Medals and upgrades              | Actual keyboard and pointer runs earned Gold on every level for every character. Jake also had an idle failure, an Early-takeoff Silver attempt, then a Gold upgrade. A subsequent zero-point replay retained Gold. The save still contained one record per character/level. Unit fixtures separately exercised every Bronze/Silver/Gold boundary.                              |
| Saves survive reload             | Destroyed the full game and opened fresh DOM/page instances with the persisted localStorage values. Jake's Gold record and unlocked third lesson were restored. Three reload checks per integration run also covered other saved progress and a persisted reset. This simulates refresh; it is not a live browser reload.                                                       |
| Character isolation              | Completing Jake's campaign did not unlock Brandon's or Owen's second level. Returning to Jake retained his medals. Save tests reconstructed records for all three characters.                                                                                                                                                                                                   |
| Reset confirmation and isolation | Reset screen focuses Cancel; Enter canceled without any storage change. Explicit confirmation cleared campaign medals/unlocks for all three characters. Mute and an unrelated storage key were byte-for-byte unchanged. Reload kept the reset. No use of localStorage.clear.                                                                                                    |
| Bad or unavailable storage       | Full game loaded with malformed JSON, null, and unsupported-version saves. A throwing localStorage getter kept play available, displayed a page-only notice, earned and retained medals across mode switches. Unit tests also covered denied reads, write/quota failures, malformed nested records, and invalid medal values.                                                   |
| Party still works                | Three complete desktop-mode tournaments with restarts (15 jumps), plus two fault/recovery attempts. One complete pointer-driven narrow-mode tournament and restart (five jumps), plus two fault/recovery attempts. Campaign integration also switched back to Party and reached Jake's live qualifying jump with campaign progress unchanged.                                   |
| Controls and lifecycle           | Held Enter did not pass a profile into a level. Held menu Space did not create a push on Begin jump. Existing desktop/pointer timing, brace, rotation, tutorial, R-before-launch, blur/visibility, resize, manual introduction, listener-count, and world-disposal tests passed. One RAF loop, no game timers, cleared bodies/constraints/collision callbacks between attempts. |
| Console and assets               | Captured game console errors/warnings were empty in all four DOM runs. Missing portrait PNGs produced no image elements or resource requests. Owen's keepsake remained only the existing black CENSORED bar and label.                                                                                                                                                          |
| Static project paths             | The local static server returned 200 for **78 root/project-prefix requests**, including all campaign modules and CSS, with correct JavaScript MIME types. The game modules also loaded under the simulated page URL `/ragdoll-olympics/`. All production paths remain relative. No GitHub deployment was performed.                                                             |

## Commands run

```sh
npm test
node --experimental-vm-modules tests/dom-flow.mjs
MOBILE=1 node --experimental-vm-modules tests/dom-flow.mjs
node --experimental-vm-modules tests/campaign-dom.mjs
MOBILE=1 node --experimental-vm-modules tests/campaign-dom.mjs
```

`npm test` passed **69 groups**: 12 physics/tournament, 8 stability, 8 personalization, 5 presentation, 10 skill-loop, 16 tricks, and 10 campaign groups, followed by the 78-request HTTP check. The campaign group includes nine real Matter.js attempts across the three character campaigns. `tests/campaign.mjs` was run again after the final storage-failure-message edit and passed.

Each campaign DOM run completed **13 attempts**: nine main lessons, two idle Jake attempts, one Early-takeoff upgrade attempt, and one attempt with browser storage disabled. The two runs used real game modules, real persistent event handlers, Matter.js, and native Canvas; only layout and RAF/input scheduling were simulated. The keyboard and pointer campaign runs produced matching results:

| Character | Orientation Day   | Wheels Down       | Commit to the Bit   |
| --------- | ----------------- | ----------------- | ------------------- |
| Jake      | Gold / 816 points | Gold / 816 points | Gold / 1,406 points |
| Brandon   | Gold / 846 points | Gold / 846 points | Gold / 1,280 points |
| Owen      | Gold / 802 points | Gold / 802 points | Gold / 1,090 points |

The three desktop Party Tournament score sequences were `[808, 530, 1094, 806, 1337]`, `[0, 521, 735, 604, 1337]`, and `[0, 0, 0, 0, 0]`; finalist order, elimination, and shared-zero victory were checked. The original Jake biography remained visible for **15.024 real seconds**, and every Party introduction also survived 23 simulated seconds. No automatic biography timer was reintroduced.

Terminal output included Node's experimental-VM notice, the environment's npm http-proxy configuration warning, and npm's update notice. These are not game-console warnings.

## Issues caught during this implementation

- The new menu action selector initially matched the cabinet's `data-mode` attribute as an ancestor of ordinary buttons. It intercepted Party tutorial/menu actions. The existing full-flow test reproduced a stopped tutorial. Restricting delegation and Enter routing to **button** elements fixed it; subsequent full campaign and Party runs passed.
- A localStorage write failure during reset would leave the old persisted medals on disk. The reset now explicitly reports when it only cleared this page's in-memory copy, including that medals may return after reload. Normal writable-storage reset was verified across fresh page instances.
- The additional coach text could change its row height and shift touch controls. The campaign row now reserves space at desktop/tablet/phone breakpoints and lists at most two trick names plus “more.” This is a CSS/code correction; real-device layout has not been visually verified.

## Exact files changed

New production files:

- `js/campaign-levels.js`: level data, medal names, threshold evaluation.
- `js/campaign-save.js`: schema normalization, versioned save loading, highest-medal updates, reset, storage-failure fallback.
- `js/campaign.js`: guarded campaign state machine, unlock checks, finished-attempt facts, medal recording.
- `js/campaign-ui.js`: character selection/full profile, map/locks, briefing, live coaching, medal results, reset confirmation.
- `js/ui-content.js`: extracted existing portrait helper and score breakdown, shared by both modes.
- `campaign.css`: campaign map/cards/medals/coaching using the existing cabinet palette and buttons.

Changed production files:

- `index.html`: campaign stylesheet/coaching container and mode/status label targets.
- `js/game.js`: active-session selection, menu actions, campaign transitions, shared world/attempt completion integration. Existing input listeners and fixed-step loop remain single-owned.
- `js/ui.js`: two main-menu choices, campaign rendering/delegation, shared score markup, mode labels/coaching update. Party screen content is retained apart from the main-menu entry.
- `js/physics.js`: constructor accepts the level's arena settings; all three use the original gravity 1.05 and unchanged course. No force, collision, joint, skill, or trick behavior was changed.

Tests/documentation:

- New `tests/campaign.mjs` and `tests/campaign-dom.mjs`.
- `tests/dom-flow.mjs`: explicitly choose Party Tournament at the new menu; parse campaign CSS. Existing playthrough assertions retained.
- `tests/static-files.mjs`: include all new production files in root/project-prefix HTTP checks.
- `package.json`: add campaign checks to npm test and a campaign DOM command; no new runtime dependencies or build system.
- `README.md`, `QA.md`: campaign instructions, schema, level rules, actual tests, and limitations.

## Limits and remaining verification

Live preview was unavailable in the preceding work, and this pass did **not** perform a live-browser playthrough, inspect a browser developer console, verify actual phone hit-testing/layout, or deploy to GitHub Pages. DOM/Canvas integration and real local HTTP checks passed; they do not establish browser rendering, audible output, or human timing difficulty. No unresolved campaign or Party logic failure was reproduced in the tests performed.

This is the requested three-level slice in the existing arena. Modifiers provide lesson-specific coaching without changing physics. The optional hidden Santor Medal condition slot is present but unused for these levels. Saves are browser/origin-local, not synchronized across devices; blocked storage cannot persist past the current page.
