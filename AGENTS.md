# Ragdoll Olympics: The Santor Vault

A browser-based shopping-cart ragdoll game featuring:

- **VAULT RUN:** a saved single-player campaign with levels, conditions, upgrades, objectives, achievements, and bonus content.
- **PARTY TOURNAMENT:** a three-player local competition.

The game uses vanilla HTML, CSS, JavaScript modules, Canvas, and a vendored copy of Matter.js. It has no build step, backend, accounts, or required runtime network dependencies. It is published to GitHub Pages from the root of the `main` branch.

## Before making changes

1. Read this file and inspect the current repository.
2. Treat the current files as authoritative; do not rely on memories from an earlier chat or project version.
3. Assume Astra, Opus, or another agent may have edited the project since the previous task.
4. Preserve all working features and unrelated changes.
5. Keep the implementation focused on what the user requested.
6. Do not regenerate the project, replace large files unnecessarily, or rewrite working systems from scratch.
7. If the workspace is unavailable or files cannot be inspected, stop and clearly state that no files were changed.
8. Do not commit, push, publish, install dependencies, or modify repository settings unless explicitly requested.

## Run and test

- Start the local server with `npm run dev`.
- Open `http://127.0.0.1:8000/`.
- Run the main test suite with `npm test`.
- The main tests require Node.js 22 or newer.
- Optional browser-level tests are documented under **Engineering and tests** in `README.md`.
- No `npm install` is required to play the game.
- Run relevant targeted tests while developing, then run the complete `npm test` suite before handing off code changes.
- Never claim that tests passed unless they were actually run successfully.
- If tests cannot be run, explain why and identify what still needs manual verification.

## Important files

### Core game

- Main game coordination: `js/game.js`
- Physics world: `js/physics.js`
- Main canvas drawing: `js/renderer.js`
- Campaign run drawing: `js/run-renderer.js`
- Input handling: `js/input.js`
- Scoring: `js/scoring.js`
- Commentary and John Santor dialogue: `js/commentary.js`
- Character definitions, biographies, jokes, and portraits: `js/characters.js`

### Campaign and levels

- Campaign coordination: `js/campaign.js`
- Main campaign levels: `js/campaign-levels.js`
- Campaign chapters: `js/campaign-chapter.js`
- Campaign interface: `js/campaign-ui.js`
- Campaign saves: `js/campaign-save.js`
- Bonus After Hours chapter: `js/after-hours.js`
- Conditions, upgrades, and objectives: `js/run-config.js`
- Condition and upgrade behavior: `js/run-effects.js`
- Run saves and progression: `js/run-save.js`
- Seeded gameplay randomness: `js/run-random.js`

### Gameplay systems

- Achievements: `js/achievement-config.js`
- Achievement processing: `js/achievements.js`
- Tricks: `js/trick-config.js`, `js/tricks.js`
- Skill and timing mechanics: `js/skill-config.js`, `js/skills.js`
- Santor Sync rhythm event: `js/sync-config.js`, `js/sync.js`
- Music configuration: `js/music-config.js`
- Music playback: `js/music.js`
- Audio preferences: `js/audio-preferences.js`
- Personal records: `js/records.js`

### Styling

- General layout and interface: `styles.css`
- Early-2000s arcade presentation: `flash.css`
- Campaign interface: `campaign.css`
- Achievements: `achievements.css`
- Skills: `skills.css`
- Tricks: `tricks.css`
- Santor Sync: `sync.css`
- After Hours: `after-hours.css`
- Injected After Hours interface styles: `js/after-hours-styles.js`

Put feature-specific CSS in that feature’s existing stylesheet. Use `js/after-hours-styles.js` only for the existing injected After Hours interface. Avoid adding large style blocks directly to unrelated JavaScript files.

## Change-management rules

- Make small, focused changes.
- Do not alter unrelated formatting or reorganize files without a clear reason.
- Prefer extending existing modules over creating duplicate systems.
- Search for every use of a function, ID, CSS class, save field, or exported value before changing it.
- Preserve the public interfaces used by other modules and tests.
- Do not remove working content to make a new feature easier to implement.
- When fixing a regression, identify the cause rather than disabling the affected feature.
- If requirements are ambiguous and different interpretations would substantially change the game, ask before implementing.

## Save compatibility

Players may already have campaign, achievement, settings, music, cosmetic, record, and progression data stored in their browsers.

- Do not rename or remove existing character, level, chapter, condition, upgrade, objective, achievement, cosmetic, or reward IDs.
- Do not rename existing local-storage keys.
- New save fields must have safe defaults when loading an older save.
- Continue accepting saves that do not contain newly added properties.
- Sanitize malformed saved values without deleting unrelated valid progress.
- If a breaking save change is genuinely necessary, add an explicit migration and tests.
- Never silently wipe player progress.

## Conditions and deterministic gameplay

`CONDITION_IDS` in `js/run-config.js` controls the seeded shuffle for the original campaign lessons.

