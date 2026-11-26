// Every tuning number, colour and font in one place. The world is a fixed-size
// airspace; the renderer projects it to the window, so no rule below depends on
// the screen size. All art is procedural: no image, sound or font file is loaded.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The plane's flight envelope. Speeds are knots, altitudes feet, headings degrees. */
export const PLANE = {
  minSpeed: 60,
  maxSpeed: 340,
  startSpeed: 150,
  throttleRate: 0.6,   // fraction per second the throttle travels
  turnRate: 0.85,      // radians per second at full bank
  climbRate: 1200,     // feet per second at full climb, full throttle
  sinkRate: 900,       // feet per second at full dive, idle
  stallSpeed: 70,
};

export const WORLD = {
  ceilAlt: 12000,          // feet; above this the air is too thin to climb
  segLength: 220,          // metres of terrain per ring
  drawRings: 95,           // terrain rings drawn ahead
  fogStart: 0.5,           // fraction of the draw distance where fog begins
  fogColour: [176, 196, 224],
};

export const RUNWAY = {
  length: 2600,            // metres
  width: 70,               // metres
  zStart: 700,             // metres downrange where the runway begins
};

export const RINGS = {
  count: 9,
  radius: 160,
  spacing: 1400,           // metres between ring centres downrange
  zStart: 2200,
  lateralJitter: 500,
  altJitter: 900,
  firstAlt: 320,           // feet; ring 0 sits at the plane's initial cruise altitude
};

export const CAMERA = {
  back: 70,                // metres behind the plane
  up: 26,                  // metres above the plane
  fov: 0.62,               // half-FOV multiplier on focal length
};

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

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'skyway-flight.best';
