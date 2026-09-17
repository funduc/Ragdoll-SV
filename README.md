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

| Key        | Action                                                            |
| ---------- | ----------------------------------------------------------------- |
| Space / Up | Hold to accelerate during the run-up                              |
| Left / A   | Rotate backward in the air                                        |
| Right / D  | Rotate forward in the air                                         |
| Enter      | Continue an introduction or confirm the current menu              |
| R          | Reset **before takeoff**, replaying the introduction and hand-off |

Air controls stop at the first landing. R is ignored after takeoff and on results screens. Switching tabs or losing focus pauses the simulation and clears held input. Press the controls again when returning. Menus never start an attempt automatically.

On a touch screen, hold **DRIVE**, **LEFT**, or **RIGHT** in the control bar below the Canvas. Two fingers can drive and rotate together. The buttons appear for coarse-pointer or non-hover layouts and are disabled outside an active attempt. Finger release, pointer cancellation, pause, results, and resets clear the holds. After a long frame stall, release and press a touch button again. The desktop keyboard controls remain available.

## Arcade presentation and sound

`flash.css` adds an original metallic arcade cabinet, beveled buttons, flame/lightning motifs, short menu wipes, score starbursts, and championship ribbons. The stadium uses procedural concrete, neon, and fictional sponsor boards. John's lower-third escalates during the final; its text panel stays still and readable.

Launch/landing dust, hard-impact sparks, and winner confetti share a cap of **96 particles**. Major crashes shake only the Canvas by at most **4 pixels for 0.22 seconds**. Effects use a separate random generator and never write to Matter bodies. Reduced-motion preferences disable shake, confetti, and CSS animations and reduce the remaining bursts.

Original Web Audio synthesis supplies clicks, rattle, launch, impact, crowd, elimination, and victory cues. One audio context is created after the first user gesture; cues have a 24-voice limit and no JavaScript timers. The persistent **SOUND ON / MUTED** button works throughout the tournament. Mute preference survives a page reload when local storage is available. Mute, pause, reset, and disposal stop active voices. If audio is unavailable, the game continues silently and the button reads **SOUND N/A**.

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

| Component | Rule                                                                                                                                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distance  | Cart-centre distance from the ramp edge at the first post-launch ground collision of cart or rider. 40 world pixels = 1 metre. Truncate metres to one decimal, then award 10 points per metre. Rolling after contact adds nothing.                    |
| Landing   | Clean: 150; scrappy: 75; rough or crash: 0. Clean requires impact tilt ≤ `0.42 × stability` radians and vertical speed < `12 × stability` Matter units. Scrappy requires tilt ≤ `0.9 × stability` radians. Any recorded crash removes landing points. |
| Style     | `floor(maximum absolute airborne angular excursion / 90°) × 60 × styleMultiplier`, rounded to an integer. Maximum 12 quarter turns. The reference is the cart's angle at takeoff; changing direction does not accumulate duplicate rotations.         |
| Attached  | 100 if the rider remains attached at the end of a launched attempt with a recorded landing, including an attached crash. Otherwise 0.                                                                                                                 |

The result screen shows all four components and their sum. A crash retains distance and style points. An idle attempt scores zero. The active-attempt limit is 20 simulation seconds; no takeoff within 12 seconds ends the run-up. If an airborne attempt reaches the overall limit or exits the course, distance is its last valid measured horizontal range, with no landing or attachment points.

## Files

- `index.html`, `styles.css`, `flash.css`: game cabinet, menu containers, original arcade skin, responsive layout, and reduced-motion rules.
- `js/characters.js`: separate personality, statistics, portrait availability, commentary, and tuning data.
- `js/passives.js`: small character-specific forces and cosmetic status.
- `js/introductions.js`: manual introduction visibility; no clock, deadline, or timer.
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
- `js/touch.js`: independent pointer holds merged with keyboard input; no synthetic keyboard events.
- `js/ui.js`: hand-offs, instructions, score breakdowns, standings, captions, and portrait fallbacks.
- `js/game.js`: game coordination and one fixed-step animation loop.
- `assets/portraits/`: reserved PNG locations and retained legacy SVG placeholders. Current initials are rendered directly in the UI.
- `vendor/matter-0.20.0.min.js`, `vendor/MATTER-LICENSE.txt`: pinned upstream browser build and MIT license.
- `tests/`: physics, tournament, static HTTP, and optional DOM integration checks.
- `QA.md`: what was tested and what still needs live-browser verification.

## Engineering and tests

Matter advances at 120 fixed steps per simulation second, independently of drawing. At most 12 steps run per frame. Gaps above 250 ms are discarded; movement-key repeats restore held input after the gap. Focus and visibility both have to permit play before a paused attempt resumes. Attempts and introductions own no timers. Introductions remain open until explicit confirmation, without advancing physics or auto-starting an attempt. Replacing an attempt unregisters its physics collision callback, empties its composite, and clears its engine and collision pairs. A single page-level input owner and animation loop survive tournament restarts.

Non-finite physics data ends the attempt with a safety-stop result using the last valid measurements. Score components are bounded and checked before being recorded. A failed portrait uses its initials for the rest of the page session instead of retrying on every menu.

Run the dependency-free physics, state-machine, stabilization, personalization, presentation/audio-lifecycle, and HTTP tests with Node.js 22+:

```sh
npm test
```

The optional DOM integration test uses JSDOM and native Canvas. Install those only for tests:

```sh
npm install --prefix .qa --no-save jsdom@26.1.0 @napi-rs/canvas@0.1.100
npm run test:dom
```

It runs the real source modules through three tournaments, restarting between them, using keyboard and button events. It also checks all three introductions remaining open beyond 15 seconds, manual continuation, Enter-release gating, passive HUD messages, censored markup, missing-portrait request prevention, literary crash results, and a numeric-fault attempt followed by a healthy attempt. Layout, focus/visibility events, and frame timing are simulated; this is not a live-browser test. See `QA.md` for exact results and the outstanding live-preview limitation.

Additional optional checks (POSIX shell):

```sh
MOBILE=1 npm run test:dom
MOBILE=1 AUDIO_UNAVAILABLE=1 npm run test:dom
node tests/render-budget.mjs
```

Mobile mode uses a simulated 360px viewport and pointer events for the five tournament jumps. The audio double checks scheduling and cleanup, not audible quality or browser autoplay policy. The render benchmark uses native Canvas and saves launch/impact renders in `.qa/polish/renders/`; it does not measure browser frame rate or HTML/CSS layout.

## Current scope

One local event, desktop keyboard and basic touch controls, placeholder portraits, synthesized sound, restrained effects, and in-memory tournament scores. No slow motion, collectible cards, online features, or saved progress. Physics tuning is unchanged by this presentation pass; outcomes can differ slightly across browsers and the timing of air-control inputs.

Matter.js upstream: [0.20.0 source](https://github.com/liabru/matter-js/tree/0.20.0), [official API documentation](https://brm.io/matter-js/docs/). The vendored build was retrieved from the pinned `matter-js@0.20.0/build/matter.min.js` npm CDN artifact.
