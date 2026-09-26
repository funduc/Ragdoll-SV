# Ragdoll Olympics: The Santor Vault

A browser game about shopping-cart long jumps with ragdoll physics. Play the saved **Vault Run** solo campaign or a three-player local **Party Tournament** as Jake, Brandon, and Owen. Built with vanilla HTML/CSS/JavaScript and vendored Matter.js; no build step or backend.

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

On Vault Run results, **RETRY** or **R** starts the same level without the map or briefing. Three-heat levels restart at heat 1. A pending upgrade choice comes first; choosing or skipping it then starts your retry.

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
