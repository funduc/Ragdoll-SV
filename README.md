# Ragdoll Olympics: The Santor Vault

A playable Shopping-Cart Long Jump game with **VAULT RUN**, a saved single-player campaign, and the original **PARTY TOURNAMENT** for three local players. Vanilla HTML, CSS, JavaScript modules, Canvas, and **Matter.js 0.20.0**. No game backend, accounts, build step, or runtime network dependencies.

## Play locally

Serve the project folder with any static server, for example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. ES modules require HTTP; do not open `index.html` as a `file://` URL.

Alternatively, with Node.js installed, `npm run dev` starts the included dependency-free static test server. No `npm install` is needed to play. This server also serves `/ragdoll-olympics/` for project-prefix checks. The server is a development utility only.

## GitHub Pages

Put the project files at the root of your repository. In GitHub Pages, publish that branch and the root folder. `index.html` and every runtime asset use relative paths, including the local Matter.js build, so the game works under a project URL such as `/ragdoll-olympics/`. No build action is required. The `tests/` directory and `package.json` are optional on the published site.

## Controls

| Key        | Action                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| Space / Up | Tap once per push; aim for the green rhythm zone, then the takeoff zone |
| Left / A   | Rotate backward in the air                                              |
| Right / D  | Rotate forward in the air                                               |
| Down / S   | Brace once in the air, shortly before first ground contact              |
| Enter      | Continue an introduction or confirm the current menu                    |
| R          | Reset **before takeoff**, replaying the introduction and hand-off       |

Air controls stop at the first landing. R is ignored after takeoff and on results screens. Switching tabs or losing focus pauses the simulation and clears held input. Press the controls again when returning. Menus never start an attempt automatically.

On a touch screen, tap **PUSH** or **BRACE**, and hold **LEFT** / **RIGHT** to rotate. Four large buttons sit below the Canvas, outside the action area. Holding PUSH or BRACE does not repeat the action. The buttons appear for coarse-pointer or non-hover layouts and work during attempts and the optional instructions tutorial. Release/cancel, pause, results, and resets clear touch state. After a long frame stall, release and press again. Keyboard controls remain available.

## Three-phase skill loop

The instructions screen contains three short, optional interactive drills. Tap the practice button or use the actual controls, read the grade, then choose **Next drill**. **Try again** repeats a drill. **Meet the competitors** is a separate confirmation and may skip practice. Practice never changes tournament scores.

1. **Rhythm:** a marker crosses the timing meter every 0.72 seconds. Tap Space/Up or PUSH in green for Perfect, amber for Good. A missed or spammed press adds little speed and an alternating wobble. Each tap supplies a finite push and follow-through; holding a key never supplies continuous force. A first-push kick helps inexperienced players get moving. Character acceleration still scales the push.
2. **Takeoff:** the meter changes to cart position near the ramp edge. The first push after the arming line commits the one launch opportunity. Push in the painted green zone for Perfect speed and stability, amber for Good. Early consumes the bonus; Late or no takeoff push adds forward pitch. Further pushes cannot repair a spent boost. Grades have synthesized cues and visible feedback; Perfect adds a small bounded spark burst.
3. **Landing:** rotate toward wheels-down, then tap Down/S or BRACE once. The meter estimates contact time; the grade uses the **actual first ground collision**. An early brace reduces manual air control after 400 ms. Perfect/Good braces increase impact-speed tolerance, but do not remove tilt limits, erase crashes, or force the cart upright. A late press has no impact benefit.

All tuning lives in the documented, frozen **`SKILL_CONFIG`** in `js/skill-config.js`. Time is simulation seconds; positions are world pixels. Speed increments are Matter units (pixels per 1/60-second frame), not metres per second. There is no random acceleration.

| Setting                                       | Current value                                                      |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Rhythm period                                 | 720 ms                                                             |
| Perfect / Good timing                         | Within ±12% / ±30% of the meter centre (±86.4 / ±216 ms)           |
| Minimum intentional push interval             | 240 ms; faster pushes count as Miss                                |
| Perfect / Good / Miss / spam speed increments | 3.8 / 2.6 / 1.2 / 0.08, scaled by character acceleration           |
| One-time first-push kick; run-up speed cap    | 4.5; 15.5                                                          |
| Perfect / Good / Miss follow-through          | 580 / 460 / 220 ms at 0.95 × character acceleration; spam has none |
| Miss wobble; maximum wobble impulse result    | ±0.014 angular velocity; capped at ±0.045                          |
| Perfect push angular damping                  | ×0.65                                                              |
| Takeoff arms / Good zone / Perfect zone       | x=860 / x=940–1090 / x=980–1060; ramp edge x=1080                  |
| Takeoff speed increment                       | Base 1.5; Perfect adds 6, Good adds 3; capped at 29                |
| Perfect / Good takeoff angular damping        | ×0.25 / ×0.65                                                      |
| Late takeoff forward rotation                 | +0.035 angular velocity                                            |
| Takeoff follow-through                        | 500 ms                                                             |
| Perfect Brace lead time                       | 90–220 ms before contact                                           |
| Good Brace lead time                          | 35–400 ms before contact, outside the Perfect window               |
| Perfect / Good impact tolerance               | ×1.40 / ×1.18                                                      |
| Early / Late / Unbraced tolerance             | ×1.00; Early leaves 38% of manual air control after 400 ms         |
| Practice sweep (takeoff / brace)              | 2 seconds                                                          |
| Takeoff meter extension                       | 40 pixels beyond the Good zone                                     |
| Landing meter horizon; feedback duration      | 850 ms; 850 ms                                                     |
| Maximum queued push events per physics step   | 4 (multiple queued presses are spam in the rhythm phase)           |

