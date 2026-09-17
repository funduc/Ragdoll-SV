# Manual character introductions — verification

Updated 2026-09-17. Character introductions now have no deadline or automatic transition. They remain visible until the player activates **Continue to Ready** or presses Enter. The static prompt is **PRESS ENTER WHEN READY.** Ready still requires a separate confirmation to begin the jump.

The former deadline, remaining-time/expiry methods, animation-loop countdown/auto-dismiss branches, countdown DOM updater, presentation countdown bookkeeping, and introduction countdown sound were removed. The existing CSS class is retained solely to preserve the prompt's styling. No stylesheet was changed.

Enter now has a release latch separate from movement keys. Clearing controls during the introduction-to-Ready transition cannot re-arm it. Repeated keydowns, including duplicate events without a repeat flag, cannot also activate Begin jump. Keyup releases the latch and prevents native follow-on activation; blur/focus/visibility handling prevents a stuck latch after losing focus. No timer-based input debounce or new listener was added.

## Verification performed

The managed preview still reported an unavailable `sites-previewd` mailbox. These are automated DOM/Canvas checks using the real game modules, not a live-browser playthrough or real-device tap test.

| Requested check                              | Result actually observed                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jake remains visible for at least 15 seconds | The same biography card remained visible during **15.02 seconds of real elapsed time** in the DOM harness, with frames running throughout.                 |
| Brandon remains until manually continued     | Passed all tested qualifying and championship appearances after 15 seconds of regular simulated frames plus an 8-second stalled frame.                     |
| Owen remains until manually continued        | Passed the same 23-second check in qualifying and championship.                                                                                            |
| Click advances exactly one screen            | Continue to Ready removed the card, displayed Begin jump, and left physics stopped. An additional second of frames did not start the attempt.              |
| Enter advances exactly one screen            | Enter on the focused introduction button displayed Ready only.                                                                                             |
| Holding Enter cannot begin the jump          | Three seconds of repeated keydowns and an extra non-repeat keydown without release left Ready intact. Keyup followed by a fresh confirmation allowed play. |
| Restart does not restore the timer           | Three complete desktop tournaments with restart between them passed. Every introduction after restart received the same 23-second persistence check.       |
| No timer-related console errors              | Zero captured game console errors, warnings, window errors, or game timeout/interval calls.                                                                |

The desktop run inspected **21 introductions**, covering Jake, Brandon, and Owen in **both rounds**, plus prelaunch retries and fault recovery. It completed three tournaments / 15 tournament attempts and two extra fault/recovery attempts. The narrow/touch-mode harness completed another tournament, restart, and recovery checks, inspecting 11 introductions. It activated the native Continue button via simulated clicks; the pointer control implementation and button focus behavior are unchanged.

All biography, statistic, strength, weakness, passive, and commentary markup was checked to remain unchanged while each card waited. All three named PNG portrait requests remain disabled. No additional timer, interval, or listener survives the change.

`npm test` passed **33 groups**, plus 48 successful root/project-prefix HTTP requests and the expected deliberate 404 check. The unchanged physics/scoring regression checks passed. Desktop tournament outcomes were Brandon, Brandon, and a shared victory; tournament order and round accounting passed. Input event timings differ from the earlier presentation test because these tests now wait on every introduction.

Commands performed:

```sh
npm test
node --experimental-vm-modules tests/dom-flow.mjs
MOBILE=1 node --experimental-vm-modules tests/dom-flow.mjs
```

The host's npm configuration warning and Node experimental-VM warning are separate from the game's captured console, which was clean.

## Exact source changes

