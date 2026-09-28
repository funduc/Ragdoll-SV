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

Hard crashes can shed wheels, the grille and child seat; severe crashes eject the rider. Crash results show a separate **CARNAGE** score: 150 per lost part, 100 per airborne second after ejection, 75 per bounce, and 10 per metre of rider travel from the ejection point. It never adds to normal points or medals. Party awards **Crash of the Night** across all rounds (first crash wins a tie). Losing two parts and touching down after wheel loss can unlock the existing Theseus and Wheel achievements.

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
