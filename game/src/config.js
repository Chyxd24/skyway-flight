// The one tuning table for Skyway Flight: screen size, how the aircraft flies, how the world is
// laid out, and every colour and font the renderer uses. The simulated airspace is a fixed size
// and the renderer scales it to whatever window it gets, so none of these numbers depend on the
// screen. Every visual is drawn in code — no image, audio or font file is ever fetched.

export const VIEW = { width: 1280, height: 720 };

/** The fixed simulation step in seconds: 60 updates a second regardless of the display's rate. */
export const STEP = 1 / 60;

/**
 * The aircraft's flight envelope. Speeds in knots, altitudes in feet, angles in radians at rest.
 * throttleRate is how much of the throttle range it travels per second; turnRate is the rate at
 * full bank; climbRate and sinkRate bound how fast height is gained or lost.
 */
export const PLANE = {
  minSpeed: 60,
  maxSpeed: 340,
  startSpeed: 150,
  throttleRate: 0.6,
  turnRate: 0.85,
  climbRate: 1200,
  sinkRate: 900,
  stallSpeed: 70,
};

/** The airspace: a ceiling, the terrain ring spacing, how far ahead is drawn, and where fog bites. */
export const WORLD = {
  ceilAlt: 12000,
  segLength: 220,
  drawRings: 95,
  fogStart: 0.5,
  fogColour: [176, 196, 224],
};

/** The strip of tarmac the flight starts and ends on, downrange along +Z. */
export const RUNWAY = {
  length: 2600,
  width: 70,
  zStart: 700,
};

/** The nine target rings: where they begin, how far apart, and how widely they wander. */
export const RINGS = {
  count: 9,
  radius: 160,
  spacing: 1400,
  zStart: 2200,
  lateralJitter: 500,
  altJitter: 900,
  firstAlt: 320,
};

/** The chase camera: how far behind and above the plane it sits, and how wide the lens is. */
export const CAMERA = {
  back: 70,
  up: 26,
  fov: 0.62,
};

/** Every colour, as CSS values the canvas context takes directly. */
export const PALETTE = {
  skyTop: '#0a1830',
  skyHorizon: '#f0a868',
  sun: '#ffe0a8',
  mountainFar: '#3c4d68',
  mountainMid: '#2b3a52',
  mountainNear: '#1d2a3d',
  ground: '#25382a',
  runway: '#3e434e',
  runwayStripe: '#dde3ec',
  ring: '#ffd166',
  ringPassed: '#7bd88f',
  plane: '#eef3f9',
  planeShade: '#93a6bd',
  planeAccent: '#e5534b',
  hud: '#8ef0c8',
  hudWarn: '#ff9f6e',
  panel: 'rgba(8,14,24,0.78)',
  text: '#eef1f5',
  muted: '#8b93a3',
};

/** The HUD and overlay font stack. Resolved from the system, so nothing is downloaded. */
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where this browser keeps the best score between visits. */
export const BEST_KEY = 'skyway-flight.best';