The run-up force is applied only within a tap's finite follow-through window. Its duration uses the fixed physics clock. Launch impulse moves the joined cart/rider assembly together to avoid stretching the joints. Existing character passives and all terrain, body, joint, collision, and end-of-attempt settings are retained except the explicit brace tolerance and input-driven impulses described above.

## Tricks and combinations

The same Left/Right or A/D controls perform flips. Tricks are recognized from the physical flight; no new input or loose components were added. A passive popup strip sits below the timing meter, outside the Canvas and touch targets. It cannot receive focus or pointer input, reserves its height, and uses simulation time instead of timeout/interval timers.

| Trick              | Requirement                                                                                                                                                                   | Base points |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Front Flip         | Complete 360° forward in one directional run                                                                                                                                  | 150         |
| Back Flip          | Complete 360° backward in one directional run                                                                                                                                 | 150         |
| Double Flip        | Complete two full rotations in the same direction; one bonus for each non-overlapping pair                                                                                    | 180         |
| No Hands           | Both hand anchors strain by at least 0.10 world pixels for 70 ms, then recover to at most 0.035 pixels for 80 ms while still attached and airborne                            | 90          |
| Last-Second Appeal | Sustain at least 114.6° tilt for 60 ms, recover to within 22.9° of level at ≤2.4 rad/s for 50 ms within 750 ms of that extreme, then contact ground within 350 ms of recovery | 120         |
| Clean Flight       | Fly at least 1.15 s and 30 m; remain within 25.8° of level at ≤1.6 rad/s for at least 80% of airtime, with no more than 74.5° of total angular travel                         | 75          |

No Hands measures the small, real residual stretch left by the existing stable hand constraints. It does not detach the rider or loosen joints. Recovery must happen in the air; a broken attachment or post-landing recovery does not qualify.

Rotation is unwrapped continuously between fixed steps. Completed 360° milestones are counted within directional runs. Reversing more than 0.18 rad (10.3°) starts a new run from the actual turning point; small reversals neither reset a credited milestone nor accumulate free rotations. A Double Flip adds a separate pair bonus: two Front Flips plus that bonus still mean **two rotations**, not three. Partial spins and small back-and-forth movements earn no rotation points. All recognition stops at first ground contact; records are frozen once the attempt ends. Post-contact rolling and tumbling cannot add tricks.

Each distinct trick in an unbroken combo raises its multiplier by **0.25**, starting at ×1.00 and capped at ×2.50. This multiplier applies when each occurrence is banked; it does not retroactively multiply earlier events. Repeating the same trick anywhere in the attempt pays **100%, 20%, 5%, then 0%** of base value. Breaking the combo never restores full repeat credit.

Sustained grip strain above 0.18 pixels or spin faster than 9 rad/s breaks the current combo after 180 ms; detachment breaks it immediately. Banked trick points remain. Normal controlled flips do not lose a combo merely for passing through an upside-down angle.

- **Jake:** his existing slower rotation stays intact. His combo survives up to **400 ms** of mild instability instead of 180 ms.
- **Brandon:** his existing ×1.35 character style bonus remains. Unique tricks raise his combo by **0.40** instead of 0.25.
- **Owen:** building a spin gets up to **32% extra rotation torque**, scaling with horizontal speed from 14 to 24 Matter units. Counter-steering, acceleration/takeoff/brace rules, and the existing angular-speed cap are unchanged. His combo strain threshold is 0.16 pixels with a 120 ms grace; his existing lower landing stability remains.

| Final landing                 | Trick-style multiplier |
| ----------------------------- | ---------------------- |
| Clean                         | ×1.60                  |
| Scrappy                       | ×1.25                  |
| Rough                         | ×1.00                  |
| Crash or no completed landing | ×0.45                  |

Each occurrence earns `round(base × repeat × combo)`. Style is `round(sum(occurrences) × character style × landing multiplier)`, capped at 5000. Distance, landing points, and attachment points remain the other three components. The results show every trick's base, repeat factor, combo factor, and points, then the exact final style calculation and overall total.

All thresholds, trick names/values, character interactions, caps, and popup limits live in the frozen **`TRICK_CONFIG` in `js/trick-config.js`**. The recognizer rejects invalid values and angle discontinuities above 0.8 rad per fixed step. It retains at most 24 scored occurrences and displays at most four simultaneous popups for 1.05 s each. These are safety bounds, not a source of random outcomes.

## Arcade presentation and sound

`flash.css` adds an original metallic arcade cabinet, beveled buttons, flame/lightning motifs, short menu wipes, score starbursts, and championship ribbons. The stadium uses procedural concrete, neon, and fictional sponsor boards. John's lower-third escalates during the final; its text panel stays still and readable.

Launch/landing dust, hard-impact sparks, and winner confetti share a cap of **96 particles**. Major crashes shake only the Canvas by at most **4 pixels for 0.22 seconds**. Effects use a separate random generator and never write to Matter bodies. Reduced-motion preferences disable shake, confetti, and CSS animations and reduce the remaining bursts.

