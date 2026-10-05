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

On touch screens, use the on-screen controls. Losing focus pauses play; release and press the controls again when returning. The Instructions screen includes optional practice drills.

**Stunt airtime:** the long-jump kicker trades forward speed for lift: Good run-ups have about 2.1–2.2 seconds airborne; Perfect run-ups about 2.37 seconds. One flip leaves time to recover, and two are possible with precise steering. Launch tuning is in `SKILL_CONFIG.flight`; High Jump and Bowling retain their specialized launch profiles.

**After Hours** appears in its own map row after Bronze in The Santor Gauntlet: Low-G, Concrete+ (an 80–90 m slab reached with the tailwind), Karma Chameleon and the three-heat Closing Time. Original level IDs and saved medals are retained.

**Sync Moments**: in Vault Run or Party, earn at least five Perfect pushes and a Perfect takeoff. The HUD shows “SYNC READY” when earned. Normal steering stays eligible; fast flips delay Sync until the spin slows, even after the apex. Enough remaining airtime offers 3–5 arrow notes; otherwise “SYNC MISSED: NOT ENOUGH AIR” appears briefly. A 0.5-second slowdown leads into a one-second “SANTOR SYNC!” intro, two count-in ticks, and slower arrows (about 0.6–0.7 seconds apart). Flight slows to 2% so ordinary jumps have time for the presentation. The grade holds for 0.5 seconds before speed eases back. Tap Left/Down/Up/Right (A/S/W/D or touch lanes) for up to 180 style points, a victory pose and a trail. Rotation pauses during the notes and returns with at least 0.8 seconds before estimated landing; short flights use fewer notes or skip it rather than rushing. All pacing values live in `SYNC_CONFIG` in `js/sync-config.js`. Ignoring notes costs nothing. Perfect Sync earns John’s callout; rewards never boost distance or landing. Reduced motion keeps notes still and hides the trail. Existing Sync achievements and progress survive the removal of random pre-jump events.

Vault Run menus are kept short: the map is a grid of level tiles (bonus levels in their own row), each briefing shows the condition, medal goals and John's line, and extra detail sits behind **Details** or **Full score breakdown**.

**Santor on Tour** is a bonus map row: earn Bronze in **The Santor Gauntlet** with your chosen character to open **Freezer Aisle**, then Bronze there to open **The Open Mic**. Freezer Aisle has an icy run-up, five freezer lids and real gaps; Clean on lid 5 with Perfect Brace earns Santor. At Open Mic, clear the tall microphone and land different tricks: two for Silver, three for Gold, or three with a Clean landing and no mic contact for Santor. Its applause meter rewards variety and drops on crashes, with cheers or boos at results; applause never changes normal points. Tour medals save per character without affecting main-campaign completion.

On Vault Run results, **RETRY** or **R** starts the same level without the map or briefing. Three-heat levels restart at heat 1. A pending upgrade choice comes first; choosing or skipping it then starts your retry.

Bronze at The Open Mic opens **Mapleton Road: Night Shift**: three speed bumps reveal Brandon's road poem, then three potholes interrupt the landing strip. Land between potholes with no Missed pushes for Gold; add Clean and Perfect takeoff for Santor. Bronze there opens **Quiet Please**: clear the book-stack kicker and land beyond it. Try Good takeoff for a lower arc, then level and brace: Clean with first-impact noise at or below 100% earns Gold (1,170 px/s normal impact speed). A trick and zero books knocked over add Santor. Loud impacts turn the librarian around with a shush; the noise meter and results also show this without sound.

Bronze in Quiet Please opens **Siemens Floor**: survive the Wrate Issue, land on the backward belt and stay aboard for its four-second cycle until it stops and you settle. First-contact distance stays fixed; Gold needs Clean and staying aboard, Santor adds Perfect Brace and 60 m+. Bronze there opens **Temu Warehouse**, a wall of 36 light boxes: 10 toppled for Silver, 20 plus an attached landing for Gold, 30 plus attached and Clean for Santor. The HUD counts boxes once each; crashes add 25 carnage per toppled parcel, separate from ordinary points.

Bronze in Temu Warehouse opens **Rooftop Delivery**: carry John's Fragile Cargo mug over the city gap to the far roof. Falling earns Bronze only; Clean delivery earns Gold and a recognized trick (including Clean Flight) adds Santor. Bronze opens **Grand Reopening**, a three-heat finale on Freezer Aisle, Siemens Floor and the Vault exterior. Combined targets are 1,200 for Bronze (all three jumps), 2,500 for Silver (two successful landings), 3,500 for Gold (three successful landings and a ribbon cut), and 4,300 for Santor (three Clean landings). Land through the red band in heat three to cut it. Clearing the finale shows fireworks, the crew's podium and John's closing speech, and unlocks **TOUR COMPLETE**; Enter returns to the map, and R retries from heat one.

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
| `conveyor` | `x`, `y`, `width`, `height`, `speed`. Horizontal landing rectangle; signed speed is pixels/second, positive forward. Only bodies touching its top are transported. Optional `stopAfter` ends the powered cycle that many seconds after first landing; omitted belts run continuously. |
| `props` | `x`, `y`, box `width`/`height`, optional `columns`, `rows`, `mass` (0.3), `gap` (0), `lineX`, `lineDirection` (1 or -1). x/y is the first bottom-row box centre; rows stack upwards, capped at 48 boxes per course. |
| `obstacle` | `x`, `y`, `width`, `height`, optional `angle`. Hanging solid; head/torso contact causes an obstacle crash, without counting as a landing. |

