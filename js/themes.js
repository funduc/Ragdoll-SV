import { Stadium } from "./stadium.js";
import { libraryTooLoud } from "./santor-tour.js";
import { pieceOutline, conveyorSpeed } from "./course.js";

const stadium = new Stadium();
export const DEFAULT_THEME = Object.freeze({
  id: "santor-vault",
  accent: "#52cefa",
  ground: Object.freeze({
    fill: "#25343c", edge: "#97afba", lines: "#354954", cracks: "#101719",
    distanceStrip: "#31464e",
  }),
  ramp: Object.freeze({
    fill: "#374a56", outline: "#73919f", stripes: "#e68031", edge: "#a3bcc8",
  }),
  pieces: Object.freeze({
    pit: Object.freeze({ fill: "#080e16", stroke: "#ffac6f" }),
    platform: Object.freeze({ fill: "#44565f", stroke: "#9bb3bf" }),
    conveyor: Object.freeze({ fill: "#36413a", stroke: "#b4ef4b" }),
    props: Object.freeze({ fill: "#b9824f", stroke: "#463020" }),
    obstacle: Object.freeze({ fill: "#613d50", stroke: "#ffac6f" }),
  }),
  sponsors: Object.freeze(stadium.sponsors.map((board) => Object.freeze([...board]))),
  backdrop(ctx, { width, height, label, accent }) {
    stadium.backdrop(ctx, width, height, label, accent);
  },
  backgroundImage: null,
  parallax: 0.04,
  ambient: null,
});

// Backdrops draw in screen pixels, before the ground and gameplay objects.
// Image paths are relative to the project root, e.g. assets/backdrops/yard.webp.
// Ambient particles are decorative only: fog, snow or sparks, capped at 48.
export function defineTheme(raw) {
  return Object.freeze({
    ...DEFAULT_THEME,
    ...raw,
    ground: Object.freeze({ ...DEFAULT_THEME.ground, ...raw.ground }),
    ramp: Object.freeze({ ...DEFAULT_THEME.ramp, ...raw.ramp }),
    pieces: Object.freeze(Object.fromEntries(Object.entries(DEFAULT_THEME.pieces)
      .map(([kind, colors]) => [kind, Object.freeze({ ...colors, ...raw.pieces?.[kind] })]))),
    sponsors: Object.freeze((raw.sponsors ?? DEFAULT_THEME.sponsors)
      .map((board) => Object.freeze([...board]))),
    ambient: raw.ambient ? Object.freeze({
      kind: "snow", color: "#ffffff66", size: 2,
      speed: 14, drift: 4, ...raw.ambient,
      count: Math.max(0, Math.min(48, Math.floor(raw.ambient.count ?? 24))),
    }) : null,
  });
}

