# Music integration follow-up

2026-09-24. The current build includes the four supplied music tracks, the Enter the Vault gate, independent Music/Effects volumes, saved mute/preferences, retry-stable track selection and Gauntlet music. Gameplay3 was not supplied. Full inspection, processing details, sizes, changed files and current tests are in [MUSIC.md](MUSIC.md).

The current suite passed 138 deterministic groups plus 122 root/project-prefix HTTP checks. Desktop and simulated-touch Party tournaments, a 63-attempt campaign suite with all characters/replay/reloads, music lifecycle/failure tests and final MP3 decoding/loudness checks passed. Browser navigation remained blocked, so audible playback and live browser/media/CSS behavior are still unverified.

The earlier report below records the **pre-music regression pass**. Its file-change list, test counts and audio/entry descriptions describe that earlier snapshot; MUSIC.md documents the current changes. Physics, score calculation and progression remain unchanged.

---

# Final regression, save-integrity, accessibility and balance report

2026-09-24. This pass adds no gameplay features and changes no physics, scoring, thresholds, tournament order, character content, commentary, HTML or visual styles.

## Verification boundary

The local static server was started at `http://127.0.0.1:8000/ragdoll-olympics/`. The available browser rejected navigation with **`net::ERR_BLOCKED_BY_CLIENT`**. No live-browser playthrough, developer-console inspection, real hard refresh, physical touch-device check or browser CSS-layout check is claimed.

The runs below execute the actual game modules, Matter.js, event handlers and native Canvas with **JSDOM, simulated RAF/window sizes and synthetic keyboard/pointer events**. Reload tests create a new document/module graph using the previous document's serialized storage. The audio double verifies scheduling, initialization, rejection and cleanup; it cannot verify audible sound or a real browser's autoplay policy.

## Reproduced problems, causes and repairs

| Problem | Reproduction and root cause | Repair |
| --- | --- | --- |
| Newer campaign saves were overwritten | Load a campaign object with `version: 99`, then select a character. Normalization supplied defaults, and `select()` immediately persisted them over the original bytes. | Preserve newer versions with a write guard and an explanatory notice. In-memory play remains available. Only the existing confirmed campaign reset removes that guard. |
| Newer temporary-run saves were overwritten | Load a run object with `version: 99`, then confirm a character. The unsupported run became `null`; automatic `begin()` saved a replacement. | Preserve the original bytes through ordinary play, character changes and reloads. Only confirmed New run or campaign reset permits replacement. |
| Unchanged progress generated redundant writes | Twenty worse replays of an already-cleared level caused **40 medal/run writes**. Both save paths wrote regardless of whether data changed. | Cache the last successfully saved serialization. The same reproduction now causes **zero writes**. Failed writes still retry; legitimate achievement event-watermark writes remain intact. |
| Focused touch buttons did not work correctly from the keyboard | Enter on PUSH/LEFT did nothing. Space on BRACE produced a push. Touch buttons owned only pointer events while the global input owner consumed Enter/Space. | Keep the single keyboard owner, route focused control-button Enter/Space to the matching action, hold rotation until release, reject repeat, and clear pressed state on transitions/blur. |
| Space could not activate tutorial menu buttons | Space on focused Next drill was prevented and enqueued a cart push instead of activating the button. | Activate the focused tutorial button once, preserving held-key gating. Ordinary Space/Up gameplay input still works away from buttons. |
| Failed audio startup displayed the wrong status | Reject `AudioContext.resume()`: audio stayed suspended while the button read SOUND ON. The rejection was swallowed without updating availability. | Route rejection through existing `disable()`: SOUND N/A, stopped voices, silent playable game, no unhandled rejection or repeated initialization. |

The save schemas remain campaign v1, run v1 and achievements v2. Existing valid progress is not reset or converted into a different schema.

## Tests actually performed

All commands below completed successfully on the revised source. `npm test` was also run before editing as a baseline.

