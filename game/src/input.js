// Keyboard and mouse input. Held keys give continuous controls — pitch, roll, throttle — while
// one-shot presses (start or restart, pause) are queued as bit flags and taken once by the loop, so
// a press between two frames is neither lost nor counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'Equal']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'Minus']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

/** Everything the game needs to know about what the player is doing right now. */
export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = null;
  let mouseY = null;

  function down(code) {
    if (CONFIRM.has(code)) {
      if (!held.has(code)) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(code)) {
      if (!held.has(code)) actions |= ACTION_PAUSE;
    }
    held.add(code);
  }

  window.addEventListener('keydown', (event) => {
    if (
      LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) ||
      DOWN.has(event.code) || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code) ||
      CONFIRM.has(event.code) || PAUSE.has(event.code)
    ) event.preventDefault();
    if (event.repeat) return;
    down(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup, so let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  // Mouse: horizontal position steers roll, vertical steers pitch, while the pointer is over the
  // canvas. A click confirms (start or restart).
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width;
    mouseY = (event.clientY - rect.top) / rect.height;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerleave', () => {
    mouseX = null;
    mouseY = null;
  });

  // A pointer position (0..1) as -1..1 about the centre, or 0 when the pointer has left.
  const centre = (value) => (value === null ? 0 : Math.max(-1, Math.min(1, value * 2 - 1)));
  const hasAny = (set) => Array.from(held).some((key) => set.has(key));

  return {
    /** Roll: -1 left, 1 right, from the arrow keys, else the mouse's horizontal position. */
    roll() {
      const fromKeys = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      return Math.max(-1, Math.min(1, fromKeys !== 0 ? fromKeys : centre(mouseX)));
    },
    /** Pitch: -1 nose down, 1 nose up, from the arrow keys, else the mouse's vertical position. */
    pitch() {
      const fromKeys = (hasAny(UP) ? 1 : 0) - (hasAny(DOWN) ? 1 : 0);
      const fromMouse = mouseY === null ? 0 : Math.max(-1, Math.min(1, mouseY * 2 - 1));
      return Math.max(-1, Math.min(1, fromKeys !== 0 ? fromKeys : -fromMouse));
    },
    /** Throttle: -1 idle, 1 full, from the shift and control keys. */
    throttle() {
      return (hasAny(THROTTLE_UP) ? 1 : 0) - (hasAny(THROTTLE_DOWN) ? 1 : 0);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
