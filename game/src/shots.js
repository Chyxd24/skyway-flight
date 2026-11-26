// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward from a
// fresh world for a fixed number of steps, steered by a simple autopilot (bank toward the next
// ring, ease the nose to its altitude, hold a cruising throttle), so the frame is what a short
// flight really looks like and the same seed always gives the same frame.
import { PLANE, RINGS, STEP } from './config.js';
import { ringAt } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 30;
const END_SECONDS = 90;

/** Simple autopilot: bank and pitch toward the next ring, hold cruise throttle. */
function autopilot(state) {
  if (state.nextRing >= RINGS.count) return { pitch: -0.2, roll: 0, throttle: 0.4 };
  const ring = ringAt(state.nextRing);
  const dx = ring.x - state.x;
  const dz = ring.z - state.z;
  const wantedHeading = Math.atan2(dx, dz);
  let headingError = wantedHeading - state.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, headingError * 1.6));
  const wantedAlt = ring.y;
  const altError = wantedAlt - state.y;
  const pitch = Math.max(-0.4, Math.min(0.5, altError / 600));
  return { pitch, roll, throttle: 0.6 };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { pitch: 0.15, roll: 0, throttle: 0.6 });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    const controls = autopilot(world.state);
    world.step(STEP, controls);
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.round(world.state.score) };
}
