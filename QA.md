# Trick recognition and combination verification

Updated 2026-09-18. This report covers the trick-system pass and supersedes the earlier skill-loop totals. The physics result values changed where the new style system or Owen's requested high-speed rotation interaction applies.

## Implementation and preserved behavior

New attempt-local `TrickTracker` recognition runs on the same 120 Hz physics clock. Rotation is unwrapped by signed shortest-angle deltas, completed 360° milestones are credited within directional runs, and credited milestones survive small reverse movements without paying twice. A reversal above 0.18 radians starts a fresh run from the actual turning point. Continuous 720° travel completes two rotations and one separate Double Flip pair bonus, never three rotations.

No Hands observes both existing hand-to-cart constraint anchors. It requires sustained residual stretch and an attached recovery in the air. Last-Second Appeal checks a sustained extreme tilt, controlled recovery, and actual first-contact timing. Clean Flight checks airtime, distance, controlled fraction, and total angular travel. No joint was loosened or added.

Unique tricks build a combo. Repeat credit is attempt-wide and decreases to 20%, then 5%, then zero. Instability can break the current combo without deleting banked points or refreshing repeat credit. Recognition stops at the first ground contact, including the contact step itself; final records freeze once at attempt end. Final style receives the character multiplier and a landing multiplier. Distance, landing points, attachment points, and the four-component total remain intact.

Popups live in a fixed-height strip below the Canvas/timing meter and above the touch bar. They have no interactive elements, use `pointer-events: none`, never take focus, and expire on simulation time. Up to four short names can be visible. The results table shows each occurrence's base points, repeat factor, combo factor, and rounded subtotal, then the exact final style equation.

Compared with the pre-change snapshot, these files are byte-for-byte unchanged: `js/game.js`, `js/input.js`, `js/touch.js`, `js/skills.js`, `js/skill-config.js`, `js/skill-ui.js`, `js/tutorial.js`, `js/tournament.js`, `js/characters.js`, `js/passives.js`, `js/commentary.js`, `js/introductions.js`, `js/renderer.js`, `js/presentation.js`, `js/audio.js`, `styles.css`, `flash.css`, and `skills.css`. The push, takeoff and brace implementation; tournament state machine; biographies; commentary; manual introductions; geometry; joint settings; gravity; solver; end conditions; audio; and existing styles remain unchanged. Physics receives only recognition hooks and the configured Owen rotation scale.

## Requested verification

| Check                                        | Actually performed                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One forward rotation registers exactly once  | A deterministic 359.4° partial rotation earned nothing; completing 360° produced one Front Flip, with no duplicates while holding the angle. A real controlled flight for every character also earned exactly one Front Flip.                                                                                                                        |
| One backward rotation registers exactly once | A wrapped-angle 360° backward stream produced exactly one Back Flip. Real backward flights registered Back Flip in the full game integration.                                                                                                                                                                                                        |
| Oscillating near zero earns nothing          | Repeated ±0.03 rad, ±0.22 rad, and incomplete 171° reversals produced zero rotations and zero trick points. Fast near-level oscillations also failed Clean Flight's control/travel criteria.                                                                                                                                                         |
| Two wrapped rotations do not become three    | Forward and backward 720° wrapped streams both produced exactly two completed rotations, two respective flip occurrences, and one separate Double Flip bonus. Re-crossing a credited boundary 30 times produced no new flip.                                                                                                                         |
| Popups do not interfere with controls        | DOM integration verified no focusable/interactive popup elements, computed `pointer-events: none`, and placement outside the Canvas action area. Nonzero rotation inputs continued through the actual physics handler while popups were visible. Desktop and touch tournament/restart flows passed. This is simulated input, not a browser hit-test. |
| Results totals match the breakdown           | Every displayed occurrence equaled `round(base × repeat × combo)`. Their sum matched the displayed trick subtotal; character and landing factors reproduced displayed style; all four displayed components summed to the attempt total. Finite/capped scoring tests also passed.                                                                     |
| Existing tournament flow works               | Three complete desktop-mode DOM tournaments, restarting between them, plus a complete pointer-driven narrow-mode tournament and restart. Exact orders, elimination, independent round scores, winners/ties, input registration, and world cleanup passed.                                                                                            |

## Deterministic and physical tests

`tests/tricks.mjs` contains **16 groups** covering forward/backward turns, wrapped 720° travel, incomplete reversals, threshold jitter, non-overlapping doubles, sharply diminishing repeats, No Hands strain/recovery/attachment requirements, Last-Second Appeal timing, Clean Flight requirements, character combo differences, landing style factors, finalization/reset, malformed samples, real controlled flips, an actual Double Flip, and numeric caps.

