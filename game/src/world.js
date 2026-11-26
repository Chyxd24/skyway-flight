// The game's rules and its state, with no drawing and no browser in it: where the aircraft is, the
// way it points, how fast it goes, the terrain beneath it, the runway it starts and ends on, and
// the nine target rings to thread. step() advances exactly one fixed step and reports what happened
// as bit flags, so the caller can react without this file knowing about screens or sound. Nothing
// allocates once createWorld has returned — the scenery is generated up front from a fixed seed.
import { PLANE, RINGS, RUNWAY, WORLD } from './config.js';
import { createRandom } from './random.js';

export const EVENT_RING = 1;   // flew through the next target ring
export const EVENT_LAND = 2;   // touched down on the runway within its bounds
export const EVENT_CRASH = 4;  // hit the ground off the runway, or flew into a hill

/** The seed every run of the world is built from, so the scenery and the screenshots repeat. */
export const WORLD_SEED = 20261126;

/**
 * A mountain range: a ridge line sampled once from the seeded random, summed from a few harmonics
 * so it reads as terrain rather than noise. `height` is its peak in metres, `wavelength` how far
 * apart its ridges sit, and `phase` offsets it from its neighbours.
 */
function createRange(random, height, wavelength) {
  const harmonics = [];
  for (let k = 0; k < 4; k += 1) {
    harmonics.push({
      amp: height / (k + 1),
      freq: (k + 1) * (Math.PI * 2) / wavelength,
      phase: random() * Math.PI * 2,
    });
  }
  return {
    harmonics,
    /** The ridge's height in metres at a world x. */
    at(x) {
      let sum = 0;
      for (const h of this.harmonics) sum += h.amp * Math.sin(x * h.freq + h.phase);
      return sum;
    },
  };
}

/** The centre and radius of target ring `index` (0-based), downrange along +Z. */
export function ringAt(index) {
  // Ring 0 sits almost on the runway's heading so a straight take-off threads it; later rings swing
  // progressively wider to either side, and climb and dive, to demand real steering.
  const span = Math.max(1, RINGS.count - 1);
  const swing = index % 2 === 0 ? 1 : -1;
  const lateral = RINGS.lateralJitter * (index / span) * swing;
  const alt = RINGS.firstAlt + RINGS.altJitter * (index / span) * (((index * 53) % 13) / 12);
  return { x: lateral, y: alt, z: RINGS.zStart + index * RINGS.spacing, radius: RINGS.radius };
}