Original Web Audio synthesis supplies clicks, rattle, launch, impact, crowd, elimination, victory, and distinct skill-grade cues. One audio context is created after the first user gesture; cues have a 24-voice limit and no JavaScript timers. The persistent **SOUND ON / MUTED** button works throughout the tournament. Mute preference survives a page reload when local storage is available. Mute, pause, reset, and disposal stop active voices. If audio is unavailable, the game continues silently and the button reads **SOUND N/A**.

## Vault Run

Choose **Vault Run** on the main menu, select Jake, Brandon, or Owen, and read the full biography, all statistics, strengths, weaknesses, ability, quote, and John introduction. **Confirm character** opens the map; the biography has no deadline. Each level has a separate **Begin jump** confirmation. The selected competitor stays with you throughout the run. Results return to the map; cleared levels remain replayable.

The first campaign contains **ten levels**, ending in a three-heat finale. Clearing its Bronze unlocks **Santor Gauntlet: Overtime**, a harder optional rematch. [CAMPAIGN.md](CAMPAIGN.md) contains every introduction, objective, Bronze/Silver/Gold requirement, optional Santor Medal, character-specific line, and success/failure caption.

| Level | Focus / announced condition | Gold |
| --- | --- | --- |
| 1. Orientation Day | Rhythm / original seeded lesson plan | Perfect takeoff |
| 2. Wheels Down | Brace / original seeded lesson plan | Perfect Brace and Clean landing |
| 3. Commit to the Bit | Tricks / original seeded lesson plan | Two unique tricks and successful landing |
| 4. Showboating 101 | Variety and combos / Standard | Three unique tricks and successful landing |
| 5. Cross Examination | Target control / Crosswind | First contact in 30–45 m zone; rider attached at finish |
| 6. Fragile Cargo | Physical boxed mug / Standard | Clean landing with cargo secured |
| 7. The Mapleton Run | Three visible runway repairs / Standard | Two Good-or-better pushes, no Misses, successful landing |
| 8. Ice Cream Weather | Sliding and bracing / Icy Ramp | Perfect Brace and Clean landing |
| 9. Siemens Certified | Speed and recovery / Wrate Issue | Maximum runway speed; recover and land attached |
| 10. The Santor Gauntlet | Boost Strip → Icy Ramp → Wrate Issue | 2,400 combined points; three successful landings, two Good-or-better Braces, two unique tricks across heats |

The **24-minute planning budget includes reading, practice and retries**. No forced waits were added. Automated attempts do not validate a human 20–30-minute playthrough; that pacing target remains a playtest question.

Perfect pushes count toward “Good-or-better.” A successful landing means **Clean or Scrappy**, without a recorded crash. The highest satisfied tier wins; Gold does not require separately satisfying Silver. Only finished, numerically valid attempts award medals. Bronze or better unlocks the following level for that character. Repeats never duplicate records or lower a saved medal; the result shows both this attempt's medal and the retained best. Points and their four-component breakdown are the same as Party Tournament.

`js/campaign-levels.js` retains the original three medal rules; `js/campaign-chapter.js` adds the seven levels and Overtime. Every level has an optional Santor condition. Main-level completion excludes Overtime. All levels keep gravity **1.05**, the original ramp, input windows, trick thresholds, and per-attempt score formula.

**Fragile Cargo:** a 22-pixel square physics body of mass 0.14 is tethered inside the basket using an ordinary Matter constraint (stiffness 0.55, damping 0.12). Sustained tilt beyond 1.35 radians for 0.18 seconds, or a severe crash, releases it once. The box turns orange, the HUD reports **MUG RESIGNED**, and results retain the loss. Loose cargo cannot trigger cart/rider first-contact distance or brace grading. Settling still follows cart/rider motion.

**Mapleton:** three outlined triangular repairs at x=380/530/665, widths 100/110/90 and heights 5/7/5 world pixels. They are real static collision bodies. Neither cargo nor repairs are created in Party Tournament.

**Gauntlets:** each heat uses the existing Ready → Attempt → Results flow with a fresh world. Enter must be released between Results, Ready, and Begin. The combined total is the exact sum of the three existing scores, with a component ledger; unique tricks are a union across heats. No medal, completion, reward, or Overtime unlock is granted before heat three. A prelaunch restart repeats only the current heat; returning to the map or refreshing discards the unfinished sequence. Saved best medals remain. Overtime raises landing/style/score requirements and begins with Heavy Cart instead of Boost Strip. Its optional Santor requirement is 3,900 points, three Clean landings, three Perfect takeoffs, and three Perfect Braces.

Rules use finished-attempt facts. Numeric conditions mean “at least”; booleans require an exact match. `Campaign` owns its own guarded transitions, selected character, level, attempt-local ramp observation, and last result. It uses the same fixed-step world, keyboard/touch owners, scoring, and result markup as Party Tournament. Campaign upgrades supply attempt-local tuning copies; the original Party tuning, tournament, trick recognizer, and scoring formula are preserved.

**Local progress:** expanding the existing level-ID catalog keeps the schema at version 1. Old three-level records, run seeds, pending rewards, temporary upgrades, and achievement timestamps survive; new levels default to no medal. Already-earned three-level completion achievements stay unlocked. New completion unlocks require all ten main levels. The version-1 object under `santor-vault:campaign` stores the selected character and one highest-medal record per character per level. It loads on page refresh. Missing, malformed, and unsupported-version data start safely with defaults; only known character/level IDs and valid medal ranks are accepted. A denied or full storage area keeps the game playable with an explicit page-only-save message. No scores or progress are sent to a server. Saves belong to this browser and origin; another device, private session, or site origin has separate storage.