- Do not reorder, remove from, or append to `CONDITION_IDS` during ordinary feature work.
- Add authored level-specific conditions to `CONDITIONS`.
- Assign new conditions directly to the intended new levels.
- Only change the original seeded condition pool when explicitly requested and when save compatibility has been addressed.
- Use the existing seeded-randomness system for gameplay-affecting variation.
- Do not introduce uncontrolled `Math.random()` calls into deterministic campaign mechanics.
- Cosmetic effects may use separate randomness only when they cannot alter physics, scoring, progression, or replay outcomes.

## Levels and balance

Every new level must:

- Have a distinct gameplay purpose rather than only different visuals.
- Be completable at Bronze level by Jake, Brandon, and Owen.
- Respect each character’s strengths and weaknesses without making one character unusable.
- Explain unusual controls or conditions before the attempt begins.
- Avoid unavoidable failures or outcomes decided entirely by randomness.
- Include reasonable medal thresholds and objective requirements.
- Be tested with real gameplay logic, not only hard-coded score assumptions.

Do not globally change physics values to balance one level. Prefer level-specific configuration unless the underlying physics behavior is genuinely incorrect.

## Controls and skill

- Preserve keyboard and pointer/touch support.
- Preserve the existing control scheme unless the task explicitly changes it.
- Avoid mechanics that reward simply holding a button indefinitely.
- New scoring opportunities should involve readable timing, decisions, risk, or execution.
- Give players enough visual and audio feedback to understand success and failure.
- Do not let bonus events completely overpower the core jump, landing, and trick systems.
- Pausing, losing focus, restarting, and reduced-motion behavior must remain safe.

## GitHub Pages requirements

The site runs under the `/Ragdoll-SV/` project path rather than at the domain root.

- Runtime imports, images, audio, stylesheets, and other assets must use relative paths.
- Do not introduce root-relative paths such as `/assets/file.png`.
- Match filename capitalization exactly; GitHub Pages is case-sensitive.
- Do not add a build step or server-only feature.
- Do not fetch required game files from a CDN or external service.
- Matter.js must continue loading from the vendored local copy.
- The game must remain playable as a static site.

## Images and portraits

- Keep portrait references in `js/characters.js`.
- Published portraits should use optimized web-friendly versions.
- Preserve accessible names and fallback initials.
- A missing portrait must not break character selection or gameplay.
- Do not publish original high-resolution uploads when an optimized version exists.
- Do not expose private metadata or personal information that is not already intentionally part of the game.

## Music and audio

- Preserve the sound on/off preference.
- Audio must begin only after an appropriate user interaction so browser autoplay restrictions are respected.
- Missing or unsupported audio files must fail gracefully.
- Do not repeatedly create overlapping audio nodes or duplicate music instances.
- Use the existing music configuration and playback systems instead of adding independent audio players.
- Keep audio file sizes appropriate for GitHub Pages.
- Do not replace or redistribute music unless the user has permission to use it.

## Humor and personal content

Jake, Brandon, and Owen are real friends.

- Keep jokes affectionate, playful, and consistent with the established tone.
- Do not invent serious allegations, sensitive personal details, or genuinely harmful claims.
- Preserve the visibly censored presentation of the Temu joke.
- John Santor may be unhinged and dramatic, but his commentary should remain comedic rather than hateful or threatening.
- Do not add personal information beyond what the user has intentionally provided.

## Interface and accessibility

- Preserve the early-2000s Flash-game aesthetic.
- Keep important instructions readable and untimed unless the user explicitly requests a timed challenge.
- Maintain keyboard navigation, visible focus states, accessible labels, and reduced-motion behavior.
- Do not use color as the only indication of success, failure, timing, or selection.
- New overlays must work at common desktop sizes and narrow mobile widths.
- Avoid covering the play area, timing meters, controls, or results with permanent interface elements.

## Performance and cleanup

- Keep physics and rendering work appropriate for a browser game.
- Dispose of event listeners, timers, animation frames, Matter.js bodies, and audio nodes when their screen or attempt ends.
- Avoid creating duplicate listeners when restarting a run or changing modes.
- Keep particle effects and cosmetic animations capped.
- Cosmetic effects must not affect physics or scoring.
- Prefer existing assets, helpers, and rendering systems over adding heavy dependencies.

## Documentation

- Update the relevant existing document when behavior, controls, assets, or testing requirements change.
- Keep documentation concise.
- Do not add a new Markdown file when a short update to `README.md`, `QA.md`, `CAMPAIGN.md`, `MUSIC.md`, `PORTRAITS.md`, or `SANTOR_SYNC.md` is sufficient.
- Documentation must describe the implementation that actually exists.

## Completion checklist

Before finishing:

1. Review the final diff for accidental or unrelated changes.
2. Confirm imports and asset paths work under the GitHub Pages project path.
3. Run the relevant targeted tests.
4. Run `npm test`.
5. Manually identify anything that still requires live-browser testing.
6. Check that existing saves remain compatible.
7. Check keyboard and touch behavior when the change affects controls.
8. Check that the game still loads when optional portraits or audio are unavailable.

## Final response

At handoff, report:

- A plain-language summary of what changed.
- How to find and try the feature in the game.
- Every file changed.
- Tests that were run and whether they passed.
- Any testing that could not be completed.
- Remaining limitations or risks.

Do not claim completion if the implementation is partial, the workspace was unavailable, or required tests are failing.