| File                  | Functions changed                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/introductions.js` | `Introduction.constructor`, `start`, `clear`: manual active flag. Removed `INTRO_DURATION_MS`, the `active` getter, `remaining`, and `expired`.                                                                   |
| `js/game.js`          | `Game.renderState`: starts an introduction without a timestamp. `Game.frame`: removes all introduction countdown and automatic dismissal logic.                                                                   |
| `js/ui.js`            | `UI.showIntroduction`: static prompt and Continue to Ready label. Removed `UI.updateIntroduction`.                                                                                                                |
| `js/input.js`         | `Input.constructor` and its `keydown`, `keyup`, `blur`, `focus`, `visibility` handlers: Enter release latch and focus recovery. `clear` received an explanatory comment; it still only clears movement/key state. |
| `js/presentation.js`  | `Presentation.constructor` and `replaceWorld`: removed `lastCountdown`. Removed `Presentation.countdown`.                                                                                                         |
| `js/audio.js`         | `SynthAudio.play`: removed the obsolete introduction countdown cue and its unused value parameter. Other cues are unchanged.                                                                                      |

Verification/documentation files changed:

- `tests/personalization.mjs`: replaced the expiry test with the manual visibility lifecycle test.
- `tests/stability.mjs`: extended the input test with release gating across `clear()`.
- `tests/dom-flow.mjs`: updated `key` to accept a target; added `waitOnJake`; replaced expiry checks in `finishIntroduction` with persistence and one-screen continuation checks; updated the tournament loop and report.
- `tests/presentation.mjs`: removed the obsolete countdown cue from the audio test list.
- `README.md`, `QA.md`: current behavior and verification record.
- `deliverables/ragdoll-olympics-vertical-slice.zip`: refreshed project archive.

Compared against the pre-change snapshot: physics, scoring, tournament, character data, passives, commentary, renderer, touch controls, both stylesheets, and index markup are unchanged. No other screen timing was modified.

## Remaining limitation

Live-browser rendering, native keyboard default behavior, and real-device tapping could not be checked because preview access is unavailable. The automated checks above passed; they must not be described as a browser playthrough.

---

The following is the historical report from the preceding presentation pass. Its timed-introduction/countdown references describe that earlier version and are superseded by the manual behavior above.

# Previous Flash presentation verification (historical)

Updated 2026-09-17. The tournament, scoring, keyboard input, physics, character data, passives, introductions, and commentary-selection modules are byte-for-byte unchanged from the pre-polish snapshot. Presentation is isolated in new modules and `flash.css`; the existing game loop forwards events and merges independent touch holds. No framework, build step, external artwork, or music was added.

**Live-browser verification remains blocked.** The preview command reported `sites-previewd mailbox is unavailable at /tmp/sites-previewd/requests`. The tests below use the real source, Matter.js, JSDOM, and native Canvas. They simulate layout and events. They are not manual browser playthroughs, real-device tests, browser DevTools checks, or an audition of the synthesized audio.

## Implemented presentation

- Original metallic gradients, thick outlines, beveled controls, safe compressed-looking font fallbacks, flame/lightning motifs, score starbursts, short wipes, concrete/neon scenery, and fictional sponsors.
- A broadcast lower-third for John; championship ribbons and decorative signal instability escalate without moving the caption text. Transitions never delay state changes or control availability.
- Launch/landing dust, hard-cart-impact sparks, a small winner burst, score pop/settle, and brief Canvas-only crash shake. Maximum 96 particles, 48 confetti pieces per victory, 4px horizontal shake for 0.22 seconds. Effects use their own random generator and cannot change physics.
- One lazy Web Audio context, eight original synthesized cues, 24-voice cap, persistent mute, graceful unavailable-audio behavior, and cleanup on mute/pause/reset/unload. Audio schedules on the audio clock, without JavaScript timers.
- Three 66px-minimum hold buttons below the Canvas for coarse/non-hover pointers. Keyboard input remains available. A closer narrow-screen camera changes only view transforms. Menus remain scrollable in the shorter mobile stage.
- Reduced-motion CSS disables visual transitions; the effects module suppresses confetti and shake and limits other bursts to four particles each.

## Exact desktop flow tested

The desktop gate passed three tournaments before touch was introduced. After adding touch, the same three-tournament regression passed again. The final desktop run followed:

Title → Instructions → Qualifying introduction → character card → Ready/confirmation → Jake attempt/results → Brandon card/Ready/attempt/results → Owen card/Ready/attempt/results → Elimination → Championship introduction → both finalists' card/Ready/attempt/results → Final results → Restart → Title. No reload occurred between tournaments.

| Run | Qualifying: Jake / Brandon / Owen | Eliminated                         | Championship order and points | Winner         |
| --- | --------------------------------- | ---------------------------------- | ----------------------------- | -------------- |
| 1   | 548 / 702 / 645                   | Jake                               | Owen 491; Brandon 704         | Brandon        |
| 2   | 0 / 704 / 645                     | Jake                               | Owen 491; Brandon 702         | Brandon        |
| 3   | 0 / 0 / 0                         | Owen, by existing roster tie-break | Brandon 0; Jake 0             | Shared victory |

All scores, result descriptions, finalists, and winners exactly matched the pre-polish integration results.

Run 1 used Space/Up, A/D and arrow rotation, and checked clean/crash results. It also exercised prelaunch retries, held Enter, skipped and expired introductions, an 8-second frame gap, blur/focus and hidden/visible combinations, and resizing at pixel ratios 1 and 2. Run 2 included an idle qualifying timeout. Run 3 deliberately left every attempt idle to verify bounded termination and shared victory.

After the third restart, the harness injected a NaN cart position during Jake's flight, verified a finite safety-stop score, then completed Brandon's next healthy attempt. These are two additional attempts, not another complete tournament.

The final desktop run covered 15 tournament attempts, two fault/recovery attempts, 21 introduction cards, and 25 engine instances including prelaunch retries. It captured **zero game console errors, console warnings, or window errors**, and **zero game timeout/interval calls**. Every replaced world had zero surviving bodies, constraints, collision listeners, pairs, or detector bodies. There was one RAF loop and one listener registration per owner; the additional captured key listener only unlocks audio and never handles gameplay. Unload removed the input, touch, UI, and audio listeners, canceled RAF, closed audio, and disconnected resize observation.

## Narrow and touch checks

`MOBILE=1 node --experimental-vm-modules tests/dom-flow.mjs` passed a complete five-jump tournament with a simulated 360 × 740 viewport and 330 × 420 Canvas. Menu confirmations used button clicks and the five jumps used pointer holds for driving/rotation. Results were 548 / 702 / 645 in qualifying and Owen 491 / Brandon 704 in the final. Restart and two extra numeric-fault/recovery attempts passed.

Checked simultaneous drive/right holds, pointer cancellation, lost capture, release outside the button, blur clearing/disabling holds, focus restoring controls, and disabling/clearing touch at results. Releasing touch while Space remained held did not release keyboard acceleration. The buttons are DOM siblings of the stage, not overlays on the action. Both CSS files parsed in the final DOM run. This verifies structure and simulated behavior, not actual CSS breakpoints, hit testing, menu overflow, or scrolling on a phone.

Native Canvas launch images at desktop and narrow sizes were rendered and visually inspected. Cart, ramp, and ground remained visible. A hard-impact image was also rendered and inspected. The maximum-particle renderer executed successfully at both sizes. These images contain Canvas content only, not the browser-rendered HTML interface.

## Audio and effects checks

- Before any gesture: zero audio contexts. After gesture, mute/unmute, attempts, and restarts: exactly one context. All eight cue categories created scheduled voices in the audio double.
- Enter on the mute button changed sound without confirming the tournament menu. Muting during gameplay did not end the attempt. Muting disconnected all active voice nodes; unmuting reused the context. Mute persisted through tournament restart and used the expected local-storage value.
- Unavailable AudioContext, denied construction, rejected resume, and restricted local storage were exercised without uncaught exceptions. A separate full touch tournament with `AUDIO_UNAVAILABLE=1` passed silently with SOUND N/A and zero contexts.
- Final desktop observation: 21 dust bursts, 6 spark bursts, 3 winner bursts (two emitters each), and 10 brief shake triggers across tournaments/recovery attempts. Peak live particles were 48; peak audio voices were 12. Independent saturation checks reached the configured 96-particle and 24-voice limits without exceeding them.
- Real launch/landing/crash simulations with presentation enabled produced exactly the same scores as equivalent simulations without it. Every observed body's position, angle, velocity, and angular velocity remained unchanged by the observer.
- Particle expiry, reset, finite positions, reduced motion, maximum shake amplitude/duration, and audio node disposal passed.
- Missing portrait PNGs remain absent and disabled in character data. Every frame/menu used labeled initials without inserting a missing PNG request. All three introductions, passive status messages, supplied crash quotes, literary Brandon results, and the black-bar-only Temu icon passed again.

### Native rendering cost

`node tests/render-budget.mjs` measured 240 frames per case after 30 warm-up frames, with particles held at their maximum count during the stress cases:

| Canvas     | Particles | Mean draw time | 95th percentile |
| ---------- | --------- | -------------- | --------------- |
| 1246 × 560 | 0         | 0.47 ms        | 0.67 ms         |
| 1246 × 560 | 96        | 0.67 ms        | 0.95 ms         |
| 330 × 420  | 0         | 0.40 ms        | 0.57 ms         |
| 330 × 420  | 96        | 0.61 ms        | 0.91 ms         |

These are native Canvas drawing costs on this host, not browser FPS, full game-loop costs, or mobile hardware performance. No instability or physics divergence was reproduced in the checks performed; no effect needed removal.

## Other checks and commands

- `npm test`: **33 groups passed** — 12 physics/tournament, 8 stabilization, 8 personalization, and 5 presentation/audio groups.
- Static server: **48 successful root/project-prefix requests** plus the deliberate missing-file 404 check. New CSS/modules and vendored Matter loaded under `/` and `/ragdoll-olympics/`; JavaScript MIME types were correct. This is a local subpath test, not a GitHub Pages deployment.
- `node --experimental-vm-modules tests/dom-flow.mjs`: three desktop tournaments and restarts.
- `MOBILE=1 node --experimental-vm-modules tests/dom-flow.mjs`: narrow pointer-driven tournament and restart.
- `MOBILE=1 AUDIO_UNAVAILABLE=1 node --experimental-vm-modules tests/dom-flow.mjs`: complete silent fallback tournament and restart.
- `node tests/render-budget.mjs`: actual impact render, narrow render, and maximum-particle measurements.

The host printed its existing npm proxy-configuration warning and Node's experimental-VM warning. Neither came from the game. No new game error was reproduced in the executed checks.

## Changed files

| Files                                                                                 | Change                                                                                                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| New `flash.css`                                                                       | Arcade skin, transitions, score treatment, broadcast/championship presentation, responsive touch layout, reduced motion |
| New `js/audio.js`, `js/effects.js`, `js/presentation.js`, `js/stadium.js`             | Isolated synthesized audio, bounded effects, event observer, and scenery                                                |
| New `js/touch.js`                                                                     | Pointer holds and keyboard merge, capture/cancel/reset cleanup                                                          |
| `index.html`                                                                          | New stylesheet, persistent mute, broadcast markup, sponsor strip, external touch bar                                    |
| `js/game.js`                                                                          | Forward state/physics events to presentation; merge/clear touch alongside existing input lifecycle                      |
| `js/renderer.js`                                                                      | Procedural stadium, effects drawing, Canvas-only shake, narrow view transform                                           |
| `js/ui.js`                                                                            | Championship decoration and touch-aware instructions/hints; menu/result logic preserved                                 |
| New `tests/fake-audio.mjs`, `tests/presentation.mjs`, `tests/render-budget.mjs`       | Dependency-free audio/effect checks and optional native render measurements                                             |
| `tests/dom-flow.mjs`, `tests/stability.mjs`, `tests/static-files.mjs`, `package.json` | Integration coverage, gradient-capable Canvas double, relative asset coverage, test command                             |
| `README.md`, `QA.md`, project ZIP                                                     | Current controls, implementation notes, and verification record                                                         |

`styles.css`, `js/tournament.js`, `js/scoring.js`, `js/input.js`, `js/physics.js`, `js/characters.js`, `js/passives.js`, `js/introductions.js`, `js/commentary.js`, Matter.js, and portrait assets remain unchanged.

## Outstanding verification

- Live desktop tournament, real browser developer console, actual mobile layout/scrolling and multi-touch hardware behavior.
- Audible cue quality, real autoplay restrictions, operating-system audio interruptions, and device performance during impacts.
- Full HTML/CSS visual inspection, including score animation and lower-third transitions. Native Canvas inspection does not cover those elements.
- GitHub Pages deployment has not been performed. Real portraits still need to be supplied and explicitly enabled.

The unavailable preview prevented these checks. The project remains runnable as a static site; the automated results above should not be described as live-browser verification.
