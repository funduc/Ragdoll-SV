# Music integration and audio inspection

Four supplied tracks are integrated. **No gameplay3 attachment was supplied**, so the ordinary playlist contains gameplay1 and gameplay2. Its first selection is random; with two available tracks, avoiding the preceding track means later selections alternate. No nonexistent gameplay3 URL is requested.

## Original files — inspected before editing

All sources are stereo, 44.1 kHz. Sizes below use decimal MB (1 MB = 1,000,000 bytes).

| Source | Format | Duration | Audio bitrate | Original bytes | Original MB |
| --- | --- | ---: | ---: | ---: | ---: |
| `Menu(1).mp3` | MP3 | 85.707750 s | 192 kbps | 2,057,044 | 2.06 |
| `gameplay1(1).mp3` | MP3 + embedded PNG artwork | 81.815510 s | 192 kbps | 4,557,939 | 4.56 |
| `Gameplay2(1).wav` | WAV, signed 16-bit PCM | 101.142857 s | 1,411.2 kbps | 17,841,784 | 17.84 |
| `Championship track(1).wav` | WAV, signed 16-bit PCM | 100.539070 s | 1,411.2 kbps | 17,735,276 | 17.74 |

Gameplay1's overall file bitrate was 445.7 kbps because of its large 3000×3000 cover image; its audio stream was already 192 kbps. The original attachments were not modified and are excluded from the published source archive and `assets/audio/music/`.

## Finished browser assets

All four outputs are stereo, 44.1 kHz, **192 kbps MP3**, under `assets/audio/music/`. No OGG/Opus copy was created; this implementation uses the requested MP3 assets and contains load-failure handling instead of shipping redundant encodings.

| Output | Encoded duration | Optimized bytes | Original → optimized MB | Reduction |
| --- | ---: | ---: | ---: | ---: |
| `menu.mp3` | 84.662857 s | 2,032,579 | 2.06 → 2.03 | 1.2% |
| `gameplay1.mp3` | 81.763265 s | 1,962,989 | 4.56 → 1.96 | 56.9% |
| `gameplay2.mp3` | 99.448163 s | 2,387,426 | 17.84 → 2.39 | 86.6% |
| `championship.mp3` | 98.115918 s | 2,355,453 | 17.74 → 2.36 | 86.7% |

Total: **42,192,043 → 8,738,447 bytes**, about **79.3% smaller**. Gameplay1 is approximately 2 MB; it was not padded to meet an arbitrary minimum. Encoded durations include MP3 framing/padding and can differ slightly from decoded edit lengths.

### Processing and volume matching

FFprobe inspected codec, rate, channels, duration, streams and size. FFmpeg measured integrated loudness/true peak and detected silence below −60 dB lasting at least 50 ms. Only unnecessary edge silence was removed; interior pauses were retained.

- **Menu:** retain through 84.66 s, remove unnecessary metadata, stream-copy the MP3 audio. All **3,241 retained compressed audio packets match the source**; no recompression. Its already-quiet beginning/end did not require a new fade. Volume matching is applied by the game's per-track gain.
- **Gameplay1:** remove cover art; retain through 81.72 s; apply −5.60 dB and 8 ms edge fades; encode once directly from the original MP3. An initial stream-copy candidate was inspected but not shipped: its decoded true peak exceeded 0 dB. The final file repairs that peak overshoot. No encoded intermediate was used as a source.
- **Gameplay2:** retain source 0.06–99.48 s, leaving a small onset/tail guard; apply −6.80 dB and 8 ms edge fades; encode once from the original WAV.
- **Championship:** retain through 98.08 s; apply −1.09 dB and 8 ms edge fades; encode once from the original WAV.

The three encoded files used `libmp3lame` at 192 kbps. The menu used `-c:a copy`. Every output was fully decoded and remeasured. The results are below 0 dBFS; the codec/track gain corrections below match perceived playback loudness without additional recompression.

| Track | File loudness | File true peak | Playback correction | Music true peak at slider 100% |
| --- | ---: | ---: | ---: | ---: |
| Menu | −14.11 LUFS | −1.53 dBTP | −2.89 dB | −4.87 dBTP |
| Gameplay1 | −17.29 LUFS | −5.21 dBTP | +0.29 dB | −5.37 dBTP |
| Gameplay2 | −17.26 LUFS | −6.23 dBTP | +0.26 dB | −6.42 dBTP |
| Championship | −17.26 LUFS | −2.66 dBTP | +0.26 dB | −2.85 dBTP |

