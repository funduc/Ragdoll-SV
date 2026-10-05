// Shared silhouettes for upgrade cards and the owned-upgrade strip.
const ICONS = {
  "reinforced-wheels": '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="5"/><path d="M16 5v6m0 10v6M5 16h6m10 0h6"/>',
  "wider-launch-window": '<path d="M5 27V5m0 1h18l-6 6 6 6H5M12 26h15m-4-4 4 4-4 4"/>',
  "improved-air-control": '<path d="m5 26 19-21 3 21ZM12 22h9"/>',
  "wider-brace-window": '<rect x="3" y="8" width="26" height="16" rx="6"/><path d="M10 8v16m12-16v16"/>',
  "style-multiplier": '<path d="m16 3 4 9 10 1-8 7 3 10-9-5-9 5 3-10-8-7 10-1Z"/>',
  "emergency-stabilizer": '<path d="M16 5v13M5 25l11-7 11 7M7 9l9-4 9 4"/><circle cx="5" cy="26" r="3"/><circle cx="27" cy="26" r="3"/>',
  "faster-perfect-pushes": '<rect x="3" y="8" width="26" height="18" rx="2"/><path d="m19 3-9 14h8l-5 12 12-16h-9Z"/>',
  "impact-harness": '<path d="M6 4v24h20V4M6 5l20 22M26 5 6 27"/><rect x="12" y="13" width="8" height="6"/>',
  "rocket-booster": '<path d="M12 22C5 13 17 4 27 4c0 10-9 22-18 15L4 28l9-5M11 10H5l-3 9 7-1M24 21v6l-9 3 1-7"/><circle cx="20" cy="11" r="3"/>',
  "spring-launch": '<path d="M4 4h24M6 8l20 4-20 4 20 4-20 4M4 28h24"/>',
  focus: '<path d="M11 3H3v8m18-8h8v8M3 21v8h8m18-8v8h-8"/><circle cx="16" cy="16" r="7"/><path d="M16 12v5l3 2"/>',
  "air-brake": '<path d="M5 7h8v18H5Zm14 0h8v18h-8ZM2 3l4 2m24-2-4 2M2 29l4-2m24 2-4-2"/>',
  "bigger-wheels": '<circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="7"/><path d="M16 3v5m0 16v5M3 16h5m16 0h5"/>',
};
export function upgradeIcon(id) {
  return `<svg class="upgrade-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${ICONS[id] || ""}</svg>`;
}

// Art only, in cart-local coordinates. No bodies, forces or gameplay randomness.
export function drawCartUpgrades(c, world, reducedMotion = false) {
  const fx = world.runEffects, n = fx?.upgrades;
  if (!n || !Object.values(n).some(Boolean)) return;
  c.save();
  c.lineWidth = 3; c.lineJoin = "round";
  const line = (points, color, width = 3) => {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
  };
  if (n["improved-air-control"]) {
    c.fillStyle = "#63d3ff"; c.strokeStyle = "#122b38";
    c.beginPath(); c.moveTo(-47, -27); c.lineTo(-65, -58 - 5 * n["improved-air-control"]);
    c.lineTo(-64, -21); c.closePath(); c.fill(); c.stroke();
  }
  if (n["wider-launch-window"]) {
    line([[43, -26], [43, -53]], "#ffe291", 2);
    c.fillStyle = "#ffe291"; c.fillRect(44, -53, 11 + 3 * n["wider-launch-window"], 7);
  }
  if (n.focus) {
    c.strokeStyle = "#ad9dff"; c.fillStyle = fx.focusActive ? "#fff4bd" : "#8074bd";
    c.beginPath(); c.arc(27, -31, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  if (n["wider-brace-window"]) {
    c.fillStyle = "#d88eee";
    c.fillRect(42, -12, 8 + n["wider-brace-window"] * 2, 29);
    c.fillRect(-53 - n["wider-brace-window"] * 2, -12, 8 + n["wider-brace-window"] * 2, 29);
  }
  if (n["impact-harness"] && world.attached) {
    line([[-16, -23], [16, 4], [-16, 4], [16, -23]], "#ffb155", 4);
    c.fillStyle = "#fff1c6"; c.fillRect(-4, -12, 8, 6);
  }
  if (n["style-multiplier"]) {
    c.font = `bold ${15 + n["style-multiplier"] * 2}px Arial`; c.textAlign = "center";
    c.fillStyle = "#ffdf68"; c.fillText("★", 0, -4);
  }
  if (n["spring-launch"]) {
    c.fillStyle = "#3d5568"; c.fillRect(-25, 23, 50, 4); c.fillRect(-25, 41, 50, 4);
    line([[-18, 28], [18, 30], [-18, 34], [18, 38], [-18, 41]], "#ffe291", 2 + n["spring-launch"]);
  }
  if (n["faster-perfect-pushes"]) {
    c.fillStyle = "#62d6a2"; c.fillRect(23, 24, 19, 12);
    line([[28, 25], [34, 28], [29, 31], [36, 34]], "#10382f", 2);
  }
  if (n["emergency-stabilizer"]) {
    line([[-36, 26], [-54, 42], [-67, 42]], "#90ddcc", 3);
    c.fillStyle = "#90ddcc"; c.fillRect(-69, 40, 8, 6);
  }
  if (n["air-brake"]) {
    const open = world.elapsed < fx.brakeUntil;
    line([[28, 19], [open ? 62 : 40, open ? 32 : 20]], "#9ec3db", 3);
    c.fillStyle = "#68d8e8";
    c.fillRect(open ? 59 : 35, open ? 20 : 18, open ? 6 : 17, open ? 28 : 6);
  }
  if (n["rocket-booster"]) {
    c.fillStyle = "#e68048"; c.fillRect(-65, 10, 25, 16);
    c.fillStyle = "#303d4b"; c.fillRect(-70, 12, 7, 12);
    c.fillStyle = "#ffdb91"; c.fillRect(-46, 13, 4, 10);
    if (world.elapsed < fx.rocketUntil && !world.crashed && !world.landed) {
      const length = reducedMotion ? 29 : 29 + Math.sin(world.elapsed * 90) * 9;
      for (const [size, color] of [[length, "#ff792e"], [length * .6, "#fff3a1"]]) {
        c.fillStyle = color; c.beginPath(); c.moveTo(-71, 11); c.lineTo(-71 - size, 18);
        c.lineTo(-71, 25); c.closePath(); c.fill();
      }
    }
  }
  c.restore();
}
