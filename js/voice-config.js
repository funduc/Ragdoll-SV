// Paths inside assets/audio/voice/<character>/. A clip can serve several moments.
export const VOICE_CONFIG = {
  jake: [
    { file: "select-1.mp3", moments: ["select"] },
    { file: "air-1.mp3", moments: ["air"] },
    { file: "crash-big-1.mp3", moments: ["crash-big"] },
    { file: "lose-1.mp3", moments: ["lose"] },
    { file: "rare-1.mp3", moments: ["rare"] },
    { file: "rare-2.mp3", moments: ["rare"] },
  ],
  owen: [
    { file: "best-1.mp3", moments: ["best"] },
    { file: "heckle-1.mp3", moments: ["heckle", "win"] },
    { file: "crash-big-1.mp3", moments: ["crash-big"] },
  ],
  brandon: [
    { file: "land-clean-1.mp3", moments: ["land-clean", "win"] },
    { file: "crash-big-1.mp3", moments: ["crash-big"] },
    { file: "heckle-1.mp3", moments: [] },
    { file: "rare-1.mp3", moments: ["rare", "select"] },
  ],
};
export const VOICE_RULES = { volume: 0.85, rareOdds: 15, bigAirPixels: 400, bestMetres: 70 };