const freezer = defineTheme({
  id: "freezer-aisle", accent: "#adf4f7",
  ground: { fill: "#566f7a", edge: "#d3ffff", lines: "#7b9ca5", cracks: "#344e59", distanceStrip: "#36535f" },
  ramp: { fill: "#9fbfc9", outline: "#d7ffff", stripes: "#5a909d", edge: "#ecffff" },
  pieces: { platform: { fill: "#cedde1", stroke: "#84bac7" }, pit: { fill: "#152c3b", stroke: "#adf4f7" } },
  sponsors: [["AISLE 9", "KEEP FROZEN", "#adf4f7"], ["ICE CREAM", "LIDS ARE FOR LANDING", "#cefaff"]],
  backdrop(ctx, { width: w, height: h, label, time, reducedMotion }) {
    ctx.fillStyle = "#233d4d"; ctx.fillRect(0, 0, w, h);
    const floor = h * 0.81, top = h * 0.24;
    ctx.fillStyle = "#79939d"; ctx.fillRect(0, 0, w, top - 12);
    // Fluorescent tubes, steady even when reduced motion is off.
    for (let x = 32; x < w; x += 270) {
      ctx.fillStyle = "#b5eef01e"; ctx.fillRect(x - 10, 23, 206, 44);
      ctx.fillStyle = "#dffff5"; ctx.fillRect(x, 37, 186, 6);
    }
    for (let x = -32; x < w; x += 136) {
      ctx.fillStyle = "#94b1bb"; ctx.fillRect(x, top, 128, floor - top);
      ctx.fillStyle = "#243c50"; ctx.fillRect(x + 7, top + 7, 114, floor - top - 16);
      for (let shelf = 1; shelf <= 3; shelf++) {
        const y = top + shelf * (floor - top) / 4;
        for (let pack = 0; pack < 4; pack++) {
          ctx.fillStyle = ["#729ba6", "#b1b7b0", "#6d8998", "#819aad"][pack];
          ctx.fillRect(x + 13 + pack * 24, y - 24, 19, 24);
        }
        ctx.fillStyle = "#bce9ed"; ctx.fillRect(x + 8, y, 112, 3);
        ctx.fillStyle = "#f6e6a5"; ctx.fillRect(x + 46, y + 3, 38, 12);
        label("$2.99", x + 65, y + 13, 9, "#24303d", "center");
      }
      // Glass glare and handles.
      ctx.fillStyle = "#c3ffff12"; ctx.fillRect(x + 14, top + 10, 16, floor - top - 24);
      ctx.fillStyle = "#e6f4f4"; ctx.fillRect(x + 108, top + 58, 4, 44);
    }
    const posterX = w * 0.67;
    ctx.fillStyle = "#f4dcaf"; ctx.fillRect(posterX, top + 13, 104, 115);
    label("ICE CREAM", posterX + 52, top + 31, 12, "#483557", "center");
    ctx.fillStyle = "#b77a44"; ctx.beginPath(); ctx.moveTo(posterX + 34, top + 72);
    ctx.lineTo(posterX + 72, top + 72); ctx.lineTo(posterX + 53, top + 107); ctx.fill();
    ctx.fillStyle = "#f6b3d1"; ctx.beginPath(); ctx.arc(posterX + 53, top + 60, 24, 0, Math.PI * 2); ctx.fill();
    label("AISLE 9 · FROZEN", 26, top - 24, 14, "#f0ffff");
    // Low fog is analytic in recorded time; no particles or physics to replay.
    if (!reducedMotion) {
      ctx.fillStyle = "#c9faff13";
      for (let i = 0; i < 12; i++) {
        const x = ((i * 137 + time * 11) % (w + 180)) - 90;
        ctx.beginPath(); ctx.ellipse(x, floor - 15 + Math.sin(i + time * 0.4) * 12,
          110, 22, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  },
  drawPiece(renderer, piece) {
    if (piece.type !== "platform") return false;
    const ctx = renderer.ctx, x = piece.x - piece.width / 2, y = piece.y - piece.height / 2;
    ctx.fillStyle = "#cedde1"; ctx.fillRect(x, y, piece.width, piece.height);
    ctx.strokeStyle = "#84bac7"; ctx.lineWidth = 3; ctx.strokeRect(x, y, piece.width, piece.height);
    ctx.fillStyle = "#efffff"; ctx.fillRect(x + 3, y + 2, piece.width - 6, 9);
    for (let lid = 0; lid < 2; lid++) {
      const left = x + 12 + lid * piece.width / 2;
      ctx.fillStyle = "#6094a6"; ctx.fillRect(left, y + 17, piece.width / 2 - 24, 24);
      ctx.fillStyle = "#e4f6f5"; ctx.fillRect(left + 6, y + 26, 26, 5);
    }
    renderer.label(piece.sign, piece.x, y + 62, 14, "#263e50", "center");
    return true;
  },
});

const comedy = defineTheme({
  id: "open-mic", accent: "#ffc97f",
  ground: { fill: "#392f34", edge: "#c29575", lines: "#59424a", cracks: "#251d26", distanceStrip: "#64403d" },
  ramp: { fill: "#64423c", outline: "#b78264", stripes: "#c29357", edge: "#efc185" },
  pieces: { obstacle: { fill: "#b5c3c9", stroke: "#fce5a8" } },
  sponsors: [["THE OPEN MIC", "PLEASE LAND THE JOKE", "#ffc97f"], ["LIVE TONIGHT", "THREE BITS · TWO WHEELS", "#e2b2a3"]],
  backdrop(ctx, { width: w, height: h, label, time, reducedMotion }) {
    ctx.fillStyle = "#34252f"; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < h / 29; row++) {
      for (let x = (row % 2) * -48; x < w; x += 96) {
        ctx.fillStyle = row % 3 ? "#513238" : "#59383b";
        ctx.fillRect(x + 2, row * 29 + 2, 91, 24);
      }
    }
    const cx = w * 0.57, floor = h * 0.8;
    ctx.fillStyle = "#ffe4ad17"; ctx.beginPath(); ctx.moveTo(cx, 16);
    ctx.lineTo(cx - 150, floor); ctx.lineTo(cx + 150, floor); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#18151d"; ctx.fillRect(cx - 18, 0, 36, 24);
    ctx.fillStyle = "#ffe7b4"; ctx.fillRect(cx - 12, 22, 24, 4);
    label("THE OPEN MIC", cx, h * 0.28, Math.min(32, w / 20), "#ffd89c", "center");
    label("ONE CART · NO REFUNDS", cx, h * 0.28 + 23, 11, "#dfaf9c", "center");
    ctx.strokeStyle = "#ad8069"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx + 55, floor - 58); ctx.lineTo(cx + 46, floor);
    ctx.moveTo(cx + 84, floor - 58); ctx.lineTo(cx + 94, floor);
    ctx.moveTo(cx + 50, floor - 21); ctx.lineTo(cx + 90, floor - 21); ctx.stroke();
    ctx.fillStyle = "#bb7057"; ctx.beginPath(); ctx.ellipse(cx + 70, floor - 60, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < Math.ceil(w / 45); i++) {
      const x = i * 45 + 15, bob = reducedMotion ? 0 : Math.sin(time * 2.4 + i * 1.7) * 3;
      const y = floor + 15 + bob + (i % 3) * 6;
      ctx.fillStyle = "#17151f"; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y + 30, 23, 27, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  drawPiece(renderer, piece) {
    if (piece.type !== "obstacle") return false;
    const ctx = renderer.ctx, x = piece.x - piece.width / 2, y = piece.y - piece.height / 2;
    ctx.fillStyle = "#b5c3c9"; ctx.fillRect(x, y, piece.width, piece.height);
    ctx.strokeStyle = "#fce5a8"; ctx.lineWidth = 2; ctx.strokeRect(x, y, piece.width, piece.height);
    if (piece.label === "mic-head") {
      ctx.fillStyle = "#485361"; ctx.fillRect(x + 27, y + 2, 18, 14);
      renderer.label("CLEAR THE MIC", piece.x, y - 24, 12, "#ffe5ad", "center");
    } else {
      ctx.fillStyle = "#798995"; ctx.fillRect(piece.x - 30, y + piece.height - 5, 60, 5);
    }
    return true;
  },
});

const nightRoad = defineTheme({
  id: "mapleton-night-shift", accent: "#edcf87",
  ground: { fill: "#292b34", edge: "#86838a", lines: "#363740", cracks: "#11131c", distanceStrip: "#4b4650" },
  ramp: { fill: "#44434d", outline: "#999293", stripes: "#cbb47c", edge: "#ebd49e" },
  pieces: { pit: { fill: "#080c15", stroke: "#c9b17c" } },
  sponsors: [["MAPLETON RD", "NIGHT SHIFT", "#edcf87"], ["ROAD WORKS", "POETRY IN MOTION", "#becad0"]],
  backdrop(ctx, { width: w, height: h, label, time, reducedMotion }) {
    ctx.fillStyle = "#101525"; ctx.fillRect(0, 0, w, h);
    const floor = h * 0.8;
    ctx.fillStyle = "#cfcca4"; ctx.beginPath(); ctx.arc(w * 0.83, 52, 17, 0, Math.PI * 2); ctx.fill();
    for (let x = -20, i = 0; x < w; x += 188, i++) {
      const roof = h * 0.37 + (i % 2) * 21;
      ctx.fillStyle = i % 2 ? "#272d3c" : "#303443"; ctx.fillRect(x, roof, 161, floor - roof);
      ctx.beginPath(); ctx.moveTo(x - 8, roof); ctx.lineTo(x + 80, roof - 55);
      ctx.lineTo(x + 169, roof); ctx.closePath(); ctx.fill();
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
        ctx.fillStyle = (i + row + col) % 3 ? "#131c2a" : "#e0b969";
        ctx.fillRect(x + 19 + col * 44, roof + 27 + row * 59, 23, 31);
      }
      // Parked cars stay behind the playable asphalt.
      ctx.fillStyle = ["#525369", "#384c59", "#5b4048"][i % 3];
      ctx.fillRect(x + 15, floor - 36, 118, 24); ctx.fillRect(x + 40, floor - 57, 62, 24);
      ctx.fillStyle = "#111820"; ctx.fillRect(x + 46, floor - 51, 50, 15);
      for (const wheelX of [x + 37, x + 112]) {
        ctx.beginPath(); ctx.arc(wheelX, floor - 12, 11, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let x = 85; x < w; x += 340) {
      const lampY = h * 0.24;
      ctx.fillStyle = "#ffe0a014"; ctx.beginPath(); ctx.moveTo(x, lampY);
      ctx.lineTo(x - 112, floor); ctx.lineTo(x + 112, floor); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, floor, 112, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#585969"; ctx.fillRect(x - 4, lampY, 6, floor - lampY);
      ctx.fillStyle = "#ffe5a9"; ctx.fillRect(x - 19, lampY - 5, 36, 7);
      ctx.fillStyle = "#ecd5aa";
      for (let i = 0; i < 4; i++) {
        const phase = i * 1.7 + (reducedMotion ? 0 : time * (1 + i * 0.17));
        ctx.fillRect(x + Math.cos(phase) * 26, lampY + 16 + Math.sin(phase * 1.3) * 13, 3, 2);
      }
    }
    ctx.fillStyle = "#346451"; ctx.fillRect(w * 0.49 - 73, h * 0.18, 146, 27);
    label("MAPLETON RD", w * 0.49, h * 0.18 + 19, 16, "#eff5d9", "center");
  },
});

const library = defineTheme({
  id: "quiet-please", accent: "#a8d09b",
  ground: { fill: "#4a3930", edge: "#c5ae7b", lines: "#635041", cracks: "#2c241e", distanceStrip: "#695638" },
  ramp: { fill: "#70543e", outline: "#b69d73", stripes: "#517a5d", edge: "#c5ae7b" },
  sponsors: [["QUIET PLEASE", "LAND SOFTLY · READ OFTEN", "#a8d09b"], ["DUE TODAY", "ONE SHOPPING CART", "#d9c497"]],
  backdrop(ctx, view) {
    const { width: w, height: h, label } = view, floor = h * 0.8;
    ctx.fillStyle = "#302c27"; ctx.fillRect(0, 0, w, h);
    for (let x = -8; x < w; x += 178) {
      ctx.fillStyle = "#5d4432"; ctx.fillRect(x, 36, 166, floor - 36);
      for (let row = 0; row < 5; row++) {
        const y = 67 + row * (floor - 78) / 5;
        ctx.fillStyle = "#221e1d"; ctx.fillRect(x + 8, y - 24, 150, 51);
        for (let b = 0; b < 11; b++) {
          const height = 29 + (b * 7 + row * 3) % 18;
          ctx.fillStyle = ["#75624a", "#526f5a", "#704d4b", "#52616b"][(b + row) % 4];
          ctx.fillRect(x + 11 + b * 13, y + 24 - height, 10, height);
          ctx.fillStyle = "#cfba8155"; ctx.fillRect(x + 12 + b * 13, y + 16, 8, 2);
        }
      }
    }
    ctx.fillStyle = "#ddcda9"; ctx.fillRect(w * 0.5 - 87, 54, 174, 36);
    label("QUIET PLEASE", w * 0.5, 79, 21, "#3c4535", "center");
    for (let x = 55; x < w; x += 285) {
      ctx.fillStyle = "#60884a17"; ctx.beginPath(); ctx.moveTo(x, floor - 86);
      ctx.lineTo(x - 65, floor); ctx.lineTo(x + 65, floor); ctx.fill();
      ctx.fillStyle = "#a48c56"; ctx.fillRect(x - 2, floor - 85, 4, 65);
      ctx.fillStyle = "#467d52"; ctx.beginPath(); ctx.ellipse(x, floor - 87, 28, 12, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#77563c"; ctx.fillRect(x - 60, floor - 20, 120, 12);
    }
    const x = w * 0.76, loud = libraryTooLoud(view);
    ctx.fillStyle = "#171d1d"; ctx.beginPath(); ctx.ellipse(x, floor - 40, 25, 44, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + (loud ? -6 : 6), floor - 93, 17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + (loud ? 11 : -11), floor - 104, 9, 0, Math.PI * 2); ctx.fill();
    // Turning is an immediate pose change, safe with reduced motion and in replay.
    ctx.fillStyle = "#b0bba2"; ctx.fillRect(x + (loud ? -18 : 13), floor - 95, 8, 3);
    if (loud) {
      ctx.fillRect(x - 18, floor - 84, 3, 14);
      label("shhh!", x - 28, floor - 125, 19, "#e7d8aa", "center");
    }
  },
  drawPiece(renderer, piece) {
    if (!["book-kicker", "book-stack"].includes(piece.label)) return false;
    const ctx = renderer.ctx, outline = pieceOutline(piece);
    renderer.polygon(outline, "#735542", "#c5ae7b");
    ctx.save(); ctx.beginPath(); outline.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath(); ctx.clip();
    const left = Math.min(...outline.map((p) => p.x)), right = Math.max(...outline.map((p) => p.x));
    for (let y = 462, i = 0; y < 520; y += 12, i++) {
      ctx.fillStyle = i % 2 ? "#526d58" : "#805551"; ctx.fillRect(left, y, right - left, 10);
      ctx.fillStyle = "#cbbb94"; ctx.fillRect(left + 6, y + 3, right - left - 12, 4);
    }
    ctx.restore();
    if (piece.sign) renderer.label(piece.sign, piece.x + piece.width / 2 + 10, 505, 14, "#e9dcae");
    return true;
  },
  drawProp(renderer, prop) {
    const ctx = renderer.ctx, piece = prop.coursePiece;
    ctx.save(); ctx.translate(prop.position.x, prop.position.y); ctx.rotate(prop.angle);
    ctx.fillStyle = piece.fill; ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
    ctx.fillStyle = piece.stroke; ctx.fillRect(-piece.width / 2 + 5, -piece.height / 2 + 3, piece.width - 10, piece.height - 6);
    ctx.restore(); return true;
  },
});

const factory = defineTheme({
  id: "siemens-floor", accent: "#ffad48",
  ground: { fill: "#343d40", edge: "#a2a8a0", lines: "#455155", cracks: "#202829", distanceStrip: "#665d33" },
  ramp: { fill: "#484e4b", outline: "#a7a99a", stripes: "#e2b73c", edge: "#c8c9ac" },
  sponsors: [["SIEMENS CERTIFIED", "NORMAL TUESDAY", "#ffad48"], ["← REVERSE BELT", "STAY ABOARD", "#edcf6a"]],
  backdrop(ctx, { width: w, height: h, label, time, reducedMotion }) {
    ctx.fillStyle = "#283437"; ctx.fillRect(0, 0, w, h);
    for (let x = 20; x < w; x += 155) {
      ctx.fillStyle = "#414e50"; ctx.fillRect(x, 0, 32, h * 0.78);
      ctx.fillStyle = "#687273"; ctx.fillRect(x + 5, 0, 5, h * 0.78);
      for (let y = 100; y < h * 0.75; y += 110) {
        ctx.fillStyle = "#89918b"; ctx.fillRect(x - 4, y, 40, 7);
      }
    }
    ctx.fillStyle = "#626b69"; ctx.fillRect(0, h * 0.29, w, 38);
    ctx.fillStyle = "#8b9185"; ctx.fillRect(0, h * 0.29 + 5, w, 4);
    const floor = h * 0.81;
    ctx.fillStyle = "#171d20"; ctx.fillRect(0, floor - 12, w, 22);
    for (let x = 0; x < w; x += 34) {
      ctx.fillStyle = "#e1b33c"; ctx.beginPath(); ctx.moveTo(x, floor - 12);
      ctx.lineTo(x + 17, floor - 12); ctx.lineTo(x + 34, floor + 10); ctx.lineTo(x + 17, floor + 10); ctx.fill();
    }
    // A background robot: its animation never enters the Matter world.
    ctx.save(); ctx.translate(w * 0.75, floor - 16);
    ctx.fillStyle = "#ae702f"; ctx.fillRect(-38, -18, 76, 24);
    ctx.strokeStyle = "#c8893a"; ctx.lineWidth = 20;
    const sway = reducedMotion ? 0 : Math.sin(time * 0.5) * 14;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-43, -106); ctx.lineTo(18 + sway, -161); ctx.stroke();
    ctx.strokeStyle = "#a9b1a7"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(18 + sway, -161); ctx.lineTo(30 + sway, -134);
    ctx.moveTo(18 + sway, -161); ctx.lineTo(3 + sway, -136); ctx.stroke(); ctx.restore();
    for (let x = 60; x < w; x += 310) {
      ctx.save(); ctx.translate(x, h * 0.2);
      ctx.rotate(reducedMotion ? 0 : time * 2);
      ctx.fillStyle = "#ffb23b23"; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(75, -20); ctx.lineTo(75, 20); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#f59630"; ctx.beginPath(); ctx.arc(x, h * 0.2, 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.translate(w * 0.49, h * 0.32); ctx.rotate(-0.045);
    ctx.fillStyle = "#e7d9ac"; ctx.fillRect(-125, -28, 250, 56);
    label("SIEMENS CERTIFIED", 0, -3, 19, "#2d4b49", "center");
    label("OWEN WRATE · APPROVED", 0, 17, 11, "#59624e", "center"); ctx.restore();
  },
  drawPiece(renderer, piece, course, world) {
    if (piece.type !== "conveyor") return false;
    const ctx = renderer.ctx, left = piece.x - piece.width / 2, top = piece.y - piece.height / 2;
    ctx.fillStyle = "#252d30"; ctx.fillRect(left, top, piece.width, piece.height);
    ctx.strokeStyle = "#d9b83f"; ctx.lineWidth = 3; ctx.strokeRect(left, top, piece.width, piece.height);
    // Freeze the visible tread when the powered cycle stops (also in replay).
    const t = world?.landed ? Math.min(world.elapsed, world.landingTime + piece.stopAfter) : world?.elapsed || 0;
    const offset = renderer.motionPreference?.matches ? 0 : (t * piece.speed) % 60;
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, piece.width, piece.height); ctx.clip();
    for (let x = left - 60 + offset; x < left + piece.width + 60; x += 60) {
      ctx.strokeStyle = "#819087"; ctx.beginPath(); ctx.moveTo(x + 15, top + 7);
      ctx.lineTo(x, top + 18); ctx.lineTo(x + 15, top + 29); ctx.stroke();
    }
    ctx.restore();
    renderer.label(conveyorSpeed(piece, world) ? "← BACKWARDS · STAY ABOARD" : "BELT STOPPED · SETTLE", left + 30, top + 64, 15, "#edcf6a");
    return true;
  },
});

const warehouse = defineTheme({
  id: "temu-warehouse", accent: "#ffad67",
  ground: { fill: "#5d5145", edge: "#c6b49a", lines: "#75624d", cracks: "#352d28", distanceStrip: "#996033" },
  ramp: { fill: "#796049", outline: "#cba273", stripes: "#ef883e", edge: "#ecd4a2" },
  sponsors: [["TEMU WAREHOUSE", "I ORDERED THESE", "#ffad67"], ["36 PARCELS", "HANDLE WITH CART", "#e6c99b"]],
  backdrop(ctx, { width: w, height: h, label }) {
    ctx.fillStyle = "#3c3734"; ctx.fillRect(0, 0, w, h);
    for (let x = -12; x < w; x += 170) {
      ctx.fillStyle = "#6b7774"; ctx.fillRect(x, 0, 9, h * 0.83);
      for (let row = 0; row < 4; row++) {
        const y = 26 + row * h * 0.195;
        for (let box = 0; box < 3; box++) {
          ctx.fillStyle = box % 2 ? "#98734f" : "#b0895b";
          ctx.fillRect(x + 15 + box * 49, y, 43, h * 0.135);
          ctx.fillStyle = "#e48740"; ctx.fillRect(x + 33 + box * 49, y, 7, h * 0.135);
        }
        ctx.fillStyle = "#887657"; ctx.fillRect(x + 10, y + h * 0.135, 156, 8);
        ctx.fillStyle = "#38423f"; ctx.fillRect(x + 10, y + h * 0.135 + 8, 156, 7);
      }
    }
    ctx.fillStyle = "#f2d9a8"; ctx.fillRect(w * 0.04, h * 0.3, w * 0.92, 52);
    label("ESTIMATED DELIVERY:", w / 2, h * 0.3 + 21, 15, "#593f30", "center");
    label("3–5 BUSINESS WEEKS", w / 2, h * 0.3 + 42, 18, "#593f30", "center");
    for (let x = 24; x < w; x += 230) {
      ctx.fillStyle = "#a67d4e"; ctx.fillRect(x, h * 0.8, 118, 9); ctx.fillRect(x, h * 0.83, 118, 7);
      for (let i = 0; i < 3; i++) ctx.fillRect(x + i * 50, h * 0.8, 14, h * 0.04);
    }
  },
  drawProp(renderer, prop) {
    const ctx = renderer.ctx, p = prop.coursePiece;
    ctx.save(); ctx.translate(prop.position.x, prop.position.y); ctx.rotate(prop.angle);
    ctx.fillStyle = "#c49661"; ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    ctx.strokeStyle = "#704c32"; ctx.lineWidth = 2; ctx.strokeRect(-p.width / 2, -p.height / 2, p.width, p.height);
    ctx.fillStyle = "#f08232"; ctx.fillRect(-5, -p.height / 2, 10, p.height);
    ctx.fillStyle = "#eddfbe"; ctx.fillRect(8, -10, 12, 16); ctx.restore(); return true;
  },
});

export const THEMES = Object.freeze({
  [DEFAULT_THEME.id]: DEFAULT_THEME, [freezer.id]: freezer, [comedy.id]: comedy,
  [nightRoad.id]: nightRoad, [library.id]: library,
  [factory.id]: factory, [warehouse.id]: warehouse,
});

export class ThemePainter {
  constructor({ themes = THEMES, createImage = () => new Image() } = {}) {
    this.themes = themes;
    this.createImage = createImage;
    this.images = new Map();
    this.unlocked = false;
    this.disposed = false;
  }
  resolve(id) {
    return Object.hasOwn(this.themes, id) ? this.themes[id] : DEFAULT_THEME;
  }
  // Called through the existing audio gesture hook; no extra input listeners.
  unlock() {
    if (!this.disposed) this.unlocked = true;
  }
  image(src) {
    if (!this.unlocked || this.disposed) return null;
    if (!this.images.has(src)) {
      const entry = { image: null, ready: false };
      this.images.set(src, entry);
      try {
        const image = this.createImage();
        entry.image = image;
        const finish = (ready) => {
          entry.ready = ready;
          image.onload = image.onerror = null;
        };
        image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => finish(false);
        image.src = new URL(src, new URL("../", import.meta.url)).href;
      } catch {
        if (entry.image) entry.image.onload = entry.image.onerror = null;
      }
    }
    const entry = this.images.get(src);
    return entry.ready ? entry.image : null;
  }
  backdrop(ctx, theme, view) {
    const image = theme.backgroundImage ? this.image(theme.backgroundImage) : null;
    if (image) {
      // Cover the viewport with overscan, then drift slightly with the camera.
      // Clamping keeps the image edges offscreen even on very long courses.
      const { width, height, camera, startX, reducedMotion } = view;
      const pad = Math.max(width, height) * 0.08;
      const scale = Math.max((width + pad * 2) / image.naturalWidth,
        (height + pad * 2) / image.naturalHeight);
      const drift = (value) => reducedMotion ? 0 :
        Math.max(-pad, Math.min(pad, value * theme.parallax));
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      ctx.drawImage(image, (width - w) / 2 - drift(camera.x - startX),
        (height - h) / 2 - drift(camera.y), w, h);
    } else {
      // Pending, missing and unsupported images all retain a usable backdrop.
      const fallback = theme.backgroundImage ? DEFAULT_THEME : theme;
      fallback.backdrop(ctx, view);
    }
    this.ambient(ctx, theme.ambient, view);
  }
  ground(ctx, theme, left, right, y, label) {
    stadium.ground(ctx, left, right, y, label, theme.sponsors, theme.ground.cracks);
  }
  ambient(ctx, particles, { width, height, time, reducedMotion }) {
    if (!particles || reducedMotion) return;
    // Analytic positions use recorded simulation time: pause and replay need
    // no particle state, random draws, physics bodies or independent timers.
    const wrap = (value, extent) => ((value % extent) + extent) % extent;
    ctx.save();
    ctx.fillStyle = particles.color;
    for (let i = 0; i < particles.count; i++) {
      const x = wrap(((i * 7919) % 997) / 997 * width + time * particles.drift, width);
      const direction = particles.kind === "sparks" ? -1 : 1;
      const y = wrap(((i * 3253) % 991) / 991 * height + time * particles.speed * direction, height);
      if (particles.kind === "fog") {
        ctx.beginPath();
        ctx.ellipse(x, y, particles.size * 24, particles.size * 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, particles.size,
          particles.size * (particles.kind === "sparks" ? 3 : 1));
      }
    }
    ctx.restore();
  }
  destroy() {
    this.disposed = true;
    for (const { image } of this.images.values()) {
      if (!image) continue;
      image.onload = image.onerror = null;
      image.removeAttribute?.("src");
    }
    this.images.clear();
  }
}
