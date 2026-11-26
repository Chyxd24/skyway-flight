// The three screenshot scenes behind ?shot=start|play|end. Each plays the real rules forward from a
// fresh world for an exact number of fixed simulation ticks — never a wall-clock interval — steered
// by a small autopilot (bank toward the next ring, ease the nose onto its altitude, hold a cruising
// throttle). The same seed therefore always gives the same frame, byte for byte.
import { RINGS, STEP } from './config.js';
import { ringAt } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// Fixed tick counts, not seconds: START_SECONDS / STEP and so on, resolved once.
const START_TICKS = Math.round(4 / STEP);
const PLAY_TICKS = Math.round(30 / STEP);
const END_TICKS = Math.round(90 / STEP);

/** A steady hand for the screenshot flights: bank and pitch toward the next ring, hold cruise. */
function autopilot(state) {
  if (state.nextRing >= RINGS.count) return { pitch: -0.2, roll: 0, throttle: 0.4 };
  const ring = ringAt(state.nextRing);
  const wantedHeading = Math.atan2(ring.x - state.x, ring.z - state.z);
  let headingError = wantedHeading - state.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, headingError * 1.6));
  const pitch = Math.max(-0.4, Math.min(0.5, (ring.y - state.y) / 600));
  return { pitch, roll, throttle: 0.6 };
}

/**
 * Set `world` to the named scene (start, play or end; anything else means start) by stepping it the
 * scene's fixed number of ticks, and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let tick = 0; tick < START_TICKS; tick += 1) world.step(STEP, { pitch: 0.15, roll: 0, throttle: 0.6 });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const ticks = name === 'end' ? END_TICKS : PLAY_TICKS;
  for (let tick = 0; tick < ticks; tick += 1) world.step(STEP, autopilot(world.state));
  return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: Math.round(world.state.score) };
}