**Change character** opens selection without clearing anyone's medals or achievements. Confirming a different character starts a new temporary run; confirming the current character resumes the saved run, including an unchosen reward. **New run** requires confirmation, clears temporary upgrades, refreshes the original lessons’ seeded plans, and restores reward opportunities while preserving medals, unlocks, and achievements. **Reset campaign progress** also requires confirmation, with **Cancel** focused by default; it clears every character's campaign medals/unlocks and the temporary run, while preserving achievements and objective badges. Achievement reset is a separate confirmation in the Achievement Vault. Neither operation changes Party Tournament, mute settings, or unrelated storage. Failed writes are reported, including that older data may return after reload.

### Conditions and optional objectives

The original three lessons retain their stored-seed condition/objective selection and do not reshuffle after this expansion. Levels 4–9 use their fixed, announced conditions and existing objective IDs; Gauntlets use the announced per-heat schedule. New runs change the original lessons’ seeded plans, not the authored later-level conditions. Selection happens before play; retries, replays, and refresh keep the same plan. The map and level briefing announce both. A fixed-height status row communicates the active condition during the jump. Forces never change randomly during airtime.

| Condition   | Effect and visible cue                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crosswind   | Steady rightward airborne force of `mass × 0.00012` on each dynamic body; **CROSSWIND →** indicator.                                                                             |
| Icy Ramp    | Ground/ramp friction `0.12`, wheel friction `0.18`, post-landing air drag `0.018` instead of `0.045`; pale-blue surface edge and slippery-landing status.                        |
| Heavy Cart  | Cart mass ×1.25, push acceleration ×0.85, landing stability ×1.12; briefing and persistent status.                                                                               |
| Boost Strip | Blue runway strip at world x=390–490 gives one +3 assembly-speed impulse, capped at 18.5; visible feedback and positive audio cue. This does not consume the timed takeoff push. |
| Wrate Issue | Warns from launch, then applies a forward torque pulse at +0.65 s for 0.20 s, at 24% of the manual torque scale; countdown and LEFT/A recovery prompt. No detachable components. |

Optional objectives do not block medals or level unlocks. Results show **SUCCESS / NOT MET** and the measured outcome. A success earns one persistent achievement for that character and objective; repeats cannot duplicate it. The reusable evaluator supports these eight configured objectives:

| Objective ID       | Exact completion rule                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `distance-35`      | Finished launched attempt with at least 35.0 scored metres.                                                     |
| `front-flip`       | At least one recognized, scored Front Flip.                                                                     |
| `two-tricks`       | At least two different recognized tricks.                                                                       |
| `attached-landing` | Take off, land, and finish with the rider attached; a crash may count.                                          |
| `perfect-brace`    | Completed jump with exactly Perfect Brace.                                                                      |
| `landing-zone`     | First ground contact in the visibly marked 30–45 m zone; measured before display rounding.                      |
| `style-factor`     | A scored trick and final character × landing factor strictly above ×1.50. Per-trick combo factors are separate. |
| `no-miss`          | Completed jump with at least one Good/Perfect rhythm push and zero Missed rhythm pushes.                        |

All objectives require a finished, numerically valid attempt. Thresholds, names, and descriptions live in `js/run-config.js`; `js/objectives.js` evaluates final measurements without changing scores or physics.

### Temporary run upgrades

The first Bronze-or-better completion of **Orientation Day**, **Wheels Down**, **Showboating 101**, **Fragile Cargo**, **Ice Cream Weather**, and **Siemens Certified** each opens a choice of three distinct seeded upgrades. Choose one, or explicitly choose **Keep factory settings — skip reward**. Skipping consumes that reward for this run and cannot be undone by replaying the lesson. Offers exclude maxed upgrades, survive refresh, and cannot be rerolled by replaying a level. If fewer than three upgrades remain available, only those are offered; if none remain, results return directly to the map. Current upgrades and stack limits are listed on the map, briefing, results, and reward screen.

| Upgrade ID              | Effect per stack                                                                                                                                    | Cap |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `reinforced-wheels`     | +12% landing stability; impact and angle still matter.                                                                                              | 2   |
| `wider-launch-window`   | Good and Perfect takeoff windows expand by 10 world pixels on each side.                                                                            | 2   |
| `improved-air-control`  | +12% manual rotation control; existing angular-speed cap remains.                                                                                   | 2   |
| `wider-brace-window`    | Perfect accepts input 40 ms earlier; Good 60 ms earlier. Late boundaries do not change.                                                             | 2   |
| `style-multiplier`      | +15% character style factor; effective factor rounded to two decimals so the displayed calculation matches exactly.                                 | 2   |
| `emergency-stabilizer`  | One 0.35 s recovery assist when descending near contact (<0.6 s estimated) with tilt >1.2 rad. Bounded torque, no angle snap or guaranteed landing. | 1   |
| `faster-perfect-pushes` | +15% Perfect rhythm push speed; starter, Good/Miss pushes, and speed cap unchanged.                                                                 | 2   |
| `impact-harness`        | ×1.50 impact-speed tolerance before detachment; does not cancel crash classification.                                                               | 1   |

Run data uses a separate version-1 `santor-vault:run` key containing character, seed, capped upgrade counts, cleared/rewarded levels, and a pending offer. Version-2 `santor-vault:achievements` stores achievements, dates, cumulative progress, cosmetic choices, and the retained per-character objective flags from version 1. The existing `santor-vault:campaign` medal schema is unchanged, and version-1 objective flags migrate without changing medals or run data. Missing or corrupt companion data starts safely without deleting medals. Party Tournament never reads a run modifier into its physics world.

