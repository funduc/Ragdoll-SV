// Original concrete, neon, and fictional sponsors; all procedural Canvas shapes.
export class Stadium {
  constructor() {
    this.grit = Array.from({ length: 85 }, (_, i) => ({
      x: ((i * 7919) % 997) / 997,
      y: ((i * 3253) % 991) / 991,
      size: 1 + (i % 3),
    }));
    this.sponsors = [
      ["AXLE OOPS!", "WHEEL SOLUTIONS", "#ff852b"],
      ["GRAVITY & SONS", "NO RETURNS", "#52cefa"],
      ["CONCRETE+", "SOFTNESS SOLD SEPARATELY", "#b4ef4b"],
      ["BOLT CULT", "TIGHTEN YOUR EXPECTATIONS", "#ff852b"],
    ];
  }
  backdrop(ctx, w, h, label) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#161c24");
    gradient.addColorStop(0.5, "#30383b");
    gradient.addColorStop(1, "#131c22");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    for (const bit of this.grit) {
      ctx.fillStyle = bit.size % 2 ? "#46505355" : "#070c1044";
      ctx.fillRect(bit.x * w, bit.y * h, bit.size * 3, bit.size);
    }
    for (let y = 110; y < h * 0.63; y += 25) {
      ctx.fillStyle = "#10161c";
      ctx.fillRect(0, y, w, 9);
      ctx.fillStyle = "#475355";
      ctx.fillRect(0, y + 9, w, 2);
    }
    for (let x = 24; x < w; x += Math.max(140, w / 6)) {
      ctx.fillStyle = "#0a1016";
      ctx.fillRect(x, 55, 12, h * 0.62);
      ctx.fillStyle = "#617279";
      ctx.fillRect(x + 3, 55, 3, h * 0.62);
      ctx.fillStyle = "#52cefa";
      ctx.fillRect(x - 10, 52, 33, 4);
      ctx.fillStyle = "#52cefa18";
      ctx.fillRect(x - 15, 48, 43, 13);
    }
    const signX = w * 0.53,
      signY = h * 0.3;
    ctx.fillStyle = "#090f16";
    ctx.fillRect(signX - 160, signY - 28, 320, 53);
    ctx.strokeStyle = "#61717c";
    ctx.lineWidth = 3;
    ctx.strokeRect(signX - 160, signY - 28, 320, 53);
    label("THE SANTOR VAULT", signX, signY + 1, 22, "#829b9c", "center");
    label(
      "EXTREME RETAIL ATHLETICS",
      signX,
      signY + 16,
      8,
      "#bd7339",
      "center",
    );
    // Lightning and flame silhouettes flank the stadium sign.
    ctx.fillStyle = "#52cefa77";
    ctx.beginPath();
    ctx.moveTo(signX + 182, signY - 36);
    ctx.lineTo(signX + 158, signY + 2);
    ctx.lineTo(signX + 176, signY - 2);
    ctx.lineTo(signX + 166, signY + 36);
    ctx.lineTo(signX + 199, signY - 9);
    ctx.lineTo(signX + 180, signY - 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff852b66";
    ctx.beginPath();
    ctx.moveTo(signX - 190, signY + 27);
    ctx.quadraticCurveTo(signX - 221, signY + 4, signX - 190, signY - 33);
    ctx.quadraticCurveTo(signX - 192, signY - 1, signX - 174, signY - 12);
    ctx.quadraticCurveTo(signX - 159, signY + 19, signX - 190, signY + 27);
    ctx.fill();
  }
  ground(ctx, left, right, y, label) {
    ctx.strokeStyle = "#101719";
    ctx.lineWidth = 2;
    for (let x = Math.floor(left / 240) * 240; x < right; x += 240) {
      ctx.beginPath();
      ctx.moveTo(x, y + 18);
      ctx.lineTo(x + 28, y + 31);
      ctx.lineTo(x + 18, y + 45);
      ctx.lineTo(x + 65, y + 68);
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const x = 300 + i * 640;
      if (x + 200 < left || x - 180 > right) continue;
      const [name, slogan, color] = this.sponsors[i % this.sponsors.length];
      ctx.fillStyle = "#10191e";
      ctx.fillRect(x - 135, y - 108, 270, 58);
      ctx.strokeStyle = "#070b0f";
      ctx.lineWidth = 5;
      ctx.strokeRect(x - 135, y - 108, 270, 58);
      ctx.fillStyle = color;
      ctx.fillRect(x - 135, y - 108, 270, 4);
      label(name, x, y - 80, 18, color, "center");
      label(slogan, x, y - 64, 8, "#a0b2ba", "center");
      ctx.fillStyle = "#151d22";
      ctx.fillRect(x - 104, y - 50, 5, 50);
      ctx.fillRect(x + 100, y - 50, 5, 50);
    }
  }
}
