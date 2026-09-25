# Character headshots

All three uploaded originals were accessible and inspected before editing. Mapping follows the supplied filenames exactly. Sources remain unchanged in upload/ and are excluded from the published archive.

| Character | Original file | Original pixels | Original bytes | Optimized file | Pixels | Bytes |
|---|---|---:|---:|---|---:|---:|
| Jake Eckler | jake(1).jpg | 1170×1560 | 388,826 | assets/portraits/jake.webp | 512×512 | 47,590 |
| Brandon Hale | brandon(1).png | 1287×2048 | 4,857,383 | assets/portraits/brandon.webp | 512×512 | 49,592 |
| Owen Wrate | owen(1).jpg | 597×601 | 25,299 | assets/portraits/owen.webp | 512×512 | 11,628 |

Preparation used Pillow EXIF orientation correction, square crops, Lanczos resampling, and WebP quality 88/method 6. Neither JPEG required rotation; the PNG had no orientation tag. No face generation, retouching, exposure, color, or contrast changes were applied. Crop coordinates (left, top, right, bottom): Jake (235,55,915,735); Brandon (0,430,1287,1717); Owen (10,100,510,600). Eye lines are approximately 40–43% from the top. The close Brandon original limits hair/shoulder coverage; Owen retains the softness of the supplied image (500-pixel crop enlarged slightly to 512).

## Integration

The shared portrait() renderer covers existing portraits in Party rosters, introductions, ready screens, standings/results, and campaign selection, biography, preflight and profile cards. Screens without existing portrait slots were not redesigned. Character data supplies the image URL and independently configurable portraitPosition, default 50% 50%. Existing object-fit: cover, frames, accents and responsive dimensions are preserved. The enclosing role=img has an accurate accessible name; the nested image has empty alt to avoid duplicate announcements and draggable=false. Initials remain underneath. The existing capture-phase error handler hides failed images and prevents retries on later screens. PLACEHOLDER text is now limited to frames without a visible image.

## Performed verification

- Visually inspected each source and each exported WebP; decoded all exports as 512×512 and confirmed each is below 250 KB.
- npm test: all 138 existing test groups passed; static server returned successful responses for 192 root/project-prefix requests, including all three WebPs with image/webp MIME at /Ragdoll-SV/ and /ragdoll-olympics/.
- TOURNAMENTS=1 npm run test:dom: complete Party flow, restart, introductions, ready screens, results and recovery checks at simulated 1366×768.
- MOBILE=1 TOURNAMENTS=1 npm run test:dom: same flow using touch/pointer events at simulated 360×740.
- npm run test:campaign:dom: 63 attempts covering all three characters, campaign selection/biographies/map/preflight/results, replays, refresh/save/reset checks and complete campaigns.
- node tests/portraits-dom.mjs: each exact mapping, /Ragdoll-SV/ URL resolution, accessible name, positioning, non-draggability, correct fallback initials, hidden failed image and no retry after an error event.
- Captured game console errors and warnings were empty in all three flow harnesses. Node/npm emitted environment warnings about experimental VM modules/proxy configuration, not game errors.
- Compared source against the previous delivered archive: runtime changes are limited to js/characters.js portrait fields, js/ui-content.js portrait markup, and one portrait-only selector in styles.css. Physics, gameplay, scoring, campaign, save, audio and character prose files/fields remain unchanged.

## Limitations

The desktop/mobile runs use JSDOM and actual Matter.js with simulated viewport sizes; they are not browser layout or screen-reader tests. Live browser access was blocked in the preceding preview session; a new connection could not reuse that session. No live-browser visual or actual GitHub-hosted deployment verification is claimed. Relative URLs were verified through the local static server under the exact requested prefix. Missing-image error behavior was exercised with DOM error events; an intentionally absent URL can still produce a browser network 404, although its broken-image icon is hidden.

## Files changed or created

Runtime changed: js/characters.js, js/ui-content.js, styles.css.
Assets created: assets/portraits/jake.webp, assets/portraits/brandon.webp, assets/portraits/owen.webp.
Tests changed: tests/personalization.mjs, tests/dom-flow.mjs, tests/campaign-dom.mjs, tests/serve.mjs, tests/static-files.mjs.
Test created: tests/portraits-dom.mjs.
Documentation changed: README.md, QA.md. Documentation created: PORTRAITS.md.
Delivery rebuilt: deliverables/ragdoll-olympics-vertical-slice.zip.
Temporary test logs and pre-edit copies are retained under .qa/portraits/ and excluded from delivery.
