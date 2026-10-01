# Ragdoll Olympics: The Santor Vault

A browser game about shopping-cart long jumps with ragdoll physics. Play the saved **Vault Run** solo campaign or a 2–6 player local **Party Tournament**, with everyone playing as Jake, Brandon or Owen. Built with vanilla HTML/CSS/JavaScript and vendored Matter.js; no build step or backend.

## Play locally

With Node.js 22 or newer installed, run:

```sh
npm run dev
```

Open http://127.0.0.1:8000/ and choose **Enter the Vault**. No dependency installation is needed. Serve the game over HTTP rather than opening `index.html` directly. Solo progress and preferences are saved in your browser.

## Controls

| Key | Action |
| --- | --- |
| Space / Up | Tap to push in rhythm; time one push in the takeoff zone |
| Left / A, Right / D | Rotate in the air |
| Down / S | Brace once, just before landing |
| Enter | Continue an introduction or confirm a menu |
| R | Restart before takeoff; instantly retry from Vault Run results |

On touch screens, use the on-screen controls. During Santor Sync, match the displayed arrow notes. Losing focus pauses play; release and press the controls again when returning. The Instructions screen includes optional practice drills.

Vault Run menus are kept short: the map is a grid of level tiles (bonus levels in their own row), each briefing shows the condition, medal goals and John's line, and extra detail sits behind **Details** or **Full score breakdown**.

On Vault Run results, **RETRY** or **R** starts the same level without the map or briefing. Three-heat levels restart at heat 1. A pending upgrade choice comes first; choosing or skipping it then starts your retry.

Results in both modes offer **WATCH REPLAY**. Crashes and landings over 55 m replay automatically with slow motion around impact; any key or tap skips to results. Recordings stay in memory for the current attempt (up to 20 seconds). Reduced motion disables automatic playback and slow motion; manual replay remains available.

The run-up is long: a good one takes about six on-beat pushes (roughly 4 seconds). Only Perfect pushes reach top speed, and taps faster than the beat count as Miss. Typical distances: sloppy 20–30 m, solid 40–50 m, excellent 60–70 m. Tuning lives in `SKILL_CONFIG` (`js/skill-config.js`).

**Party Tournament** is a pass-and-play game night for 2–6 players. Each player types a name and picks any character (duplicates allowed), then chooses **Quick** (one jump each), **Best of 3** (three rounds, total points) or **Elimination** (lowest running total drops out each round). **Chaos** rolls a random condition each round, from the five Vault Run conditions plus Low-G, Tailwind and Chameleon Wind. A scoreboard shows running totals and best jumps between rounds, and the end screen gives Longest Jump, Best Style, Crash of the Night and Most Consistent awards. Names and settings are remembered in this browser. Ties go to the better single jump.

**Cart High Jump** is a second event, picked on the title screen (Party only; Vault Run stays long jump). A short run-up leads to a steep kicker, a real bar on pegs and the Squishco landing pit. The bar rises each round and each player gets three tries per height; knocking the bar off or passing under it is a miss. The best cleared height wins, with ties decided by fewer misses, then Fosburys (clearing the bar upside down, which earns John's approval and a style bonus).

**Cart Bowling** is a third Party event. The run-up and a low ramp launch the cart down a long lane into ten Crunchos cereal-box pins, set in the classic 1-2-3-4 triangle (seen from the side, so the rows run down the lane). More speed knocks more pins; air rotation and a small lane nudge (← / → once you land) change how you hit. Each player gets three throws: 10 points a pin, +50 for a strike, +25 if the rider flies into the pins.

Hard crashes can shed wheels, the grille and child seat; severe crashes eject the rider. Crash results show a separate **CARNAGE** score: 150 per lost part, 100 per airborne second after ejection, 75 per bounce, and 10 per metre of rider travel from the ejection point. It never adds to normal points or medals. Party awards **Crash of the Night** across all rounds (first crash wins a tie). Losing two parts and touching down after wheel loss can unlock the existing Theseus and Wheel achievements.

**Courses** are data in `js/course.js` (ground height, ramp, run-up start, takeoff zone, distance origin, world end and optional extra static pieces). A level or event picks one with `arena.course`; everything else uses the default `long-jump` course.

**Themes:** add a `defineTheme({ id, backdrop, ground, ramp, sponsors, accent, backgroundImage, ambient })` entry to `THEMES` in `js/themes.js`, overriding only what you need; image paths such as `assets/backdrops/yard.webp` are project-relative, replace the procedural backdrop once loaded after the first gesture, and fall back to the Vault backdrop on failure. Set `theme: "your-id"` on a course or `arena.theme: "your-id"` on a level (which overrides the course); `ambient` accepts `kind: "fog"`, `"snow"` or `"sparks"` plus count, color, size, speed and drift, and reduced motion disables ambient particles and image parallax.

**Course pieces** go in a course's `pieces` array; all coordinates are world pixels (40 px = 1 m, y points down). Existing `rect`/`polygon` pieces still work; these new types are available for future levels, with small examples in `tests/course-pieces.mjs`:

| Type | Data and behaviour |
| --- | --- |
| `pit` | `x`, `width`, optional `depth` (default 180). Cuts ground after the ramp; falling below its depth ends the attempt with a pit crash and zero landing points. |
| `platform` | `x`, `y`, `width`, `height`, optional `angle`. Raised landing rectangle; place pits between or underneath platforms for real gaps. |
| `conveyor` | `x`, `y`, `width`, `height`, `speed`. Horizontal landing rectangle; signed speed is pixels/second, positive forward. Only bodies touching its top are transported. |
| `props` | `x`, `y`, box `width`/`height`, optional `columns`, `rows`, `mass` (0.3), `gap` (0), `lineX`, `lineDirection` (1 or -1). x/y is the first bottom-row box centre; rows stack upwards, capped at 48 boxes per course. |
| `obstacle` | `x`, `y`, `width`, `height`, optional `angle`. Hanging solid; head/torso contact causes an obstacle crash, without counting as a landing. |

New pieces inherit `theme.pieces[type].fill/stroke`; per-piece `fill`, `stroke`, and `sign` override the simple default art. Prop telemetry (`propsFallen`, `propsPastLine`, `propsMoved`) appears in `world.metrics()`, campaign medal facts and crash carnage: a tipped/dropped box or a box crossing its line counts once in `propsMoved`, even if it later returns. These counts do not add ordinary or carnage points. `impactLoudness` is the cart's approach speed normal to its first landing surface in pixels/second (null without a landing); a quiet medal can use `{ all: { completedJump: true }, max: { impactLoudness: 200 } }`, and a prop medal can use `{ all: { propsMoved: 5 } }`. Multi-heat facts sum prop counts and use the loudest landing, requiring a measurement in every heat.

## Engineering and tests

Run the dependency-free test suite with Node.js 22 or newer:

```sh
npm test
```

Optional DOM integration checks require test-only dependencies:

```sh
npm install --prefix .qa --no-save jsdom@26.1.0 @napi-rs/canvas@0.1.100
npm run test:dom
npm run test:campaign:dom
npm run test:accessibility:dom
```

These simulate the DOM and physics; visual layout and audible playback still need a real browser check.