### Deterministic developer mode

Append an explicit query to the normal static page, including under a project subpath:

```text
/ragdoll-olympics/?vaultdev=1&seed=42&condition=crosswind&upgrades=impact-harness:1,wider-brace-window:2&objective=landing-zone
```

Then choose Vault Run and a character. All lessons are available for testing; a visible **DETERMINISTIC TEST RUN / CAMPAIGN SAVES DISABLED** banner marks the mode. Conditions use the IDs in the condition catalog (`crosswind`, `icy-ramp`, `heavy-cart`, `boost-strip`, `wrate-issue`); `condition=none` gives standard conditions. Upgrade and objective IDs are in the tables above. Omitted condition/objective use the seeded plan; unknown values are ignored, and upgrade counts are capped. The same seed and controls reproduce the same choices and simulation within this engine/runtime.

Developer campaign saves are memory-only and cannot modify real medals, achievements, or run data. In this mode, New run reapplies the URL's forced loadout and seed for repeatable tests. Remove `vaultdev=1` to resume the normal saved run. Party Tournament remains unaffected.

## Achievement Vault

Open **Achievement Vault** from the main menu. It lists all 28 definitions by category with descriptions, locked/unlocked state, UTC unlock dates when known, cumulative progress, and optional cosmetic rewards. Twenty-two achievements are earnable with the current mechanics. Six are clearly marked **FUTURE MECHANIC** (listed below). The Hidden category retains its actual names and descriptions so those unavailable prerequisites are clear.

A compact notification appears in the attempt-results panel, or final-results panel for a tournament victory. It names up to three new unlocks and reports any additional count. It does not overlay the Canvas, capture focus, block buttons, or run a timeout. Unlocks commit from finished valid attempts; they cannot be farmed with a prelaunch restart. Biography reading uses the existing frame clock, requires 30 seconds on one visible, focused card, ignores long frame gaps, and never dismisses the biography. Its notification waits for an attempt to end.

Achievements are shared by this browser/origin. General flight/skill achievements work in both modes. Jake, Brandon, and Owen conditions check the actual attempt's character. Campaign completion and objective achievements require Vault Run; **Poetic License** requires an outright Party Tournament victory as Brandon, with style providing more than half of the winning championship score.

Specific criteria resolve existing game terminology as follows:

- **Do a Barrel Roll:** at least one completed rotation and a landing; crash landings count. Oscillations/partial spins still do not count.
- **Dead Centre:** first-contact distance is within 0.5 m of the centre of the active marked landing-zone objective (37.5 m for the current 30–45 m zone). Ordinary jumps with no target cannot unlock it.
- **Against All Coordination:** Brandon lands **Clean** with Perfect Brace and no recorded crash.
- **A Tragedy in Three Acts:** Brandon records each of three first-crash causes across attempts: overturned, head impact, torso impact. Later contacts in one crash cannot count as additional acts.
- **No Visible Reaction:** Jake passes the active optional objective after a crash that triggered the physics engine's severe-impact rule.
- **Wrate Issues:** Owen earns a campaign medal with the Wrate Issue condition after its pulse actually occurred.
- **I Can Fix That:** Owen's Wrate Issue pulse finishes before contact, followed by a Clean/Scrappy landing without a crash.
- **Siemens Certified:** Owen reaches the configured rhythm-push cap (currently 15.5 Matter speed units) before the takeoff zone. Both explicit pushes and follow-through are observed; motion is unchanged.
- **Vault Graduate / Three Different Liabilities / John’s Favourite:** respectively all ten main levels with one character, all three characters, and Gold on every main level with one character. Permanent medal records supply these facts.
- **Cone of Composure / Shift Supervisor:** earn Gold in Ice Cream Weather as Jake / Siemens Certified as Owen. These optional achievements do not restrict level access.
- **Factory Settings:** all ten main levels cleared in one temporary run, with zero selected upgrades. Decline all six reward offers. Old medals alone do not prove this achievement.

The following definitions are present, validated, and ready for future telemetry, but **cannot unlock in normal play yet**. No existing score or physics mechanic was invented to make these fire:

| Achievement                    | Missing mechanic                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| The Full Package               | Objective points; optional objectives currently award badges without a fifth score component.        |
| Cart of Theseus                | Loss of two cosmetic/nonessential cart components. Rider detachment is not cart-component loss.      |
| Physics Has Denied Your Appeal | Combined Gauntlet one-point near-miss telemetry is not connected; single-jump medals use skill goals.                               |
| Karma Chameleon                | Conditions changing during a level. Current conditions intentionally stay fixed within each attempt. |
| The Wheel Was Never Essential  | Detachable wheels.                                                                                   |
| Softness Sold Separately       | A collidable Concrete+ target. The existing banner is background scenery.                            |

### Cosmetic rewards and reset separation

Unlocked rewards can be equipped or returned to defaults in the Vault. Slots are cart trim color, character-card border, optional results commentary line, title badge, and arena-light accent. Rewards do not change forces, timers, input windows, scores, level access, or required mechanics. The normal appearance stays unchanged until a player equips one.