| Command / configuration | Completed coverage |
| --- | --- |
| `npm test` | **130 deterministic assertion groups** across physics, state transitions, input, presentation/audio, skills, tricks, all conditions/objectives/upgrades, progression, achievements, save integrity and balance. Separately, **108 successful root/project-prefix HTTP requests**, JavaScript MIME checks and an intentional missing-asset 404. |
| `VIEWPORT_WIDTH=1366 VIEWPORT_HEIGHT=768 npm run test:campaign:dom` | **63 attempts**. Full ten-level campaigns with Jake, Brandon and Owen; a second full Jake campaign declining upgrades; Jake's Overtime; replay; pending-reward resume; five saved-data reloads; corrupt/old/future/denied storage; separate resets; return to Party; eight isolated developer combinations. |
| `MOBILE=1 VIEWPORT_WIDTH=360 VIEWPORT_HEIGHT=740 npm run test:campaign:dom` | The same **63 attempts / four complete campaigns**, using pointer push, brace and rotation controls. Five saved-data reloads. |
| `VIEWPORT_WIDTH=1366 VIEWPORT_HEIGHT=768 npm run test:dom` | **Three complete Party Tournaments**, restarting between them: 15 scored jumps plus two numeric-fault/recovery attempts. Includes a normal tournament, mixed idle/crash attempts, and an all-zero championship tie. |
| `TOURNAMENTS=1 VIEWPORT_WIDTH=1920 VIEWPORT_HEIGHT=1080 npm run test:dom` | One full tournament plus two fault/recovery attempts and restart, with the wide simulated window. |
| `MOBILE=1 AUDIO_UNAVAILABLE=1 VIEWPORT_WIDTH=360 VIEWPORT_HEIGHT=740 npm run test:dom` | One full tournament plus two fault/recovery attempts and restart using touch input, with audio unavailable. |
| `npm run test:accessibility:dom` | Enter and Space on PUSH, BRACE, LEFT and RIGHT; visible pressed state; repeat suppression; key release; held-key hand-off; focused tutorial Space activation; blur and listener disposal. |
| `node tests/render-budget.mjs` | Native Canvas launch/impact renders, 96-particle stress measurements, and **40 additional full physics attempts** in one process with complete world disposal checks. Desktop and narrow Canvas images were visually inspected. |

That is **eight complete campaign runs and five complete Party Tournaments**, comprising **157 completed integration attempts** including deliberate failures and developer cases. These are automated integration playthroughs, not human browser sessions. The separate unit/balance and performance flights are not included in that 157.

### Exact campaign flow

Main menu → Vault Run → select character → full biography → explicit confirmation → map → announced level/condition/objective → Begin jump → timed pushes, takeoff, rotation and brace → results → upgrade choice where offered → map. Each character clears all ten levels. Gauntlet uses three separately confirmed heats and one exact summed score. Overtime unlocks after the main campaign. A worse replay retains the best medal. New run clears upgrades and reward history but keeps medals and achievements. Campaign and achievement resets remain separate and default to Cancel. Returning to Party starts with empty tournament scores and no campaign `RunEffects`.

Jake's additional no-upgrade campaign finishes all ten levels and unlocks Factory Settings. The save-reload cases preserve highest medals, per-character records, seeds, pending choices, upgrade limits, dates and equipped cosmetic rewards. Missing storage starts fresh; corrupt JSON/`null`/unsupported old data loads safely; newer data remains byte-for-byte intact until the appropriate explicit reset.

### Exact Party flow

Main menu → Party Tournament → three optional interactive drills → qualifying introduction → Jake biography/Ready/jump/results → Brandon biography/Ready/jump/results → Owen biography/Ready/jump/results → elimination → championship introduction → two fresh finalist biography/Ready/jump/results sequences → winner or tie → Restart tournament → title and another tournament.

Desktop tournament score totals were `[808, 530, 1094, 806, 1337]`, `[0, 521, 735, 604, 1337]`, and `[0, 0, 0, 0, 0]`. Selection/order, elimination, fresh final-round scores and tie handling were asserted. The wide run repeated the first sequence. Touch scores were `[808, 530, 1094, 808, 603]` with its input script.

Jake's introduction was held for **15.0 real seconds** without advancing. All character introductions were additionally held for 23 simulated seconds, manually continued by click or Enter, and checked for held-Enter leakage. Restart did not restore an introduction timer.

## Audit findings and balance