Observed controlled-flight results:

| Character | Recognized tricks                          | Style points |
| --------- | ------------------------------------------ | ------------ |
| Jake      | Front Flip + No Hands + Last-Second Appeal | 709          |
| Brandon   | Front Flip + No Hands                      | 596          |
| Owen      | Front Flip + No Hands                      | 463          |

The same isolated Front Flip earned **240 style points on a Clean landing** and **68 on a Crash**. Repeated Front Flip events used factors `1, 0.20, 0.05, 0, 0, 0`; breaking a combo did not restore their credit. In a mild-instability fixture, Jake kept his combo while Brandon broke it. With the same two unique tricks, Jake's combo reached ×1.25 and Brandon's ×1.40, in addition to Brandon's existing ×1.35 character style multiplier.

A real Owen backward flight with a Perfect takeoff at cart-centre x=1040 completed **720.654°**, registered **two Back Flip occurrences and one Double Flip bonus**, and earned **495 style points**. This verifies actual attainability; human consistency still needs live play.

The previous 43 physics/tournament, stability, personalization, presentation and skill-loop groups also passed, with legacy maximum-angle scoring fixtures updated to the new completed-trick rule. The strict detached-crash fixture now uses Brandon, because Owen's added rotation torque changes that particular crash's attachment outcome. The detachment assertion was retained.

## Complete flow and outcomes

The desktop flow was Title → Instructions/tutorial → Qualifying introduction → Jake biography → Ready → attempt/results → Brandon biography/Ready/attempt/results → Owen biography/Ready/attempt/results → Elimination → Championship introduction → both finalists' biography/Ready/attempt/results → Final results → Restart → Title. This completed three times without refreshing.

| Run | Qualifying: Jake / Brandon / Owen | Eliminated | Championship order and points | Winner         |
| --- | --------------------------------- | ---------- | ----------------------------- | -------------- |
| 1   | 808 / 530 / 1094                  | Brandon    | Jake 806; Owen 1337           | Owen           |
| 2   | 0 / 521 / 735                     | Jake       | Brandon 604; Owen 1337        | Owen           |
| 3   | 0 / 0 / 0                         | Owen       | Brandon 0; Jake 0             | Brandon + Jake |

The first run included normal, braced, rotated, clean and crashed attempts. The second included an idle qualifier. The third deliberately timed out every attempt and produced a shared final victory. After restarting again, an injected NaN cart position stopped safely with finite points, and the next competitor completed a healthy attempt. These recovery checks are not an additional tournament.

The desktop harness observed **1084 fixed physics steps with active steering while popups were visible**. It displayed Front Flip, Back Flip, repeated flips, Double Flip and Clean Flight. No Hands and Last-Second Appeal were additionally verified in the real physics checks above.

The mobile-mode harness used a simulated 360 × 740 viewport and 330 × 420 Canvas, button confirmations, fresh pointer-down pushes/braces, and held pointer rotation. It observed **542 steering steps with visible popups**, completed five tournament attempts, restarted, and passed fault recovery. Its qualifying totals were 808 / 530 / 1094; its final was Jake 808; Owen 1337.

A further complete mobile-mode run with `AUDIO_UNAVAILABLE=1` passed its five attempts, restart, and fault recovery. It used zero audio contexts, observed 459 steering steps with visible popups, and captured zero game errors/warnings/timers. This confirms the trick system does not depend on sound.

Every replaced engine had no surviving bodies, constraints, collision callbacks, pairs, or detector bodies. There was one animation loop and one listener set per owner. No trick code creates listeners, intervals, or timeouts. Held Enter, repeated Space/Up events, touch cancellation/release, prelaunch R, flight restart lock, blur/visibility pause, discarded large frame gaps, canvas resize, missing PNG prevention, and all three manual biographies passed. Jake's first card remained visible for **15.03 real seconds**, and all character appearances stayed open across 23 simulated seconds until manually continued.

Captured game output: **zero errors, zero warnings, zero window errors, and zero game timeout/interval calls** in all final full-flow runs. The host npm configuration warning and Node experimental-VM warning are separate from the game output.

## Files and functions changed