| Action                              | Clears                                                            | Preserves                                                              |
| ----------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| New run / confirm another character | Temporary upgrades and run plan                                   | Medals, unlocks, all achievements, objective badges, cosmetics         |
| Reset campaign progress             | Campaign medals/unlocks and temporary run                         | All achievements, objective badges, cosmetics, Party Tournament, sound |
| Reset achievements                  | Achievement progress/dates, objective badges, cosmetic selections | Campaign medals/unlocks, current run/upgrades, Party Tournament, sound |

Both reset screens require confirmation and initially focus Cancel. Achievement reset does not re-import already retained medals on the next reload; later real play may satisfy their criteria again.

### Achievement data and migration

`js/achievement-config.js` defines each achievement's event, field predicates, aggregation (`once`, `count`, `max`, or `unique`), target, category, optional capability requirement, and cosmetic reward. New rules using these operations need a configuration entry rather than another screen-specific conditional.

`AchievementManager` in `js/achievements.js` has no DOM or physics dependency. It receives normalized events (`attempt-ended`, `campaign-progress`, `tournament-won`, `biography-read`, `objective-completed`), caps progress, keeps unique values, and stamps first unlocks. A persisted monotonically increasing event ID rejects duplicate/older events, including after refresh. Producers must send the stream in order; each new attempt has a new event ID. The game adapter in `js/achievement-events.js` supplies actual facts after score/objective evaluation.

The version-2 save keeps existing `characters[characterId][objectiveId]` flags, adds objective dates when new completions occur, and adds achievement records, equipped cosmetics, and the event sequence. The migration does not write to `santor-vault:campaign` or `santor-vault:run`. Old medals can prove Welcome to the Vault, Vault Graduate, Three Different Liabilities, and John’s Favourite; these are imported without made-up timestamps. Historical braces, wins, upgrades, and crashes cannot be reconstructed and are not fabricated. Missing/malformed data loads safely. A future schema version is preserved without writes; an explicit achievement reset is required to discard it. Failed storage writes leave in-memory play working and show a notice.

### Development-only achievement hooks

Load `/ragdoll-olympics/?achievementdev=1` (or append `&achievementdev=1` to an existing `vaultdev=1` URL). This creates memory-only campaign **and achievement** data, with a visible development notice in the Vault. Real medals, objective flags, upgrades, and achievement records are untouched. Remove the flag and reload to restore normal saves. No testing panel or hook global exists during normal play.

Open Achievement Vault, then use the developer console:

```js
const achievements = window.__vaultAchievements;
achievements.definitions(); // IDs, rules, targets, rewards, and capability requirements
achievements.snapshot(); // detached copy; editing it does not modify progress

// Three distinct Jake attempts: Cold-Blooded unlocks exactly once.
for (let i = 0; i < 3; i++) {
  achievements.emit("attempt-ended", {
    characterId: "jake",
    valid: true,
    brace: "Perfect Brace",
  });
}

// Explicit event IDs can test replay rejection.
const event = {
  id: achievements.snapshot().sequence + 1,
  type: "attempt-ended",
  characterId: "owen",
  valid: true,
  launched: true,
};
achievements.receive(event);
achievements.receive(event); // ignored
achievements.equip("blue-cart");
achievements.reset(); // only this development page's achievement data
```

Other examples: emit `tournament-won` with `{characterId: "brandon", soleWinner: true, styleMajority: true}`; emit three Brandon `attempt-ended` events with `valid: true` and `crashClass` values `overturned`, `head-impact`, and `torso-impact`. Future-mechanic capability gates remain disabled even in these hooks. The Node tests exercise future definitions using an explicitly injected capability map, without changing normal gameplay.

Run `node tests/achievements.mjs` for deterministic migration, duplicate, attribution, boundary, reading-clock, reset, reward, and real-physics checks. The keyboard/pointer campaign integration suite also covers the Vault, cosmetic persistence, explicit reset, development-save isolation, and a real Factory Settings run. Details and actual results are in `QA.md`.

## Party Tournament

Jake “Hardened Vet” Eckler, Brandon “Wordsmith” Hale, and Owen “Sparky” Wrate each get one qualifying jump, in that order. The lowest total is eliminated. Qualifying ties use distance, then the displayed roster order. The qualifying runner-up jumps first in the championship; the best qualifier jumps last.

Before every Party Tournament attempt, the full character introduction stays visible until the player clicks/taps **Continue to Ready** or presses Enter. Its static prompt reads **PRESS ENTER WHEN READY.** There is no introduction timer or automatic transition. Continuing reveals Ready; a separate confirmation still starts the attempt. Enter must be released before it can confirm again, so holding it cannot also begin the jump. The three highlighted joke statistics appear on the introduction, with the remaining statistics on Ready. Prelaunch retries replay the introduction.

Both finalists receive one new jump. Only championship points determine the winner. Equal championship totals are a shared victory. Restart returns to the title with all scores cleared, without refreshing.

## Characters and passives

All biographies, joke statistics, portraits, crash quotes, and character-specific captions live in `js/characters.js`.

- **Jake — Cold-Blooded:** slower air control (×0.90), gentle level assistance when rotation is released within about 41° of upright, and weaker counter-steering past about 66°. His Syria reference is explicitly imaginary textual comedy lore.
- **Brandon — Poetic License:** the largest style multiplier (×1.35). A brief, mild wobble starts 0.35 seconds after takeoff and repeats only on a sufficiently long flight. It is deterministic and smaller than normal control input. Crashed results include a literary description and his quote.
- **Owen — Wrate Issues:** retains the fastest acceleration and lower landing stability. Cart rotational inertia is 6% lower. An occasional **Wrate Issue Detected** message and John caption are cosmetic; they do not detach components. The Temu keepsake is only a black rectangular CENSORED icon labeled `Temu D***o.`.

