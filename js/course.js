// Course shapes as plain data. World pixels, y grows downward, 40 px = 1 m.
// A level or event picks one with `arena.course` (an id or a course object);
// otherwise the default long-jump course is used.

// The takeoff zone as offsets from the ramp edge; courses may override it.
const TAKEOFF_OFFSETS = Object.freeze({
  armedX: -220, // first push after this line commits the one launch opportunity
  goodStart: -140,
  perfectStart: -100,
  perfectEnd: -20,
  goodEnd: 10,
});
export const TAKEOFF_KEYS = Object.freeze(Object.keys(TAKEOFF_OFFSETS));

const number = (value, name) => {
  if (!Number.isFinite(value))
    throw new TypeError(`Course field "${name}" must be a finite number.`);
  return value;
};
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// Outline of a static piece in world coordinates (used by physics and drawing).
export function pieceOutline(piece) {
  if (piece.type === "polygon") return piece.points.map((p) => ({ ...p }));
  const cos = Math.cos(piece.angle),
    sin = Math.sin(piece.angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const dx = (sx * piece.width) / 2,
      dy = (sy * piece.height) / 2;
    return { x: piece.x + dx * cos - dy * sin, y: piece.y + dx * sin + dy * cos };
  });
}

// Extra static pieces: { type: "rect", x, y, width, height, angle? } (x, y is
// the centre) or { type: "polygon", points: [{x, y}, …] }. Optional: label,
// friction, restitution, landing (true = counts as a landing surface, like the
// ground), fill and stroke colours, and sign (text painted on the piece).
function definePiece(raw, index) {
  const common = {
    label: String(raw.label || `course piece ${index + 1}`),
    friction: Number.isFinite(raw.friction) ? raw.friction : 0.8,
    restitution: Number.isFinite(raw.restitution) ? raw.restitution : 0.03,
    landing: raw.landing === true,
    fill: String(raw.fill || "#44565f"),
    stroke: String(raw.stroke || "#9bb3bf"),
    sign: raw.sign ? String(raw.sign) : null, // optional painted text
  };
  if (raw.type === "polygon") {
    if (!Array.isArray(raw.points) || raw.points.length < 3)
      throw new TypeError("A polygon course piece needs at least 3 points.");
    return {
      type: "polygon",
      ...common,
      points: raw.points.map((p, i) => ({
        x: number(p?.x, `pieces[${index}].points[${i}].x`),
        y: number(p?.y, `pieces[${index}].points[${i}].y`),
      })),
    };
  }
  if (raw.type !== "rect")
    throw new TypeError(`Unknown course piece type "${raw.type}".`);
  return {
    type: "rect",
    ...common,
    x: number(raw.x, `pieces[${index}].x`),
    y: number(raw.y, `pieces[${index}].y`),
    width: number(raw.width, `pieces[${index}].width`),
    height: number(raw.height, `pieces[${index}].height`),
    angle: Number.isFinite(raw.angle) ? raw.angle : 0,
  };
}

// Fills in derived fields and freezes the result. Only the ramp, ground
// height and run-up start are required; everything else has a default that
// reproduces the long-jump layout around them.
export function defineCourse(raw) {
  const groundY = number(raw.groundY, "groundY"),
    rampStart = number(raw.rampStart, "rampStart"),
    rampEnd = number(raw.rampEnd, "rampEnd"),
    rampTop = number(raw.rampTop, "rampTop"),
    startX = number(raw.startX, "startX");
  if (!(startX < rampStart && rampStart < rampEnd && rampTop < groundY))
    throw new RangeError(
      "A course needs startX < rampStart < rampEnd and rampTop above groundY.",
    );
  const endX = Number.isFinite(raw.endX) ? raw.endX : rampEnd + 9420;
  const takeoff = Object.fromEntries(
    TAKEOFF_KEYS.map((key) => [
      key,
      Number.isFinite(raw.takeoff?.[key])
        ? raw.takeoff[key]
        : rampEnd + TAKEOFF_OFFSETS[key],
    ]),
  );
  return freeze({
    id: String(raw.id || "custom"),
    name: String(raw.name || raw.id || "Custom course"),
    groundY,
    rampStart,
    rampEnd,
    rampTop,
    startX,
    endX, // passing this x ends the attempt
    // Distance is measured from here (the ramp edge unless a course says otherwise).
    distanceOrigin: Number.isFinite(raw.distanceOrigin)
      ? raw.distanceOrigin
      : rampEnd,
    // The ground slab and the back wall sit a fixed distance behind the start.
    groundLeft: Number.isFinite(raw.groundLeft) ? raw.groundLeft : startX - 1210,
    groundRight: Number.isFinite(raw.groundRight) ? raw.groundRight : endX + 500,
    wallX: Number.isFinite(raw.wallX) ? raw.wallX : startX - 310,
    takeoff,
    // Long-jump distance markings along the landing strip.
    distanceMarkers: raw.distanceMarkers !== false,
    pieces: (raw.pieces || []).map(definePiece),
    // Optional high-jump bar: x is its centre; its height is set per attempt.
    bar: raw.bar
      ? {
          x: number(raw.bar.x, "bar.x"),
          width: Number.isFinite(raw.bar.width) ? raw.bar.width : 44,
          thickness: Number.isFinite(raw.bar.thickness) ? raw.bar.thickness : 8,
        }
      : null,
    // Optional bowling pins: the classic 1-2-3-4 triangle seen from the
    // side, so its rows run down the lane from x. Pins in one row stand side
    // by side in depth (a small stagger shows that); each is a real body.
    pins: raw.pins
      ? {
          x: number(raw.pins.x, "pins.x"),
          width: Number.isFinite(raw.pins.width) ? raw.pins.width : 20,
          height: Number.isFinite(raw.pins.height) ? raw.pins.height : 58,
          rows: Number.isInteger(raw.pins.rows) ? raw.pins.rows : 4,
          spacing: Number.isFinite(raw.pins.spacing) ? raw.pins.spacing : 48,
          stagger: Number.isFinite(raw.pins.stagger) ? raw.pins.stagger : 12,
          density: Number.isFinite(raw.pins.density) ? raw.pins.density : 0.0012,
          friction: Number.isFinite(raw.pins.friction) ? raw.pins.friction : 0.4,
          frictionStatic: Number.isFinite(raw.pins.frictionStatic) ? raw.pins.frictionStatic : 0.6,
        }
      : null,
    // Bowling lanes keep the cart rolling after it lands instead of adding
    // the landing's rolling resistance, and allow a small nudge on the lane.
    rollOut: raw.rollOut === true,
    laneNudge: Number.isFinite(raw.laneNudge) ? raw.laneNudge : 0,
  });
}
// Rest positions of the pins: row 0 (one pin) first, then 2, 3 and 4.
export function pinLayout(pins, groundY) {
  const spots = [];
  for (let row = 0; row < pins.rows; row++)
    for (let i = 0; i <= row; i++)
      spots.push({
        row,
        x: pins.x + row * pins.spacing + (i - row / 2) * pins.stagger,
        y: groundY - pins.height / 2,
      });
  return spots;
}

