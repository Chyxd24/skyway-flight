// Boot and the one loop. Input is read every frame, the world advances in fixed 1/60 s steps —
// several in a slow frame, none in a fast one — and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?shot=start|play|end (&seed=N is accepted) stages that scene instead of running the loop, paints
// it twice, and sets window.__shotReady for a screenshot.
import { BEST_KEY, PLANE, RINGS, STEP } from './config.js';
import { createWorld, EVENT_CRASH, EVENT_LAND, EVENT_RING } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Paint the staged scene twice and flag it ready, so a screenshot is only taken once it is drawn. */
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. Fly through ${RINGS.count} rings, then land on the runway.`);
  }

  function endGame(reason) {
    screen = SCREEN_OVER;
    const score = Math.round(world.state.score);
    if (score > best) {
      best = score;
      saveBest(best);
    }
    announce(`${reason}. Score ${score}. Rings ${world.state.rings}/${RINGS.count}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.state.heading += 0.0006;   // a slow pan on the title screen
      return;
    }
    const controls = { pitch: input.pitch(), roll: input.roll(), throttle: input.throttle() };
    const events = world.step(STEP, controls);
    if (events & EVENT_RING) announce(`Ring ${world.state.rings}/${RINGS.count}.`);
    else if (events & EVENT_LAND) endGame('Landed');
    else if (events & EVENT_CRASH) endGame(world.state.stalled ? 'Stalled into the ground' : 'Crashed');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running flight rather than letting the plane fly on unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce(`Skyway. Press Space or click to take off. Target speed ${PLANE.startSpeed} kt.`);
  requestAnimationFrame(frame);
}

// A small handle for tests: start, advance a fixed number of ticks, read state, reset.
window.__SKYWAY__ = {
  start() {
    world.reset();
    return world.state;
  },
  step(ticks = 1, controls = { pitch: 0, roll: 0, throttle: 0 }) {
    let events = 0;
    for (let tick = 0; tick < ticks; tick += 1) events |= world.step(STEP, controls);
    return events;
  },
  state: world.state,
  reset() {
    world.reset();
    return world.state;
  },
};

if (shot) runShot(shot);
else runGame();