export function createWorld() {
  // Seeded scenery: three mountain ranges far, mid and near, each with its own amplitude and
  // wavelength, plus the ground. Their phases come from the seeded random, never Math.random.
  const random = createRandom(WORLD_SEED);
  const ranges = [
    createRange(random, 110, 5200),   // far: broad ridges on the horizon
    createRange(random, 70, 3300),    // mid
    createRange(random, 40, 1900),    // near: low hills that break up the ground
  ];
  // How strongly each range shows through at a world x,z: the far range is broad, the near one
  // localised, and all of them are damped along the runway's corridor so take-off and landing are fair.
  const rangeWeights = [0.9, 0.7, 0.5];

  /**
   * Deterministic terrain height in metres at a world x,z: the ground plus the three ranges,
   * flattened where the runway's corridor runs. Seeded and allocation-free.
   */
  function terrainHeight(x, z) {
    const undulation =
      260 * Math.sin(x * 0.0016 + z * 0.0009) +
      180 * Math.sin(x * 0.0031 - z * 0.0022 + 1.3) +
      120 * Math.sin(x * 0.0007 + z * 0.0034 + 2.1) +
      70 * Math.sin(x * 0.0061 + z * 0.0057 + 0.4);
    let ridge = 0;
    for (let k = 0; k < ranges.length; k += 1) ridge += ranges[k].at(x + z * 0.35) * rangeWeights[k];
    const corridor =
      Math.max(0, 1 - Math.abs(x) / 900) *
      Math.max(0, 1 - Math.abs(z - RUNWAY.zStart - RUNWAY.length / 2) / 2600);
    const damp = 1 - corridor * 0.85;
    return Math.max(0, (undulation + ridge) * damp);
  }

  const state = {
    x: 0, y: 0, z: 0,            // metres; y is altitude above the field
    prevX: 0, prevY: 0, prevZ: 0, // where the last step began, to interpolate a ring crossing
    heading: 0,                  // radians, 0 = +Z, down the runway
    speed: PLANE.startSpeed,     // knots
    throttle: 0.5,               // 0..1
    pitch: 0,                    // radians, positive = nose up
    bank: 0,                     // radians, positive = right wing down
    score: 0,
    rings: 0,                    // rings passed so far
    elapsed: 0,
    stalled: false,
    over: false,
    landed: false,
    nextRing: 0,
  };

  function reset() {
    state.x = 0; state.y = 300; state.z = 0;
    state.prevX = 0; state.prevY = 300; state.prevZ = 0;
    state.heading = 0; state.speed = PLANE.startSpeed; state.throttle = 0.5;
    state.pitch = 0; state.bank = 0;
    state.score = 0; state.rings = 0; state.elapsed = 0;
    state.stalled = false; state.over = false; state.landed = false;
    state.nextRing = 0;
  }

  /**
   * One fixed step. `controls` is { pitch: -1..1 (nose down..up), roll: -1..1 (left..right),
   * throttle: -1..1 (idle..full) }. Returns EVENT_* flags.
   */
  function step(dt, controls) {
    let events = 0;
    if (state.over) return 0;
    state.elapsed += dt;
    state.prevX = state.x; state.prevY = state.y; state.prevZ = state.z;

    // Throttle and speed: more throttle accelerates, drag resists, climbing costs speed.
    state.throttle = Math.max(0, Math.min(1, state.throttle + controls.throttle * PLANE.throttleRate * dt));
    const thrust = state.throttle * PLANE.maxSpeed;
    const climbDrag = Math.max(0, state.pitch) * 90;
    const target = Math.max(PLANE.minSpeed, Math.min(PLANE.maxSpeed, thrust - climbDrag * 0.4 + 60));
    state.speed += (target - state.speed) * 1.4 * dt;

    // Attitude: bank from roll, pitch from the climb control, each clamped to a sane range.
    state.bank += controls.roll * PLANE.turnRate * 1.4 * dt;
    state.bank = Math.max(-1.1, Math.min(1.1, state.bank));
    state.pitch += controls.pitch * PLANE.turnRate * 0.9 * dt;
    state.pitch = Math.max(-0.6, Math.min(0.6, state.pitch));

    // Heading turns with bank; a hard turn bleeds speed.
    state.heading += state.bank * PLANE.turnRate * 0.6 * dt;

    // Altitude from pitch and speed: climbing trades speed for height.
    const climb = state.pitch * PLANE.climbRate * (state.speed / PLANE.maxSpeed);
    state.y += climb * dt;
    if (state.y > WORLD.ceilAlt) state.y = WORLD.ceilAlt;

    // Position: along the heading at the current speed (knots to m/s is about 0.514).
    const metresPerSecond = state.speed * 0.514;
    state.x += Math.sin(state.heading) * metresPerSecond * dt;
    state.z += Math.cos(state.heading) * metresPerSecond * dt;

    // Stall: below stall speed the nose drops and the plane sinks. The sink scales with how far below
    // the stall speed it is, capped by sinkRate, so a near-stall is survivable but a deep one drops.
    state.stalled = state.speed < PLANE.stallSpeed;
    if (state.stalled) {
      const severity = Math.min(1, (PLANE.stallSpeed - state.speed) / PLANE.stallSpeed);
      state.y -= Math.min(PLANE.sinkRate, 90 + 170 * severity) * dt;
    }

    // Ground: land only on the runway, crash into terrain anywhere else.
    const ground = terrainHeight(state.x, state.z);
    const onRunway =
      state.z >= RUNWAY.zStart && state.z <= RUNWAY.zStart + RUNWAY.length &&
      Math.abs(state.x) <= RUNWAY.width / 2;
    if (state.y <= ground + 2) {
      if (onRunway && Math.abs(state.pitch) < 0.2) {
        state.over = true; state.landed = true; events |= EVENT_LAND;
      } else {
        state.over = true; events |= EVENT_CRASH;
      }
    }

    // Rings: passed when the plane threads the ring's disc. The crossing is interpolated back to the
    // ring's plane, so a fast pass is judged where it crossed rather than a step after it, and the
    // score rewards threading the centre — 100 for a pass, up to 50 more the closer to the bullseye.
    if (state.nextRing < RINGS.count) {
      const ring = ringAt(state.nextRing);
      if (state.z >= ring.z) {
        const dz = state.z - state.prevZ;
        const f = dz > 0 ? (ring.z - state.prevZ) / dz : 0;
        const dx = state.prevX + (state.x - state.prevX) * f - ring.x;
        const dy = state.prevY + (state.y - state.prevY) * f - ring.y;
        const miss = Math.sqrt(dx * dx + dy * dy);
        if (miss <= ring.radius) {
          state.rings += 1;
          state.score += 100 + Math.round(50 * Math.max(0, 1 - miss / ring.radius));
          events |= EVENT_RING;
        }
        state.nextRing += 1;
      }
    }
    // A little score for distance flown, so any clean flight earns something.
    state.score += metresPerSecond * dt * 0.02;
    return events;
  }

  reset();
  return { state, reset, step, terrainHeight, ringAt, ranges };
}
