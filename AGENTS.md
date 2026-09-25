# Ragdoll Olympics: The Santor Vault

A browser game made with friends: shopping-cart long jump with ragdoll physics.
Vanilla HTML/CSS/JS modules + Matter.js (vendored). No build step. Published on GitHub Pages from `main`.

## Run and test
- Play locally: `npm run dev`, then open http://127.0.0.1:8000/
- Tests (Node 22+): `npm test`. Run them before every commit; all must pass.
- Optional browser-level tests: see README "Engineering and tests".

## Where things live
- Characters, bios, jokes: `js/characters.js`
- Main campaign levels: `js/campaign-levels.js`, `js/campaign-chapter.js`
- Bonus chapter levels: `js/after-hours.js`
- Level conditions (wind, ice, low-G…) and upgrades: `js/run-config.js`, `js/run-effects.js`
- Achievements: `js/achievement-config.js`
- Physics world: `js/physics.js`; drawing: `js/renderer.js`, `js/run-renderer.js`

## Rules
- Keep changes small and focused on what was asked. Don't rewrite unrelated code.
- Never break existing saves: don't rename or remove level, character, or achievement IDs.
- New levels must be beatable (Bronze) by all three characters: Jake, Brandon, Owen.
- Don't reshuffle `CONDITION_IDS` in `js/run-config.js`; new conditions go in `CONDITIONS` only.
- Don't add long docs. One short README note per feature is enough.
- New CSS goes in `js/after-hours-styles.js` or an existing stylesheet already linked in `index.html`.
- The characters are real friends; keep jokes affectionate.

## When finished
Summarize in plain language what changed and how to try it in the game, and list the files changed.
