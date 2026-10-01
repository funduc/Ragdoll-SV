import { DEFAULT_COURSE, pieceOutline, groundSpans } from "./course.js";
import { ThemePainter } from "./themes.js";
import { drawRunMarkings } from "./run-renderer.js";
import { SKILL_CONFIG } from "./skill-config.js";
export class Renderer {
  constructor(canvas, themeOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.themes = new ThemePainter(themeOptions);
    this.motionPreference = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.cosmetics = {};
    this.camera = { x: 0, y: -80, scale: 1 };
    this.width = 1200;
    this.height = 560;
    this.resize = () => {
      const box = canvas.getBoundingClientRect();
      this.width = Math.max(1, box.width);
      this.height = Math.max(1, box.height);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(this.width * this.dpr);
      canvas.height = Math.round(this.height * this.dpr);
      // Interpolating from the old viewport can briefly crop the whole vehicle.
      this.snap = true;
    };
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();
    this.snap = true;
  }
  resetCamera() {
    this.snap = true;
  }
  polygon(vertices, fill, stroke, line = 2) {
    const c = this.ctx;
    c.beginPath();
    vertices.forEach((v, i) => (i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = line;
      c.stroke();
    }
  }
  label(text, x, y, size = 12, color = "#7c9caa", align = "left") {
    const c = this.ctx;
    c.font = `bold ${size}px "Courier New", monospace`;
    c.fillStyle = color;
    c.textAlign = align;
    c.fillText(text, x, y);
  }
  draw(world, dt = 1 / 60, effects = null) {
    if (world?.invalid) world = null;
    // Everything below is drawn from the world's own course data.
    const course = world?.course || DEFAULT_COURSE;
    const theme = this.themes.resolve(world?.arena?.theme || course.theme);
    const c = this.ctx,
      w = this.width,
      h = this.height;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#101c25";
    c.fillRect(0, 0, w, h);
    const highest = world
      ? Math.min(world.cart.position.y, world.head.position.y)
      : 100;
    const visibleHeight = Math.max(620, course.groundY - highest + 190);
    // Narrow screens show a closer view; the world itself never resizes.
    const crashWidth = world?.crashed && !world.attached
      ? Math.abs(world.head.position.x - world.cart.position.x) + 400 : 0;
    const scale = Math.min(w / Math.max(w < 600 ? 800 : 1200, crashWidth), h / visibleHeight),
      viewW = w / scale,
      viewH = h / scale;
    // The left edge stops just behind the run-up start, as it always has.
    const targetX = world
      ? Math.max(course.startX - 210, (crashWidth ? Math.min(world.cart.position.x, world.head.position.x) : world.cart.position.x) - viewW * 0.32)
      : 0;
    const targetY = course.groundY + 90 - viewH;
    const factor = this.snap ? 1 : 1 - Math.exp(-dt * 9);
    // A snap lands exactly on target, independent of the previous camera.
    const ease = (from, to) => (this.snap ? to : from + (to - from) * factor);
    this.camera.scale = ease(this.camera.scale, scale);
    this.camera.x = ease(this.camera.x, targetX);
    this.camera.y = ease(this.camera.y, targetY);
    this.snap = false;
    // Shake affects only the Canvas art; HUD, menus, and controls stay still.
    c.save();
    const shake = effects?.offset() || { x: 0, y: 0 };
    c.translate(shake.x, shake.y);
    this.themes.backdrop(c, theme, {
      width: w, height: h, label: this.label.bind(this),
      accent: this.cosmetics.arena || theme.accent,
      camera: this.camera, startX: course.startX, time: world?.elapsed || 0,
      reducedMotion: this.motionPreference?.matches || false,
    });
    c.save();
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    const left = this.camera.x,
      right = left + w / this.camera.scale;
    const hasPits = course.pieces.some((p) => p.type === "pit");
    if (hasPits) {
      c.save();
      c.beginPath();
      // Keep background boards intact above the opening; only the floor and
      // its painted markings disappear where the physics ground is missing.
      c.rect(left, this.camera.y, right - left, Math.max(0, course.groundY - this.camera.y));
      for (const span of groundSpans(course))
        c.rect(span.left, course.groundY, span.right - span.left, 3000);
      c.clip();
    }
    c.fillStyle = theme.ground.fill;
    c.fillRect(left, course.groundY, right - left, 3000);
    c.fillStyle = theme.ground.edge;
    c.fillRect(left, course.groundY, right - left, 3);
    c.strokeStyle = theme.ground.lines;
    c.lineWidth = 1;
    for (let x = Math.floor(left / 100) * 100; x < right; x += 100) {
      c.beginPath();
      c.moveTo(x, course.groundY + 5);
      c.lineTo(x - 40, course.groundY + 90);
      c.stroke();
    }
    this.themes.ground(c, theme, left, right, course.groundY, this.label.bind(this));
    c.fillStyle = theme.ground.distanceStrip;
    if (course.distanceMarkers)
      c.fillRect(course.distanceOrigin, course.groundY + 4, 12000, 8);
    for (
      let x = course.distanceOrigin;
      course.distanceMarkers && x < right + 200;
      x += 200
    ) {
      if (x < left - 50) continue;
      c.fillStyle = "#b4ef4b";
      c.fillRect(x, course.groundY + 2, 2, 16);
      this.label(
        `${(x - course.distanceOrigin) / 40} m`,
        x + 4,
        course.groundY + 37,
        12,
        "#b3c79c",
      );
    }
    if (hasPits) c.restore();
    this.polygon(
      [
        { x: course.rampStart, y: course.groundY },
        { x: course.rampEnd, y: course.rampTop },
        { x: course.rampEnd, y: course.groundY },
      ],
      theme.ramp.fill,
      theme.ramp.outline,
      3,
    );
    c.save();
    c.beginPath();
    c.moveTo(course.rampStart, course.groundY);
    c.lineTo(course.rampEnd, course.rampTop);
    c.lineTo(course.rampEnd, course.groundY);
    c.clip();
    c.strokeStyle = theme.ramp.stripes;
    c.lineWidth = 7;
    // Hazard stripes, laid out from the ramp's own foot and height.
    for (let x = course.rampStart + 10; x < course.rampEnd + 40; x += 46) {
      c.beginPath();
      c.moveTo(x, course.groundY);
      c.lineTo(x + 110, course.groundY - 160);
      c.stroke();
    }
    c.restore();
    c.beginPath();
    c.moveTo(course.rampStart, course.groundY - 2);
    c.lineTo(course.rampEnd, course.rampTop - 2);
    c.strokeStyle = theme.ramp.edge;
    c.lineWidth = 7;
    c.stroke();
    // Optional extra static pieces (bars, walls, second ramps) from course data.
    for (const piece of course.pieces) {
      if (["pit", "platform", "conveyor", "props", "obstacle"].includes(piece.type)) {
        this.drawCoursePiece(piece, course, theme);
        continue;
      }
      this.polygon(pieceOutline(piece), piece.fill, piece.stroke, 2);
      if (piece.sign) this.pieceSign(piece);
    }
    for (const prop of world?.looseProps || []) {
      const piece = prop.coursePiece, colors = theme.pieces.props;
      this.polygon(prop.vertices, piece.fill || colors.fill, piece.stroke || colors.stroke, 2);
      c.beginPath();
      c.moveTo(prop.vertices[0].x, prop.vertices[0].y);
      c.lineTo(prop.vertices[2].x, prop.vertices[2].y);
      c.moveTo(prop.vertices[1].x, prop.vertices[1].y);
      c.lineTo(prop.vertices[3].x, prop.vertices[3].y);
      c.stroke();
    }
    if (world?.highJump) this.drawHighJump(world, course);
    if (course.pins) this.drawBowling(world, course);
    drawRunMarkings(this, world, left, right);
    for (const bump of world?.runwayBumps || [])
      this.polygon(bump.vertices, "#667782", "#ffb84b", 2);
    c.fillStyle = "#ff852b";
    // Painted ramp strip uses the same cart-centre x windows as skill grading.
    const boost = world?.skills.config.takeoff || SKILL_CONFIG.takeoff;
    const rampY = (x) =>
      course.groundY -
      ((x - course.rampStart) * (course.groundY - course.rampTop)) /
        (course.rampEnd - course.rampStart);
    for (const [start, end, color] of [
      [boost.goodStart, Math.min(boost.goodEnd, course.rampEnd), "#e5b74d"],
      [boost.perfectStart, boost.perfectEnd, "#b4ef4b"],
    ]) {
      c.beginPath();
      c.moveTo(start, rampY(start) - 3);
      c.lineTo(end, rampY(end) - 3);
      c.lineWidth = 12;
      c.strokeStyle = color;
      c.stroke();
    }
    this.label(
      "BOOST ZONE",
      (boost.perfectStart + boost.perfectEnd) / 2,
      rampY(boost.perfectEnd) - 24,
      11,
      "#b4ef4b",
      "center",
    );
    c.fillStyle = "#ff852b";
    c.fillRect(course.rampEnd - 3, course.rampTop - 16, 6, 22);
    this.label(
      "TAKEOFF",
      course.rampEnd,
      course.rampTop - 33,
      12,
      "#ffac6f",
      "center",
    );
    this.label(
      "RUN-UP  →",
      course.startX + 65,
      course.groundY + 34,
      12,
      "#91a9b6",
    );
    if (world) {
      if (world.landed && course.distanceMarkers) {
        const x = course.distanceOrigin + world.distancePixels;
        c.setLineDash([5, 6]);
        c.beginPath();
        c.moveTo(x, course.groundY - 110);
        c.lineTo(x, course.groundY + 50);
        c.strokeStyle = "#ff9d52";
        c.lineWidth = 2;
        c.stroke();
        c.setLineDash([]);
        this.label(
          "FIRST CONTACT",
          x,
          course.groundY - 125,
          11,
          "#ffc293",
          "center",
        );
      }
      effects?.drawWorld(c);
      this.drawVehicle(world);
      for (const part of world.damage?.debris || []) this.drawDebris(part, world.character);
      if (world.cargo) {
        this.polygon(
          world.cargo.vertices,
          world.cargoLost ? "#ff852b" : "#b4ef4b",
          "#10151a",
          2,
        );
        this.label(
          world.cargoLost ? "MUG RESIGNED" : "FRAGILE MUG",
          world.cargo.position.x,
          world.cargo.position.y - 22,
          12,
          world.cargoLost ? "#ffad72" : "#b4ef4b",
          "center",
        );
      }
    }
    c.restore();
    effects?.drawScreen(c, w, h);
    c.restore();
  }
  // Default piece art uses theme colours, with per-piece overrides.
  drawCoursePiece(piece, course, theme) {
    const c = this.ctx, colors = theme.pieces[piece.type];
    const fill = piece.fill || colors.fill, stroke = piece.stroke || colors.stroke;
    if (piece.type === "pit") {
      const left = piece.x - piece.width / 2;
      c.fillStyle = fill;
      c.fillRect(left, course.groundY, piece.width, 3000);
      c.strokeStyle = stroke;
      c.lineWidth = 3;
      c.beginPath();
      for (const x of [left, left + piece.width]) {
        c.moveTo(x, course.groundY); c.lineTo(x, course.groundY + piece.depth);
      }
      c.stroke();
      this.label(piece.sign || "PIT", piece.x, course.groundY + 26, 12, stroke, "center");
      return;
    }
    if (piece.type === "props") {
      if (piece.lineX !== null) {
        c.strokeStyle = theme.accent; c.lineWidth = 2; c.setLineDash([5, 6]);
        c.beginPath(); c.moveTo(piece.lineX, course.groundY - 150);
        c.lineTo(piece.lineX, course.groundY); c.stroke(); c.setLineDash([]);
        this.label(piece.lineDirection > 0 ? "CLEAR →" : "← CLEAR", piece.lineX,
          course.groundY - 160, 11, theme.accent, "center");
      }
      return;
    }
    this.polygon(pieceOutline(piece), fill, stroke, 2);
    if (piece.type === "conveyor") {
      const direction = Math.sign(piece.speed), y = piece.y - piece.height / 2 - 5;
      c.beginPath();
      for (let x = piece.x - piece.width / 2 + 16; x < piece.x + piece.width / 2 - 10; x += 40) {
        c.moveTo(x - direction * 6, y - 5); c.lineTo(x + direction * 6, y);
        c.lineTo(x - direction * 6, y + 5);
      }
      c.stroke();
    }
    if (piece.type === "obstacle") {
      c.beginPath(); c.moveTo(piece.x, piece.y - piece.height / 2);
      c.lineTo(piece.x, piece.y - piece.height / 2 - 80); c.stroke();
    }
    if (piece.sign) this.pieceSign(piece);
  }
  // Painted sponsor text on a course piece (e.g. the high-jump pit mat).
  pieceSign(piece) {
    const outline = pieceOutline(piece);
    const xs = outline.map((p) => p.x),
      ys = outline.map((p) => p.y);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2,
      y = (Math.min(...ys) + Math.max(...ys)) / 2 + 5;
    this.label(piece.sign, x, y, 14, "#eaf6ff", "center");
  }
  // CART BOWLING: a wooden lane with aiming arrows, then the Crunchos pins.
  drawBowling(world, course) {
    const c = this.ctx,
      ground = course.groundY,
      start = course.rampEnd + 40,
      end = course.pins.x + course.pins.spacing * course.pins.rows + 60;
    c.fillStyle = "#b9824f";
    c.fillRect(start, ground - 3, end - start, 7);
    c.fillStyle = "#8a5a33";
    for (let x = start; x < end; x += 90) c.fillRect(x, ground - 3, 2, 7);
    c.fillStyle = "#ff5a4f";
    c.fillRect(course.pins.x - 520, ground - 5, 4, 10); // foul line
    for (const x of [course.pins.x - 420, course.pins.x - 300, course.pins.x - 180]) {
      c.beginPath();
      c.moveTo(x - 10, ground - 12);
      c.lineTo(x + 10, ground - 18);
      c.lineTo(x - 10, ground - 24);
      c.fillStyle = "#ffcf3f";
      c.fill();
    }
    this.label("CRUNCHOS PIN DECK", course.pins.x + 80, ground + 34, 12, "#ffcf3f", "center");
    const colours = ["#ffcf3f", "#ff852b", "#f4f1e8"];
    const { width, height } = course.pins;
    (world?.pins || []).forEach((pin, i) => {
      this.polygon(pin.vertices, colours[i % 3], "#10151a", 2);
      c.save();
      c.translate(pin.position.x, pin.position.y);
      c.rotate(pin.angle);
      c.fillStyle = "#c93b2f";
      c.fillRect(-width / 2 + 3, -height * 0.18, width - 6, height * 0.2);
      c.restore();
    });
  }
  // CART HIGH JUMP: upright with height marks, the peg, and the real bar.
  drawHighJump(world, course) {
    const c = this.ctx,
      hj = world.highJump,
      x = course.bar.x,
      ground = course.groundY;
    const poleTop = Math.min(hj.barTop - 70, ground - 12 * 40);
    c.fillStyle = "#1c262d";
    c.fillRect(x - 26, ground - 8, 52, 8);
    c.fillStyle = "#dfe8ee";
    c.fillRect(x - 5, poleTop, 10, ground - poleTop);
    c.strokeStyle = "#0b1216";
    c.lineWidth = 2;
    c.strokeRect(x - 5, poleTop, 10, ground - poleTop);
    // Metre marks up the pole, arcade scoreboard style.
    for (let m = 1; ground - m * 40 > poleTop + 10; m++) {
      const y = ground - m * 40;
      c.fillStyle = m % 2 ? "#ff852b" : "#b4ef4b";
      c.fillRect(x - 12, y - 1, 7, 3);
      if (m % 2 === 0) this.label(`${m} m`, x - 16, y + 4, 10, "#91a9b6", "right");
    }
    c.fillStyle = "#ff852b";
    c.fillRect(x - 7, hj.barTop + course.bar.thickness, 14, 6);
    this.label(
      `BAR ${hj.height.toFixed(2)} m`,
      x + 16,
      hj.barTop - 10,
      13,
      hj.knocked ? "#ff9d52" : "#b4ef4b",
    );
    if (world.bar) {
      this.polygon(world.bar.vertices, hj.knocked ? "#ff852b" : "#ff5a4f", "#fff1e6", 2);
      c.fillStyle = "#fff1e6";
      c.fillRect(world.bar.position.x - 5, world.bar.position.y - 1.5, 10, 3);
    }
  }
  drawVehicle(world) {
    const c = this.ctx;
    const lost = world.damage?.lostParts;
    for (const body of world.rider) {
      if (body === world.head) continue;
      const fill =
        body.label === "leg" || body === world.hips
          ? "#536b80"
          : world.character.primaryColor;
      this.polygon(body.vertices, fill, "#091117", 2);
    }
    const head = world.head;
    c.save();
    c.translate(head.position.x, head.position.y);
    c.rotate(head.angle);
    c.beginPath();
    c.arc(0, 0, 11, 0, Math.PI * 2);
    c.fillStyle = "#e0c0a2";
    c.fill();
    c.strokeStyle = "#10151a";
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.arc(0, -2, 12, Math.PI, Math.PI * 2);
    c.fillStyle = world.character.primaryColor;
    c.fill();
    c.fillStyle = "#16232c";
    c.fillRect(4, -1, 5, 3);
    c.restore();
    for (const wheel of world.wheels) {
      c.save();
      c.translate(wheel.position.x, wheel.position.y);
      c.rotate(wheel.angle);
      c.beginPath();
      c.arc(0, 0, 18, 0, Math.PI * 2);
      c.fillStyle = "#0c131a";
      c.fill();
      c.strokeStyle = "#9cabb5";
      c.lineWidth = 3;
      c.stroke();
      c.beginPath();
      c.moveTo(-12, 0);
      c.lineTo(12, 0);
      c.moveTo(0, -12);
      c.lineTo(0, 12);
      c.strokeStyle = "#506777";
      c.lineWidth = 3;
      c.stroke();
      c.beginPath();
      c.arc(0, 0, 4, 0, Math.PI * 2);
      c.fillStyle = "#a3d3e8";
      c.fill();
      c.restore();
    }
    const cart = world.cart;
    c.save();
    c.translate(cart.position.x, cart.position.y);
    c.rotate(cart.angle);
    c.translate(world.cartArtOffset.x, world.cartArtOffset.y);
    c.strokeStyle = this.cosmetics.cart || "#adc5d1";
    c.lineWidth = 4;
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(-48, -25);
    c.lineTo(48, -25);
    c.lineTo(39, 20);
    c.lineTo(-39, 20);
    c.closePath();
    c.stroke();
    c.strokeStyle = "#65899a";
    c.lineWidth = 1.7;
    for (let x = -30; !lost?.has("grille") && x <= 30; x += 15) {
      c.beginPath();
      c.moveTo(x, -23);
      c.lineTo(x * 0.85, 19);
      c.stroke();
    }
    for (let y = -11; !lost?.has("grille") && y < 20; y += 14) {
      c.beginPath();
      c.moveTo(-43, y);
      c.lineTo(43, y);
      c.stroke();
    }
    c.strokeStyle = "#bdd2dc";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-46, -24);
    c.lineTo(-55, -24);
    c.lineTo(-61, -25);
    c.moveTo(-39, 23);
    c.lineTo(-32, 48);
    c.moveTo(39, 23);
    c.lineTo(32, 48);
    c.stroke();
    if (!lost?.has("seat")) {
      c.fillStyle = world.character.primaryColor;
      c.fillRect(-23, 7, 46, 13);
      c.fillStyle = "#111c24";
      c.font = "bold 8px Arial";
      c.textAlign = "center";
      c.fillText("SANTOR", 0, 17);
    }
    if (world.attached) {
      c.strokeStyle = "#b4ef4b";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-13, -15);
      c.lineTo(13, -15);
      c.stroke();
    }
    c.restore();
  }
  drawDebris(part, character) {
    const c = this.ctx;
    c.save();
    c.translate(part.position.x, part.position.y);
    c.rotate(part.angle);
    if (part.label === "grille") {
      c.strokeStyle = this.cosmetics.cart || "#adc5d1";
      c.lineWidth = 2;
      c.strokeRect(-39, -19, 78, 38);
      for (let x = -26; x <= 26; x += 13) {
        c.beginPath(); c.moveTo(x, -19); c.lineTo(x, 19); c.stroke();
      }
      c.beginPath(); c.moveTo(-39, 0); c.lineTo(39, 0); c.stroke();
    } else {
      c.fillStyle = character.primaryColor;
      c.fillRect(-23, -6.5, 46, 13);
      this.label("SANTOR", 0, 3, 8, "#111c24", "center");
    }
    c.restore();
  }
  destroy() {
    this.themes.destroy();
    this.observer.disconnect();
  }
}