Passive status appears below the active competitor's HUD name. John has general and character-specific lines, becomes more frantic at elimination and in the championship, and avoids consecutive duplicate captions. Ordinary gameplay captions are spaced 1.6 simulation seconds apart; crashes can interrupt. Caption queues clear between attempts.

## Adding the real portraits later

The reserved paths are `assets/portraits/jake.png`, `assets/portraits/brandon.png`, and `assets/portraits/owen.png`. They are deliberately absent. Each character currently has `portraitAvailable: false`, so the game renders labeled initials and makes **no request** for the missing PNG.

To enable a real portrait, add its PNG at the exact path and then set that character's `portraitAvailable` to `true` in `js/characters.js`. Do not enable it before the file exists: requesting a missing file can produce a browser network 404 even when an image-error handler displays a fallback. The older SVG placeholder files are retained but no longer requested by the game.

## Scoring

| Component | Rule                                                                                                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distance  | Cart-centre distance from the ramp edge at the first post-launch ground collision of cart or rider. 40 world pixels = 1 metre. Truncate metres to one decimal, then award 10 points per metre. Rolling after contact adds nothing.                                     |
| Landing   | Clean: 150; scrappy: 75; rough or crash: 0. Clean requires impact tilt ≤ `0.42 × stability` radians and vertical speed < `12 × stability × braceTolerance` Matter units. Scrappy requires tilt ≤ `0.9 × stability` radians. Any recorded crash removes landing points. |
| Style     | Recognized trick occurrences, discounted for repeats and multiplied by the unique-trick combo at each occurrence; the subtotal then receives the character style multiplier and landing multiplier. Rounded and capped at 5000. See the trick rules below.             |
| Attached  | 100 if the rider remains attached at the end of a launched attempt with a recorded landing, including an attached crash. Otherwise 0.                                                                                                                                  |

The result screen preserves all four components and their sum. A compact additional row records takeoff grade/boost, brace grade/tolerance, and Perfect/Good/Miss push counts. Skill bonuses affect the existing distance/landing outcomes rather than adding another points category. A crash retains distance points and 45% of its banked trick style after character scaling. An idle attempt scores zero. The active-attempt limit is 20 simulation seconds; no takeoff within 12 seconds ends the run-up. If an airborne attempt reaches the overall limit or exits the course, distance is its last valid measured horizontal range, with no landing or attachment points.

## Files

- `index.html`, `styles.css`, `flash.css`: game cabinet, menu containers, original arcade skin, responsive layout, and reduced-motion rules.
- `CAMPAIGN.md`: complete campaign content and medal guide.
- `js/campaign-chapter.js`: levels 4–10, ordinary cargo/repair arena data, fixed conditions, Gauntlet schedules, Overtime, and character captions.
- `tests/first-campaign.mjs`, `tests/chapter-helpers.mjs`: discrete-input real-physics balance matrix, cargo/loss/reset checks, Gauntlet ledger/progression, save extension and optional achievements.
- `campaign.css`, `js/campaign-ui.js`: mode selection support, full profile confirmation, simple level map, coaching, medals, and reset confirmation.
- `js/campaign-levels.js`: immutable level definitions and threshold evaluation.
- `js/campaign-save.js`: versioned, validated local campaign storage and safe in-memory fallback.
- `js/campaign.js`: independent campaign state machine and medal progression.
- `js/run-config.js`: condition, objective, and capped-upgrade catalogs and tuning.
- `js/run-random.js`, `js/run-save.js`: seeded selections, temporary run persistence, reward choices/skips, and delegation to the central achievement manager.
- `js/run-effects.js`: attempt-local condition forces and upgrade tuning copies, instantiated only in Vault Run.
- `js/objectives.js`: reusable finished-attempt objective evaluation.
- `js/run-ui.js`, `js/run-renderer.js`: announcements, inventory, choices, results, live status, and painted runway/landing zones.
- `js/run-dev.js`: explicit deterministic URL settings with campaign-save isolation.
- `js/achievement-config.js`, `js/achievements.js`: declarative achievements, cosmetic catalog, version-2 migration, normalized events, and persistent records.
- `js/achievement-events.js`: gameplay-to-achievement facts and biography reading clock.
- `js/achievement-ui.js`, `achievements.css`: Achievement Vault, independent reset, cosmetic selection, and non-blocking results notices.
- `js/achievement-dev.js`: explicit memory-only console hooks.
- `js/ui-content.js`: shared portrait fallbacks and unchanged score breakdown markup.
- `js/characters.js`: separate personality, statistics, portrait availability, commentary, and tuning data.
- `js/passives.js`: small character-specific forces and cosmetic status.
- `js/introductions.js`: manual introduction visibility; no clock, deadline, or timer.
- `js/skill-config.js`: documented skill tuning and shared grading functions.
- `js/skills.js`: attempt-local pushes, launch timing, bracing, and feedback.
- `js/skill-ui.js`, `skills.css`: timing meter and skill-result row, using the existing palette.
- `js/trick-config.js`: all trick thresholds, points, combo/landing factors, and character hooks.
- `js/tricks.js`: continuous rotation, occurrence recognition, immutable final records, and bounded style calculation.
- `js/trick-ui.js`, `tricks.css`: passive popups and the transparent trick results table.
- `js/tutorial.js`: the three optional interactive drills within Instructions.
- `js/commentary.js`: caption pools, selection, escalation, and a bounded attempt-local queue.
- `js/physics.js`: world lifecycle, terrain, two wheels/axles, jointed rider, breakable attachments, collision and settlement detection.
- `js/renderer.js`: Canvas drawing and camera; resizing changes view transforms only.
- `js/stadium.js`: procedural scenery and original fictional sponsors.
- `js/effects.js`: bounded particles and short Canvas-only shake.
- `js/audio.js`: lazy synthesized audio, mute persistence, and node cleanup.
- `js/presentation.js`: read-only observer connecting game events to visual/audio cues.
- `js/scoring.js`: score calculation and tie rules.
- `js/tournament.js`: centralized, guarded state transitions and tournament scores.
- `js/input.js`: one persistent keyboard/focus/visibility listener set.
- `js/touch.js`: independent push/brace edges and rotation holds merged with keyboard input; no synthetic keyboard events.
- `js/ui.js`: hand-offs, instructions, score breakdowns, standings, captions, and portrait fallbacks.
- `js/game.js`: game coordination and one fixed-step animation loop.
- `assets/portraits/`: reserved PNG locations and retained legacy SVG placeholders. Current initials are rendered directly in the UI.
- `vendor/matter-0.20.0.min.js`, `vendor/MATTER-LICENSE.txt`: pinned upstream browser build and MIT license.
- `tests/`: physics, tournament, static HTTP, and optional DOM integration checks.
- `QA.md`: what was tested and what still needs live-browser verification.