New pieces inherit `theme.pieces[type].fill/stroke`; per-piece `fill`, `stroke`, and `sign` override the simple default art. Prop telemetry (`propsFallen`, `propsPastLine`, `propsMoved`) appears in `world.metrics()`, campaign medal facts and crash carnage: a tipped/dropped box or a box crossing its line counts once in `propsMoved`, even if it later returns. These counts never add ordinary points. Props may opt into crash carnage with `carnagePoints` per fallen prop (default 0); only the warehouse parcels currently do. `impactLoudness` is the cart's approach speed normal to its first landing surface in pixels/second (null without a landing); a quiet medal can use `{ all: { completedJump: true }, max: { impactLoudness: 200 } }`, and a prop medal can use `{ all: { propsMoved: 5 } }`. Multi-heat facts sum prop counts and use the loudest landing, requiring a measurement in every heat.

## Engineering and tests

Themes may provide `drawPiece(renderer, piece, course)` or `drawProp(renderer, prop)` and return `true` to replace static or loose-piece art; collision shapes still come from the course. The Tour themes demonstrate freezer lids, a microphone and books, with fog, audience and moth motion driven by recorded attempt time and disabled by reduced motion. `firstLandingPiece`, `firstLandingOnTop`, `impactLoudness` and latched `obstacleHits` supply the Tour's medal facts without changing scoring or physics.

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

**Custom sound pack:** All event/file mappings live in `js/sfx-config.js`; swap an MP3 in `assets/audio/sfx/` or edit its `files` list. Filenames are lowercase and case-sensitive. `rarity: 15` means 1 in 15; `volume` (0–2) trims loudness; `duck: true` briefly lowers music and holds new John captions (there is no recorded John voice). Shared `channel` values interrupt earlier ladder/flip/tier variants. Missing, unsupported or still-loading clips retain synth/silence; effects volume and mute apply. Supplied clips have silence trimmed and loudness balanced; very short clips use RMS normalization. The unused `futuristic menu noise.mp3` is available for reassignment.

Sync successes advance bam1–bam5; a miss resets the ladder, and Perfect Sync earns bam6. A landed step 3–4 combo uses combo3, step 5/bam6 uses combo5; otherwise a banked multi-trick combo uses trick-combo. Flips advance flip1–flip4 and then repeat flip4. Clean + Perfect Brace replaces the ordinary Clean cue. One crash tier plays on the first crash impact, using that physics step’s breakage: 0–1 lost parts = light, 2 = medium, 3+ = heavy, all four plus ejection = max. Later damage does not replay or upgrade the tier. Heavy/max can add the 1-in-15 explosion; first-head contact and an ejected rider’s first ground hit are separate overlays. Final cues continue into automatic replay without replaying collision events. Woohoo marks an improved (not initial) saved level score or per-character Party event best: long-jump score, cleared high-jump height, or bowling points.

Menu confirmations vary playback pitch by ±5% (`pitchVariation` in the sound config). Rhythm pushes use quiet `push.mp3`: consecutive Perfects rise one semitone from base pitch, capped at six steps; Good resets to base and Miss is silent and resets the streak. The fifth total Perfect push plays bam1 once per attempt; Sync eligibility still requires Perfect takeoff. Takeoff cues are unchanged. Push volume and pitch limits are in `js/sfx-config.js`.

**Character voices:** Toggle **Voices: On / Off** beside the audio sliders (saved independently of mute; old settings default to On). `js/voice-config.js` lists each clip and its moments; files live in `assets/audio/voice/<character>/`. First eligible reaction wins the one voice slot per jump, plus one different-character heckle; Party prefers other roster characters. Rare reactions roll 1 in 15 on first landing/crash when the voice slot is free. Select and Party result lines are separate menu moments. A single speech channel queues up to two reactions so the heckle follows the player; consecutive identical clips are skipped, including moments with only one clip. Speech uses effects volume, ducks music and hides/holds John’s caption until it ends. Missing clips/moments stay silent; pause, mute, restart and turning voices off discard pending speech. Big air means 400 pixels above ground; thresholds/volume are in the voice config.

Trick callouts now draw beside the cart on the canvas, with awarded trick points, a stunt-count combo and a brief pop (static with reduced motion); final style multipliers still apply on results. The five Sync pips show the current consecutive Perfect streak and reset on Good/Miss. As before, actual Sync eligibility counts total Perfect pushes plus Perfect takeoff. The Party Instructions list all six stunt types. Brandon’s laugh is retained as an asset but has no assigned moments.
