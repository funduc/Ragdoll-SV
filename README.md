# Ragdoll Olympics: The Santor Vault

A playable local, three-player Shopping-Cart Long Jump tournament. Vanilla HTML, CSS, JavaScript modules, Canvas, and **Matter.js 0.20.0**. No game backend, accounts, build step, or runtime network dependencies.

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

## Tournament

Jake “Hardened Vet” Eckler, Brandon “Wordsmith” Hale, and Owen “Sparky” Wrate each get one qualifying jump, in that order. The lowest total is eliminated. Qualifying ties use distance, then the displayed roster order. The qualifying runner-up jumps first in the championship; the best qualifier jumps last.

Before every attempt, the full character introduction stays visible until the player clicks/taps **Continue to Ready** or presses Enter. Its static prompt reads **PRESS ENTER WHEN READY.** There is no introduction timer or automatic transition. Continuing reveals Ready; a separate confirmation still starts the attempt. Enter must be released before it can confirm again, so holding it cannot also begin the jump. The three highlighted joke statistics appear on the introduction, with the remaining statistics on Ready. Prelaunch retries replay the introduction.

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

Run the dependency-free physics, state-machine, stabilization, personalization, presentation/audio-lifecycle, skill-loop, trick-recognition, and HTTP tests with Node.js 22+:

```sh
npm test
```

The optional DOM integration test uses JSDOM and native Canvas. Install those only for tests:

```sh
npm install --prefix .qa --no-save jsdom@26.1.0 @napi-rs/canvas@0.1.100
npm run test:dom
```

It runs the real source modules through three tournaments, restarting between them, using keyboard and button events. It completes all three optional drills, uses deliberately timed pushes and braces, and checks held/repeated input, plus all three introductions remaining open beyond 15 seconds, manual continuation, Enter-release gating, passive HUD messages, censored markup, missing-portrait request prevention, literary crash results, and a numeric-fault attempt followed by a healthy attempt. Layout, focus/visibility events, and frame timing are simulated; this is not a live-browser test. See `QA.md` for exact results and the outstanding live-preview limitation.

Additional optional checks (POSIX shell):

```sh
MOBILE=1 npm run test:dom
MOBILE=1 AUDIO_UNAVAILABLE=1 npm run test:dom
node tests/render-budget.mjs
```

Mobile mode uses a simulated 360px viewport and pointer events for the five tournament jumps. The audio double checks scheduling and cleanup, not audible quality or browser autoplay policy. The render benchmark uses native Canvas and saves launch/impact renders in `.qa/polish/renders/`; it does not measure browser frame rate or HTML/CSS layout.

## Current scope

One local event, desktop keyboard and basic touch controls, placeholder portraits, synthesized sound, restrained effects, and in-memory tournament scores. No slow motion, collectible cards, online features, or saved progress. Push timing, takeoff choice, rotation, trick combinations, and bracing determine each attempt. Outcomes can differ slightly across browsers; the landing meter is an estimate and actual contact determines the brace grade. Live-browser verification remains outstanding as described in `QA.md`.

Matter.js upstream: [0.20.0 source](https://github.com/liabru/matter-js/tree/0.20.0), [official API documentation](https://brm.io/matter-js/docs/). The vendored build was retrieved from the pinned `matter-js@0.20.0/build/matter.min.js` npm CDN artifact.