- **Input/lifecycle:** persistent listeners remained one per owner (one input keydown owner plus one audio gesture listener); one RAF chain; no gameplay timeout/interval calls. Key repeats, duplicate keydowns, pointers, release/cancel, frame gaps, blur/visibility and pre-takeoff restart were exercised. Popups did not intercept controls.
- **World reset:** disposed worlds had zero bodies, constraints, collision callbacks and collision pairs. Particle/audio pools stayed bounded; Party runs observed peaks of 48 particles and 12 voices against limits of 96 and 24. Mute/unmute used one audio context; unavailable audio used none.
- **Save integrity:** old v1 medal/run records and v1→v2 achievement migration retained medals, rewards and dates. Duplicate event IDs stayed rejected across reloads. New run, campaign reset, achievement reset, character changes, unrelated storage and sound preferences were checked independently. No active physics frame wrote localStorage. Each 63-attempt campaign suite made 51 medal, 76 run and 150 achievement writes across its full set of fresh/reloaded/corrupt/dev fixtures; no claim is made that these are per-run counts.
- **Medals/progression:** finite completed-attempt guards, highest-tier selection, prerequisite locks, replay, Gauntlet aggregation, Overtime unlock and no duplicate upgrade farming passed. No character remained stuck.
- **Mode/character isolation:** campaign upgrades were absent from Party worlds. Character passives remained tied to the actual competitor; new runs cleared temporary upgrades. Cosmetic rewards did not alter physics or scores.
- **Scores/tricks:** displayed distance + style + landing + attachment equaled the displayed total; displayed trick multipliers reproduced style points; three heat totals reproduced combined score. Forward/backward rotations, wrap boundaries, oscillation rejection and diminishing repeats passed. Deliberate numeric faults produced finite safety-stop results and a healthy next attempt.
- **Balance:** the existing 45-flight, no-upgrade Matter matrix earned **Gold on all ten levels and Overtime with all three characters**, using discrete 60 Hz controls into the normal 120 Hz physics simulation. Timed pushes outperformed holding, rough novice taps reached the ramp, and brace/takeoff differences affected results. Good and bad landings occurred. No reproduced threshold or physics problem warranted retuning. The controller reads simulation state; this proves attainability, not human difficulty or reaction-time fairness.
- **Assets/paths:** all runtime modules and assets served from `/` and `/ragdoll-olympics/`. Intended absent PNG portraits rendered initials without producing image requests in the DOM tests. No new runtime dependencies or absolute asset paths were added.
- **Errors:** captured game error/warning arrays were empty in all five integration suites. Node emitted its known VM Modules experimental warning outside the game console; this is a test-runtime warning, not a browser-console result.
- **Accessibility/readability:** controls are native buttons with focus styles; reset defaults, explicit introductions, keyboard button semantics and touch press state passed event tests. Existing menu panels have bounded height and internal scrolling; no speculative layout rewrite was made. Native Canvas framing kept the cart/ramp/ground visible. World-space fine print is small on narrow views; the HTML HUD supplies gameplay readouts. Browser text clipping, actual tab-order scrolling, zoom and screen-reader behavior remain unverified.

### Native Canvas performance measurements

These measurements are from this container, not browser or device FPS. Each sample contains 240 measured frames after warm-up.

| Fixture | Mean frame time | 95th percentile |
| --- | ---: | ---: |
| Desktop 1246×560, no particles | 1.08 ms | 1.19 ms |
| Desktop, 96 particles | 1.53 ms | 1.92 ms |
| Narrow 330×420, no particles | 0.88 ms | 1.28 ms |
| Narrow, 96 particles | 1.23 ms | 1.28 ms |
| Same narrow fixture after 40 attempts, 96 particles | 1.43 ms | 1.73 ms |

Mean execution time for the first ten stress attempts was 110.7 ms, versus 99.5 ms for the last ten. No bodies/constraints/callbacks/pairs survived disposal. These limited measurements do not establish long-session browser memory usage or mobile battery/performance behavior.

## Files and functions changed in this pass

