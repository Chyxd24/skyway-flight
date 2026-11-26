// The game's rules and state, with no drawing and no browser in it: the aircraft's position,
// heading, altitude and speed, the terrain it flies over, the runway it starts and ends on and the
// target rings to fly through. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react without the world knowing about screens or sound. Nothing here
// allocates after createWorld returns (the terrain cache is filled at boot).
import { PLANE, RINGS, RUNWAY, WORLD } from './config.js';

export const EVENT_RING = 1;   // flew through the next target ring
export const EVENT_LAND = 2;   // touched down on the runway within its bounds
export const EVENT_CRASH = 4;  // hit the ground away from the runway, or flew into a hill

const DEG = Math.PI / 180;

/** Deterministic pseudo-terrain height (metres) at a world x,z. Seeded, no allocation. */
function terrainHeight(x, z) {
  // Sum of a few sines: cheap, smooth, repeatable, and it makes recognisable ridges and valleys
  // the plane must climb over or weave between.
  const h =
    260 * Math.sin(x * 0.0016 + z * 0.0009) +
    180 * Math.sin(x * 0.0031 - z * 0.0022 + 1.3) +
    120 * Math.sin(x * 0.0007 + z * 0.0034 + 2.1) +
    70 * Math.sin(x * 0.0061 + z * 0.0057 + 0.4);
  // Keep a flattish corridor along the runway's heading so take-off and landing are fair.
  const corridor = Math.max(0, 1 - Math.abs(x) / 900) * Math.max(0, 1 - Math.abs(z - RUNWAY.zStart - RUNWAY.length / 2) / 2600);
  return Math.max(0, h * (1 - corridor * 0.85));
}

/** The centre and radius of target ring `index` (0-based), downrange along +Z. */
export function ringAt(index) {
  // Ring 0 sits nearly on the runway's heading so a straight take-off flies through it; later
  // rings swing progressively wider to either side to demand real steering.
  const swing = index % 2 === 0 ? 1 : -1;
  const lateral = RINGS.lateralJitter * (index / Math.max(1, RINGS.count - 1)) * swing;
  const alt = RINGS.firstAlt + RINGS.altJitter * (index / Math.max(1, RINGS.count - 1)) * ((index * 53) % 13) / 12;
  return { x: lateral, y: alt, z: RINGS.zStart + index * RINGS.spacing, radius: RINGS.radius };
}

export function createWorld() {
  const state = {
    x: 0, y: 0, z: 0,            // metres; y is altitude above the field
    heading: 0,                  // radians, 0 = +Z (down the runway)
    speed: PLANE.startSpeed,     // knots
    throttle: 0.5,               // 0..1
    pitch: 0,                    // radians, positive = nose up
    bank: 0,                     // radians, positive = right wing down
    score: 0,
    rings: 0,                    // rings passed
    elapsed: 0,
    stalled: false,
    over: false,
    landed: false,
    nextRing: 0,
  };

  function reset() {
    state.x = 0; state.y = 300; state.z = 0;
    state.heading = 0; state.speed = PLANE.startSpeed; state.throttle = 0.5;
    state.pitch = 0; state.bank = 0;
    state.score = 0; state.rings = 0; state.elapsed = 0;
    state.stalled = false; state.over = false; state.landed = false;
    state.nextRing = 0;
  }

  /**
   * One fixed step. `controls` = { pitch: -1..1 (nose down..up), roll: -1..1 (left..right),
   * throttle: -1..1 (idle..full). Returns EVENT_* flags.
   */
  function step(dt, controls) {
    let events = 0;
    if (state.over) return 0;
    state.elapsed += dt;

    // Throttle and speed: more throttle accelerates, drag resists, climbing costs speed.
    state.throttle = Math.max(0, Math.min(1, state.throttle + controls.throttle * PLANE.throttleRate * dt));
    const thrust = state.throttle * PLANE.maxSpeed;
    const climbDrag = Math.max(0, state.pitch) * 90;
    const target = Math.max(PLANE.minSpeed, Math.min(PLANE.maxSpeed, thrust - climbDrag * 0.4 + 60));
    state.speed += (target - state.speed) * 1.4 * dt;

    // Attitude: bank from roll, pitch from the climb control.
    state.bank += controls.roll * PLANE.turnRate * 1.4 * dt;
    state.bank = Math.max(-1.1, Math.min(1.1, state.bank));
    state.pitch += controls.pitch * PLANE.turnRate * 0.9 * dt;
    state.pitch = Math.max(-0.6, Math.min(0.6, state.pitch));

    // Heading turns with bank; the faster the turn, the more speed bleeds.
    state.heading += state.bank * PLANE.turnRate * 0.6 * dt;

    // Altitude from pitch and speed (energy exchange: climb and you trade speed for height).
    const climb = state.pitch * PLANE.climbRate * (state.speed / PLANE.maxSpeed);
    state.y += climb * dt;
    if (state.y > WORLD.ceilAlt) state.y = WORLD.ceilAlt;

    // Position: move along the heading at the current speed (knots -> m/s is ~0.514).
    const metresPerSecond = state.speed * 0.514;
    state.x += Math.sin(state.heading) * metresPerSecond * dt;
    state.z += Math.cos(state.heading) * metresPerSecond * dt;

    // Stall: below stall speed the nose drops and the plane sinks.
    state.stalled = state.speed < PLANE.stallSpeed;
    if (state.stalled) state.y -= 260 * dt;

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

    // Rings: passed when the plane is within the ring's disc as it crosses the ring's plane.
    if (state.nextRing < RINGS.count) {
      const ring = ringAt(state.nextRing);
      if (state.z >= ring.z) {
        const dx = state.x - ring.x;
        const dy = (state.y - ring.y) * 1.0;
        if (dx * dx + dy * dy <= ring.radius * ring.radius) {
          state.rings += 1;
          state.score += 100;
          events |= EVENT_RING;
        }
        state.nextRing += 1;
      }
    }
    // Score also for distance flown, so a clean flight always earns something.
    state.score += metresPerSecond * dt * 0.02;
    return events;
  }

  reset();
  return { state, reset, step, terrainHeight, ringAt };
}
