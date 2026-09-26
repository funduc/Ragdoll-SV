// MP3 sources are relative to index.html, including GitHub Pages project URLs.
// gainDb matches measured playback loudness to -17 LUFS. The menu MP3 stream
// was preserved; other assets were encoded once from their originals.
export const MUSIC_MASTER_GAIN = 0.95; // headroom, including native-volume fallback
export const MUSIC_TRACKS = Object.freeze({
  menu: Object.freeze({ src: "./assets/audio/music/menu.mp3", gainDb: -2.89 }),
  gameplay1: Object.freeze({
    src: "./assets/audio/music/gameplay1.mp3",
    gainDb: 0.29,
  }),
  gameplay2: Object.freeze({
    src: "./assets/audio/music/gameplay2.mp3",
    gainDb: 0.26,
  }),
  championship: Object.freeze({
    src: "./assets/audio/music/championship.mp3",
    gainDb: 0.26,
  }),
});
// No gameplay3 attachment was supplied. Never request a nonexistent placeholder.
export const GAMEPLAY_TRACKS = Object.freeze(["gameplay1", "gameplay2"]);
