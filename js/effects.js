export const MAX_PARTICLES = 96;
export class Effects {
  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
    this.seed = 713;
    this.clear();
  }
  clear() {
    this.particles = [];
    this.shakeTime = 0;
    this.time = 0;
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  burst(kind, x, y, count = 16) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.reducedMotion)
      count = kind === "confetti" ? 0 : Math.min(count, 4);
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const r = () => this.random();
      const confetti = kind === "confetti",
        spark = kind === "spark";
      this.particles.push({
        kind,
        x,
        y,
        vx: (r() - 0.5) * (spark ? 220 : confetti ? 0.48 : 95),
        vy: confetti ? -(0.4 + r() * 0.25) : -(25 + r() * (spark ? 150 : 60)),
        life: spark
          ? 0.2 + r() * 0.2
          : confetti
            ? 1.3 + r() * 0.4
            : 0.4 + r() * 0.4,
        age: 0,
        size: spark ? 1 + r() * 2 : confetti ? 3 + r() * 3 : 3 + r() * 5,
        color: spark
          ? "#ffbf52"
          : confetti
            ? ["#ff852b", "#52cefa", "#b4ef4b"][i % 3]
            : "#9b9c8f",
      });
    }
  }
  victory() {
    this.burst("confetti", 0.09, 0.8, 24);
    this.burst("confetti", 0.91, 0.8, 24);
  }
  shake() {
    if (!this.reducedMotion) this.shakeTime = Math.max(this.shakeTime, 0.22);
  }
  offset() {
    const strength = Math.min(1, this.shakeTime / 0.22) * 4;
    return {
      x: Math.sin(this.time * 103) * strength,
      y: Math.cos(this.time * 127) * strength * 0.65,
    };
  }
  update(dt) {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
    this.time += dt;
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    let write = 0;
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy +=
        (p.kind === "confetti" ? 0.65 : p.kind === "spark" ? 250 : 35) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.particles[write++] = p;
    }
    this.particles.length = write;
  }
  drawWorld(ctx) {
    ctx.save();
    for (const p of this.particles) {
      if (p.kind === "confetti") continue;
      ctx.globalAlpha = (1 - p.age / p.life) * (p.kind === "dust" ? 0.36 : 0.9);
      ctx.fillStyle = p.color;
      if (p.kind === "spark") ctx.fillRect(p.x, p.y, p.size * 3, p.size);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + p.age), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  drawScreen(ctx, width, height) {
    ctx.save();
    for (const p of this.particles) {
      if (p.kind !== "confetti") continue;
      ctx.globalAlpha = (1 - p.age / p.life) * 0.9;
      ctx.fillStyle = p.color;
      ctx.fillRect(
        p.x * width,
        p.y * height,
        p.size,
        p.size * (0.5 + Math.abs(Math.sin(p.age * 10))),
      );
    }
    ctx.restore();
  }
}