## Engineering and tests

Matter advances at 120 fixed steps per simulation second, independently of drawing. At most 12 steps run per frame. Gaps above 250 ms are discarded; release and press again afterward. Key repeats and duplicate keydowns never enqueue pushes. Physical key state survives menu clears so a held key cannot leak into a new screen. Queued keyboard/touch actions are consumed exactly once by the next fixed step and reset between attempts. Focus and visibility both have to permit play before a paused attempt resumes. Attempts and introductions own no timers. Introductions remain open until explicit confirmation, without advancing physics or auto-starting an attempt. Replacing an attempt unregisters its physics collision callback, empties its composite, and clears its engine and collision pairs. A single page-level input owner and animation loop survive tournament restarts.

Non-finite physics data ends the attempt with a safety-stop result using the last valid measurements. Score components are bounded and checked before being recorded. A failed portrait uses its initials for the rest of the page session instead of retrying on every menu.

Run the dependency-free physics, state-machine, stabilization, personalization, presentation/audio-lifecycle, skill-loop, trick-recognition, campaign progression/storage, and HTTP tests with Node.js 22+:

```sh
npm test
```

The optional DOM integration test uses JSDOM and native Canvas. Install those only for tests:

```sh
npm install --prefix .qa --no-save jsdom@26.1.0 @napi-rs/canvas@0.1.100
npm run test:dom
npm run test:campaign:dom
```

It runs the real source modules through three tournaments, restarting between them, using keyboard and button events. It completes all three optional drills, uses deliberately timed pushes and braces, and checks held/repeated input, plus all three introductions remaining open beyond 15 seconds, manual continuation, Enter-release gating, passive HUD messages, censored markup, missing-portrait request prevention, literary crash results, and a numeric-fault attempt followed by a healthy attempt. Layout, focus/visibility events, and frame timing are simulated; this is not a live-browser test. See `QA.md` for exact results and the outstanding live-preview limitation.

Additional optional checks (POSIX shell):

```sh
MOBILE=1 npm run test:dom
MOBILE=1 npm run test:campaign:dom
MOBILE=1 AUDIO_UNAVAILABLE=1 npm run test:dom
node tests/render-budget.mjs
```

The campaign integration test completes all ten main levels with each character, chooses temporary upgrades and replays levels, resumes a pending offer from persisted storage, checks New run and reset isolation, handles corrupt/blocked storage, and switches back to Party Tournament. It also runs Gauntlet heat hand-offs, exact combined ledgers, eight developer cases and checks that real saves stay unchanged. It uses the actual DOM handlers and Matter simulation; browser layout and RAF are simulated. `tests/run-mechanics.mjs` isolates all five conditions, eight upgrades, and eight objective types before `tests/run-progression.mjs` exercises seeded persistence and combined loadouts.

Mobile mode uses a simulated 360px viewport and pointer events for the five tournament jumps. The audio double checks scheduling and cleanup, not audible quality or browser autoplay policy. The render benchmark uses native Canvas and saves launch/impact renders in `.qa/polish/renders/`; it does not measure browser frame rate or HTML/CSS layout.

## Current scope

One local event, a ten-level saved solo campaign plus optional three-heat Overtime, the full pass-and-play tournament, desktop keyboard and basic touch controls, placeholder portraits, synthesized sound, and restrained effects. Party scores remain in memory. No slow motion, collectible cards, online features, cloud saves, or cross-device synchronization. Push timing, takeoff choice, rotation, trick combinations, and bracing determine each attempt. Outcomes can differ slightly across browsers; the landing meter is an estimate and actual contact determines the brace grade. Live-browser verification remains outstanding as described in `QA.md`.

Matter.js upstream: [0.20.0 source](https://github.com/liabru/matter-js/tree/0.20.0), [official API documentation](https://brm.io/matter-js/docs/). The vendored build was retrieved from the pinned `matter-js@0.20.0/build/matter.min.js` npm CDN artifact.