| File | Exact changes |
| --- | --- |
| `js/campaign-save.js` | `CampaignSave.constructor`, `persist`, `reset`: newer-version protection, successful-serialization cache, explicit reset unlock. |
| `js/run-save.js` | `RUN_SAVE_VERSION`; `normalizeRun`, `RunSave.constructor`, `read`, `write`, `begin`, `resetProgress`: protected future saves, unchanged-write suppression, confirmed replacement option. |
| `js/campaign.js` | `Campaign.confirmNewRun`: explicitly permits replacing an unsupported future run after the existing confirmation. |
| `js/input.js` | `Input.constructor` keydown/keyup handlers, `clear`, new `releaseButton`: route focused control-button input and tutorial Space activation through the persistent owner; retain held-key blocking. |
| `js/touch.js` | Constructor pointer handlers, new `press`/`release`, `clear`: shared edge/hold actions for pointer and keyboard, with correct capture and pressed-state cleanup. |
| `js/game.js` | `Game.constructor`: wires the input owner's `onControlButton` callback to touch control actions. |
| `js/audio.js` | `SynthAudio.unlock`: rejected resume uses the existing unavailable-audio path. |
| `tests/final-regression.mjs` (new) | Five dependency-free save-integrity groups: future-version guards, confirmations, no-op writes, failed-write retry and old/corrupt recovery. |
| `tests/accessibility-dom.mjs` (new) | Focused control/tutorial keyboard regression coverage and lifecycle cleanup. |
| `tests/presentation.mjs` | Assert unavailable audio status after rejected resume. |
| `tests/campaign-dom.mjs` | Configurable simulated window dimensions, actual write counters, no writes during active frames, old/future companion-save fixtures and byte-preservation assertions. |
| `tests/dom-flow.mjs` | Configurable simulated window dimensions/tournament count and recorded viewport evidence. |
| `tests/render-budget.mjs` | Forty repeated attempts, disposal assertions and after-repeat performance measurements. |
| `package.json` | Adds save regressions to `npm test` and the optional `test:accessibility:dom` command. |
| `README.md`, `QA.md` | Updated persistence/control documentation, commands and this report. |
| `deliverables/ragdoll-olympics-vertical-slice.zip` | Rebuilt static source/test/documentation archive. |

## Remaining known limitations

1. Live browser preview was blocked. Actual hard refresh/cache behavior, physical touch, 1366×768/1920×1080/mobile CSS layout, screen-reader/zoom behavior, browser-console output and audible/autoplay behavior remain to be verified in an accessible browser.
2. Human balance and the stated 20–30-minute first-play campaign duration remain unverified. The deterministic input policy is more precise than a novice player.
3. Six existing achievements require unimplemented mechanics/telemetry, as listed in README.md. They remain explicitly marked as future mechanics; this no-new-features pass does not add those mechanics.
4. Unfinished Gauntlet heats are not persisted, as announced before play. Completed medals and rewards persist. Saves remain browser/origin-local; unavailable storage cannot persist beyond the page.

## Installed character headshots — September 25, 2026

See PORTRAITS.md for exact image sizes, crop details, changes and verification. All existing core tests passed, including 192 static HTTP requests across root and both project prefixes. One desktop and one narrow touch Party tournament passed; the campaign harness passed 63 attempts across all characters. The new portrait DOM test verified mappings, labels, per-character positioning, drag prevention and missing-image fallback for all three characters. No captured game errors/warnings. Exported portraits were visually inspected; browser layout verification remains outstanding. Original uploads are excluded from the delivery.

## Santor Sync — September 25, 2026

See SANTOR_SYNC.md for the complete tuning/configuration, changed-file inventory and honest test limitations. The core suites, 7 new deterministic Sync groups, 9 music groups and 207 static path requests passed. Forced all-character/all-grade keyboard and touch scenarios, pending/earned-result refresh, frozen Matter bodies, input release gating, pause/reset, independent music ducking, no timer/listener leaks, all-character campaign regressions (63 attempts) and two Party Tournaments passed in DOM/physics harnesses. Party was excluded even with the force flag. Actual preview was blocked by ERR_BLOCKED_BY_CLIENT; audible/human-play and browser layout checks remain outstanding. Perfect peak rise measured about +24%, with one extra Owen flip in the sampled run. The three-rotation achievement hook passed telemetry tests, but no sampled playable attempt reached three rotations; practical achievement balance remains unverified.
