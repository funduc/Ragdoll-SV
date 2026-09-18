import { COURSE } from "./physics.js";
import { Stadium } from "./stadium.js";
import { SKILL_CONFIG } from "./skill-config.js";
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.stadium = new Stadium();
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
    const c = this.ctx,
      w = this.width,
      h = this.height;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#101c25";
    c.fillRect(0, 0, w, h);
    const highest = world
      ? Math.min(world.cart.position.y, world.head.position.y)
      : 100;
    const visibleHeight = Math.max(620, COURSE.groundY - highest + 190);
    // Narrow screens show a closer view; the world itself never resizes.
    const scale = Math.min(w / (w < 600 ? 800 : 1200), h / visibleHeight),
      viewW = w / scale,
      viewH = h / scale;
    const targetX = world
      ? Math.max(0, world.cart.position.x - viewW * 0.32)
      : 0;
    const targetY = COURSE.groundY + 90 - viewH;
    const factor = this.snap ? 1 : 1 - Math.exp(-dt * 9);
    this.camera.scale += (scale - this.camera.scale) * factor;
    this.camera.x += (targetX - this.camera.x) * factor;
    this.camera.y += (targetY - this.camera.y) * factor;
    this.snap = false;
    // Shake affects only the Canvas art; HUD, menus, and controls stay still.
    c.save();
    const shake = effects?.offset() || { x: 0, y: 0 };
    c.translate(shake.x, shake.y);
    this.stadium.backdrop(c, w, h, this.label.bind(this));
    c.save();
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    const left = this.camera.x,
      right = left + w / this.camera.scale;
    c.fillStyle = "#25343c";
    c.fillRect(left, COURSE.groundY, right - left, 3000);
    c.fillStyle = "#97afba";
    c.fillRect(left, COURSE.groundY, right - left, 3);
    c.strokeStyle = "#354954";
    c.lineWidth = 1;
    for (let x = Math.floor(left / 100) * 100; x < right; x += 100) {
      c.beginPath();
      c.moveTo(x, COURSE.groundY + 5);
      c.lineTo(x - 40, COURSE.groundY + 90);
      c.stroke();
    }
    this.stadium.ground(c, left, right, COURSE.groundY, this.label.bind(this));
    c.fillStyle = "#31464e";
    c.fillRect(COURSE.rampEnd, COURSE.groundY + 4, 12000, 8);
    for (let x = COURSE.rampEnd; x < right + 200; x += 200) {
      if (x < left - 50) continue;
      c.fillStyle = "#b4ef4b";
      c.fillRect(x, COURSE.groundY + 2, 2, 16);
      this.label(
        `${(x - COURSE.rampEnd) / 40} m`,
        x + 4,
        COURSE.groundY + 37,
        12,
        "#b3c79c",
      );
    }
    this.polygon(
      [
        { x: COURSE.rampStart, y: COURSE.groundY },
        { x: COURSE.rampEnd, y: COURSE.rampTop },
        { x: COURSE.rampEnd, y: COURSE.groundY },
      ],
      "#374a56",
      "#73919f",
      3,
    );
    c.save();
    c.beginPath();
    c.moveTo(COURSE.rampStart, COURSE.groundY);
    c.lineTo(COURSE.rampEnd, COURSE.rampTop);
    c.lineTo(COURSE.rampEnd, COURSE.groundY);
    c.clip();
    c.strokeStyle = "#e68031";
    c.lineWidth = 7;
    for (let x = 740; x < 1120; x += 46) {
      c.beginPath();
      c.moveTo(x, 520);
      c.lineTo(x + 110, 360);
      c.stroke();
    }
    c.restore();
    c.beginPath();
    c.moveTo(COURSE.rampStart, COURSE.groundY - 2);
    c.lineTo(COURSE.rampEnd, COURSE.rampTop - 2);
    c.strokeStyle = "#a3bcc8";
    c.lineWidth = 7;
    c.stroke();
    c.fillStyle = "#ff852b";
    // Painted ramp strip uses the same cart-centre x windows as skill grading.
    const boost = SKILL_CONFIG.takeoff;
    const rampY = (x) =>
      COURSE.groundY -
      ((x - COURSE.rampStart) * (COURSE.groundY - COURSE.rampTop)) /
        (COURSE.rampEnd - COURSE.rampStart);
    for (const [start, end, color] of [
      [boost.goodStart, Math.min(boost.goodEnd, COURSE.rampEnd), "#e5b74d"],
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
    c.fillRect(COURSE.rampEnd - 3, COURSE.rampTop - 16, 6, 22);
    this.label(
      "TAKEOFF",
      COURSE.rampEnd,
      COURSE.rampTop - 33,
      12,
      "#ffac6f",
      "center",
    );
    this.label("RUN-UP  →", 275, COURSE.groundY + 34, 12, "#91a9b6");
    if (world) {
      if (world.landed) {
        const x = COURSE.rampEnd + world.distancePixels;
        c.setLineDash([5, 6]);
        c.beginPath();
        c.moveTo(x, COURSE.groundY - 110);
        c.lineTo(x, COURSE.groundY + 50);
        c.strokeStyle = "#ff9d52";
        c.lineWidth = 2;
        c.stroke();
        c.setLineDash([]);
        this.label(
          "FIRST CONTACT",
          x,
          COURSE.groundY - 125,
          11,
          "#ffc293",
          "center",
        );
      }
      effects?.drawWorld(c);
      this.drawVehicle(world);
    }
    c.restore();
    effects?.drawScreen(c, w, h);
    c.restore();
  }
  drawVehicle(world) {
    const c = this.ctx;
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
    c.strokeStyle = "#adc5d1";
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
    for (let x = -30; x <= 30; x += 15) {
      c.beginPath();
      c.moveTo(x, -23);
      c.lineTo(x * 0.85, 19);
      c.stroke();
    }
    for (let y = -11; y < 20; y += 14) {
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
    c.fillStyle = world.character.primaryColor;
    c.fillRect(-23, 7, 46, 13);
    c.fillStyle = "#111c24";
    c.font = "bold 8px Arial";
    c.textAlign = "center";
    c.fillText("SANTOR", 0, 17);
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
  destroy() {
    this.observer.disconnect();
  }
}