Each track matches **−17 LUFS before mixer headroom**, approximately **−17.45 LUFS at Music 100%** after the common 0.95 music gain. Default Music volume is 45%; Effects defaults to 100% of the existing effects mix. The preserved menu MP3 is louder if opened outside the game: its normalization intentionally resides in `music-config.js`. Web Audio music gain uses an 8 ms smoothing constant when available; the native media-volume fallback uses the same bounded gains. Measurements are per music channel, not a claim about every possible simultaneous effects mix.

## Runtime behavior

- The title initially shows **Enter the Vault**. Clicking/tapping it or activating it with Enter/Space reveals the existing mode choices and enables music. A held Enter cannot also select a mode. Refresh requires entry again; consent is not persisted.
- Title, campaign selection/profile/map/reward/reset screens, and the Achievement Vault use menu music after entry. Campaign preflight shows menu music until the first attempt begins.
- Beginning an ordinary campaign level selects from the supplied gameplay tracks, excluding the previously selected ordinary track. Retries keep the same track and playback position. Map replay retains that level's selection; another level/character/run selects again. Returning to menus stops the gameplay source and starts menu music.
- Gauntlet and Overtime use championship music across all three attempts, heat hand-offs and results. Party championship introduction, attempts and final results also use championship music. Ordinary Party attempts use the gameplay playlist.
- A single lazy streaming `Audio` element uses native looping. Track transitions stop the previous source rather than crossfading. No full-track AudioBuffers, music intervals or timeouts were introduced.
- Hidden/unfocused pages pause immediately through the existing pause handler; resuming continues the current position. Muting or Music 0% pauses music. Effects volume is independent.
- The existing sound button mutes both channels. Volume values use version-1 `santor-vault:audio`; mute preserves `santor-vault:muted`. Only user changes save preferences. Campaign, run and achievement saves are untouched.
- Missing/unsupported tracks are silenced for the session without repeated requests. Playback rejections are caught, and autoplay-policy rejection can retry on a later deliberate gesture. A stale load promise cannot pause a newer track or strand rapid mute/unmute. A browser may still report an HTTP 404 in its network tools; the application does not throw or stop the game.
- Music routes through a separate gain on the existing running AudioContext where supported. Native media playback remains available if Web Audio is unavailable. The sound toggle stays usable for music even if effects cannot initialize.

## Tests performed

- `npm test`: **138 deterministic assertion groups**, including eight new music groups; the static server also passed **122 root/project-prefix requests**, MP3 MIME checks, and intentional image/music 404s.
- `tests/music.mjs`: entry gating; one-element looping configuration; random selection without consecutive repeats; retry/replay retention; Gauntlet/Party championship routing; menu transition; mute and independent volumes; hidden-state pause/resume; refresh without autoplay; corrupt/denied preferences; missing files; rejected/stale playback promises; rapid mute/unmute; gain headroom and disposal.
- One complete desktop Party Tournament plus fault/recovery attempts, and one complete simulated-touch Party Tournament with Web Audio unavailable. Existing scoring, world disposal, input, audio-context and timer assertions passed. The touch run also tested held Enter on the entry gate.
- The campaign integration suite completed 63 attempts, including full campaigns with Jake, Brandon and Owen, another full Jake no-upgrade campaign, Overtime, replay, five saved-data reloads, resets and developer cases. A final rerun asserted gameplay/championship source routing and menu music on map return. No captured game errors/warnings occurred.
- `tests/accessibility-dom.mjs`: existing keyboard controls plus range input updates, readable volume values and keyup cleanup after focus moves to a slider.
- All four final MP3s were fully decoded without errors, measured for loudness/true peak, checked for finite sub-unity decoded sample peaks and quiet edge samples. Menu packet identity was compared with the original source.

**Limits:** integration media playback/looping is tested with a media lifecycle double, actual game modules, JSDOM and native Canvas. The browser rejected the local preview URL with `net::ERR_BLOCKED_BY_CLIENT`; audible output, actual browser looping/autoplay, mobile slider behavior and live CSS layout could not be verified. No browser playback pass is claimed. Gameplay3 remains missing and was not invented or duplicated.

## Files changed

New: `js/music.js`, `js/music-config.js`, `js/audio-preferences.js`, four `assets/audio/music/*.mp3` files, `tests/music.mjs`, `tests/fake-music.mjs`, and this report.

Updated: `js/audio.js` (shared mute/effects volume and music availability), `js/presentation.js` (music state/pause/disposal), `js/game.js` (entry gate/volume wiring/immediate pause), `js/ui.js` (entry button), `index.html`/`styles.css` (volume controls), `tests/dom-flow.mjs`, `tests/campaign-dom.mjs`, `tests/accessibility-dom.mjs`, `tests/static-files.mjs`, `tests/serve.mjs`, `package.json`, `README.md`, `QA.md`, and the source archive.

Physics, scoring, skills, tricks, tournament and campaign progression implementations were not modified.