export const COURSES = freeze({
  "long-jump": defineCourse({
    id: "long-jump",
    name: "Long Jump",
    groundY: 520,
    rampStart: 730,
    rampEnd: 1080,
    rampTop: 330,
    startX: -3000, // long run-up: about six on-beat pushes before the ramp
    endX: 10500,
    groundRight: 11000,
  }),
  // CART HIGH JUMP: a short run-up into a steep kicker, a bar on pegs, then
  // a landing pit. The bar itself is added per attempt (see `bar`).
  "high-jump": defineCourse({
    id: "high-jump",
    name: "High Jump",
    groundY: 520,
    rampStart: 930,
    rampEnd: 1080,
    rampTop: 430, // a 2.25 m kicker lip
    startX: -900, // about three pushes of run-up
    endX: 3600,
    groundRight: 4200,
    bar: { x: 1550, width: 44, thickness: 8 },
    distanceMarkers: false,
    pieces: [
      {
        type: "rect",
        label: "landing pit",
        x: 2600,
        y: 508,
        width: 1900,
        height: 24,
        friction: 0.9,
        restitution: 0,
        landing: true,
        fill: "#2f5e9e",
        stroke: "#8fd0ff",
        sign: "SQUISHCO · THE FLOOR IS SOFTER HERE",
      },
    ],
  }),
  // CART BOWLING: a run-up and a low launch ramp onto a long lane that
  // ends in a pyramid of ten cereal-box pins and a padded backstop.
  bowling: defineCourse({
    id: "bowling",
    name: "Cart Bowling",
    groundY: 520,
    rampStart: 800,
    rampEnd: 1080,
    rampTop: 450,
    startX: -1600,
    endX: 4400,
    groundRight: 5000,
    distanceMarkers: false,
    rollOut: true,
    laneNudge: 0.35,
    // Tuned so pin count climbs with run-up speed: sloppy ≈ 1, good ≈ 6–8,
    // all-Perfect ≈ strike, for every character.
    pins: { x: 3300, height: 66, spacing: 56, density: 0.0022, frictionStatic: 0.4 },
    pieces: [
      {
        type: "rect",
        label: "backstop",
        x: 3700,
        y: 400,
        width: 40,
        height: 240,
        friction: 0.5,
        restitution: 0.2,
        fill: "#3b2a45",
        stroke: "#c79bff",
      },
    ],
  }),
});
export const DEFAULT_COURSE = COURSES["long-jump"];

// Accepts a course id, a raw or defined course object, or nothing.
export function resolveCourse(value) {
  if (!value) return DEFAULT_COURSE;
  if (typeof value === "string") {
    if (!Object.hasOwn(COURSES, value))
      throw new RangeError(`Unknown course "${value}".`);
    return COURSES[value];
  }
  return Object.isFrozen(value) && value.takeoff && value.pieces
    ? value
    : defineCourse(value);
}

// The skill config for a course: its takeoff zone positions replace the
// default ones, keeping any per-attempt widening (e.g. an upgrade) intact.
export function courseSkillConfig(base, course) {
  if (course === DEFAULT_COURSE) return base;
  const takeoff = { ...base.takeoff };
  for (const key of TAKEOFF_KEYS)
    takeoff[key] += course.takeoff[key] - DEFAULT_COURSE.takeoff[key];
  return Object.freeze({ ...base, takeoff: Object.freeze(takeoff) });
}