| File                               | Change                                                                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `js/trick-config.js`           | Frozen `TRICK_CONFIG`, `trickProfile`, `trickRotationScale`: all trick thresholds/points, repeat/combo/landing factors, character interactions, caps, and popup lifetime/count.                                                                 |
| New `js/tricks.js`                 | `TrickTracker` lifecycle, continuous rotation and milestone recognition, strain/recovery and control-history checks, combos, notices, immutable final snapshot; `trickSample` reads actual physics; `scoreTricks` computes bounded subtotals.   |
| New `js/trick-ui.js`               | `TrickDisplay` renders noninteractive, simulation-timed popups; `trickBreakdown` renders the per-occurrence table and score equation.                                                                                                           |
| New `tricks.css`                   | Fixed-height popup area, arcade text, compact result table, narrow layout, and reduced-motion support. Existing stylesheets are unchanged.                                                                                                      |
| `js/physics.js`                    | Constructor owns tracker; `step` samples airtime and applies only Owen's configured high-speed rotation bonus; `handleCollisions` captures the first-contact step; `finish` freezes tricks; `metrics` includes the snapshot.                    |
| `js/scoring.js`                    | `scoreAttempt` replaces maximum-angle quarter-turn style with recognized-trick style. Distance/landing/attachment formulas and ranking functions are unchanged. The compatibility `quarterTurns` field is derived only from complete rotations. |
| `js/ui.js`                         | Constructor/reset/observe/render wire passive trick feedback and results; instruction style rules are generated from configuration. Input listeners are reused.                                                                                 |
| `index.html`                       | Relative trick stylesheet and passive trick HUD below the timing meter.                                                                                                                                                                         |
| New `tests/tricks.mjs`             | Sixteen deterministic/physical trick and scoring groups.                                                                                                                                                                                        |
| `tests/physics-and-tournament.mjs` | Updates old maximum-angle expectations and preserves a strict detached-crash fixture with Brandon.                                                                                                                                              |
| `tests/stability.mjs`              | Proves a completed turn on the actual first-contact integration step is included once.                                                                                                                                                          |
| `tests/personalization.mjs`        | Uses one recognized flip in the same-jump character style comparison.                                                                                                                                                                           |
| `tests/dom-flow.mjs`               | Verifies popup/input separation, popup names, displayed trick arithmetic, and existing complete flows. `moduleAt` now caches each loaded module synchronously to prevent duplicate module identities in the test harness.                       |
| `tests/static-files.mjs`           | Includes all new relative assets under root and project-prefix URLs.                                                                                                                                                                            |
| `package.json`                     | Runs the dependency-free trick tests in the existing test command. No new build system or runtime dependencies.                                                                                                                                 |
| `README.md`, `QA.md`, project ZIP  | Trick rules/tuning, exact implementation/test record, and refreshed project.                                                                                                                                                                    |

## Verification harness repair

A silent-mode regression run exposed a race in the optional test harness: concurrent imports could construct two SourceTextModule instances for the same file, so instrumentation could attach to an unused PhysicsWorld class. The game uses the browser's native module loader and does not contain that custom loader. `tests/dom-flow.mjs: moduleAt` now caches synchronously before another import can request the same file. The affected desktop, touch, and silent-touch flows were rerun using that corrected loader.

## Configuration

The full thresholds and point values are documented in `README.md` and `js/trick-config.js`. Key settings: 360° rotations, 10.3° reversal hysteresis, 100%/20%/5%/0% repeat credit, +0.25 combo per new unique trick (Brandon +0.40), combo cap ×2.50, and landing factors Clean ×1.60 / Scrappy ×1.25 / Rough ×1.00 / Crash or no landing ×0.45. Jake has 400 ms combo-instability grace; the default is 180 ms and Owen has 120 ms. Owen's extra spin-building torque scales from zero to +32% over horizontal speeds 14–24 Matter units. Acceleration, takeoff, brace, counter-steering, and angular-speed cap code is otherwise retained.

## Commands and limits of verification

```sh
npm test
node --experimental-vm-modules tests/dom-flow.mjs
MOBILE=1 node --experimental-vm-modules tests/dom-flow.mjs
MOBILE=1 AUDIO_UNAVAILABLE=1 node --experimental-vm-modules tests/dom-flow.mjs
```

**59 groups passed** (12 physics/tournament, 8 stability, 8 personalization, 5 presentation, 10 skill-loop, 16 tricks). The dependency-free static server served **66 successful root/project-prefix requests**, including the new stylesheet and modules, with correct JavaScript MIME types. The deliberate missing-file 404 check passed. GitHub Pages was not deployed.

The full-flow checks use the real source and Matter.js inside **JSDOM with native Canvas and simulated input/layout/frame timing**. They are not live-browser playthroughs. Live preview was unavailable in the preceding work, and no live browser, browser developer console, real-device hit testing, or human timing assessment was performed here. Existing native Canvas rendering ran as part of the integration; no new browser rendering/performance claim is made.

Remaining limitations: live desktop/phone layout and popup readability need hands-on verification; Double Flip difficulty and the very small constraint-strain thresholds should be evaluated with real play across browsers. No unresolved logic failure was reproduced in the tests performed.
