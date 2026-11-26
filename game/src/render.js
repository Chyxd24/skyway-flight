// Drawing only: the world's state and the current screen in, pixels out. The renderer projects the
// 3D airspace to a 1280x720 view scaled to the window. Everything is drawn with the canvas 2D API:
// a gradient sky, a sun, three layers of procedural mountains, the ground, the runway, the target
// rings, the plane seen from behind (chase view) and the HUD. No images, no fonts to load.
import { CAMERA, FONT, PALETTE, PLANE, RINGS, RUNWAY, VIEW, WORLD } from './config.js';
import { ringAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 70 };

/** Project a world point (metres) to view coordinates. Returns null when behind the camera. */
function makeProjector(state) {
  // The chase camera sits behind and above the plane, looking down its heading.
  const camX = state.x - Math.sin(state.heading) * CAMERA.back;
  const camY = state.y + CAMERA.up;
  const camZ = state.z - Math.cos(state.heading) * CAMERA.back;
  const cosH = Math.cos(-state.heading);
  const sinH = Math.sin(-state.heading);
  const focal = VIEW.width * CAMERA.fov;
  return function project(wx, wy, wz) {
    // Translate to the camera, then rotate so the camera looks along +Z'.
    const dx = wx - camX;
    const dz = wz - camZ;
    const dy = wy - camY;
    const rx = dx * cosH - dz * sinH;
    const rz = dx * sinH + dz * cosH;
    const ry = dy;
    if (rz <= 1) return null;              // behind or at the camera
    // Pitch the view slightly down so the horizon sits above centre.
    const pitch = 0.08;
    const y2 = ry * Math.cos(pitch) - rz * Math.sin(pitch);
    const z2 = ry * Math.sin(pitch) + rz * Math.cos(pitch);
    if (z2 <= 1) return null;
    const scale = focal / z2;
    return { x: VIEW.width / 2 + rx * scale, y: VIEW.height / 2 - y2 * scale, scale, depth: z2 };
  };
}

function lerpColour(a, b, t) {
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16));
  const mixed = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${mixed[0]},${mixed[1]},${mixed[2]})`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /** The sky, the sun and a horizon that shifts with the heading. */
  function drawSky(state) {
    const gradient = context.createLinearGradient(0, 0, 0, VIEW.height * 0.62);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(1, PALETTE.skyHorizon);
    context.fillStyle = gradient;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    // Sun low on the horizon, drifting with the heading so turning is visible.
    const sunX = VIEW.width / 2 - Math.sin(state.heading) * 520;
    const sunY = VIEW.height * 0.34;
    const glow = context.createRadialGradient(sunX, sunY, 4, sunX, sunY, 220);
    glow.addColorStop(0, PALETTE.sun);
    glow.addColorStop(1, 'rgba(255,224,168,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  /** Three parallax mountain ranges behind the terrain, shifting with the heading. */
  function drawMountains(state) {
    const horizon = VIEW.height * 0.46;
    const layers = [
      { colour: PALETTE.mountainFar, amp: 70, freq: 0.004, base: horizon, parallax: 90 },
      { colour: PALETTE.mountainMid, amp: 110, freq: 0.007, base: horizon + 18, parallax: 160 },
      { colour: PALETTE.mountainNear, amp: 150, freq: 0.011, base: horizon + 40, parallax: 240 },
    ];
    const shift = state.heading * 260;
    for (const layer of layers) {
      context.fillStyle = layer.colour;
      context.beginPath();
      context.moveTo(0, VIEW.height);
      for (let px = 0; px <= VIEW.width; px += 16) {
        const t = (px + shift * layer.parallax / 240);
        const h = layer.amp * (0.6 + 0.4 * Math.sin(t * layer.freq)) * (0.7 + 0.3 * Math.sin(t * layer.freq * 2.7 + 1));
        context.lineTo(px, layer.base - h);
      }
      context.lineTo(VIEW.width, VIEW.height);
      context.closePath();
      context.fill();
    }
  }

  /** The ground plane and the runway, projected. */
  function drawGround(state) {
    const project = makeProjector(state);
    // A coarse grid of ground quads ahead of the plane.
    const ahead = WORLD.drawRings;
    for (let i = 0; i < ahead; i += 1) {
      const z = state.z + i * WORLD.segLength;
      const quad = [
        project(-6000, 0, z),
        project(6000, 0, z),
        project(6000, 0, z + WORLD.segLength),
        project(-6000, 0, z + WORLD.segLength),
      ];
      if (quad.some((p) => p === null)) continue;
      const t = Math.min(1, i / ahead);
      context.fillStyle = lerpColour(PALETTE.ground, PALETTE.mountainNear, t * 0.6);
      context.beginPath();
      context.moveTo(quad[0].x, quad[0].y);
      for (let k = 1; k < 4; k += 1) context.lineTo(quad[k].x, quad[k].y);
      context.closePath();
      context.fill();
    }

    // The runway: a long stripe with centre dashes.
    const rz0 = RUNWAY.zStart;
    const rz1 = RUNWAY.zStart + RUNWAY.length;
    const half = RUNWAY.width / 2;
    const corners = [
      project(-half, 1, rz0), project(half, 1, rz0),
      project(half, 1, rz1), project(-half, 1, rz1),
    ];
    if (corners.every((p) => p !== null)) {
      context.fillStyle = PALETTE.runway;
      context.beginPath();
      context.moveTo(corners[0].x, corners[0].y);
      for (let k = 1; k < 4; k += 1) context.lineTo(corners[k].x, corners[k].y);
      context.closePath();
      context.fill();
      // Centre dashes.
      context.fillStyle = PALETTE.runwayStripe;
      const dashes = 12;
      for (let d = 0; d < dashes; d += 1) {
        const zA = rz0 + (rz1 - rz0) * (d / dashes + 0.05);
        const zB = rz0 + (rz1 - rz0) * (d / dashes + 0.15);
        const a = project(0, 1.5, zA);
        const b = project(0, 1.5, zB);
        if (a === null || b === null) continue;
        context.lineWidth = Math.max(1, a.scale * 3);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }
  }

  /** The next target rings ahead of the plane. */
  function drawRings(state) {
    const project = makeProjector(state);
    for (let index = state.nextRing; index < Math.min(RINGS.count, state.nextRing + 4); index += 1) {
      const ring = ringAt(index);
      const centre = project(ring.x, ring.y, ring.z);
      if (centre === null) continue;
      // Draw the ring as an ellipse (a circle seen at an angle): project two edge points.
      const left = project(ring.x - ring.radius, ring.y, ring.z);
      const right = project(ring.x + ring.radius, ring.y, ring.z);
      if (left === null || right === null) continue;
      const radiusX = (right.x - left.x) / 2;
      const radiusY = radiusX * 0.35;
      context.strokeStyle = index === state.nextRing ? PALETTE.ring : PALETTE.ringPassed;
      context.lineWidth = Math.max(2, centre.scale * 6);
      context.beginPath();
      context.ellipse(centre.x, centre.y, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
      context.stroke();
    }
  }

  /** The player's plane in chase view: a simple low-poly silhouette from behind. */
  function drawPlane(state) {
    const cx = VIEW.width / 2;
    const cy = VIEW.height * 0.62;
    const roll = state.bank;
    context.save();
    context.translate(cx, cy);
    context.rotate(roll * 0.6);
    // Wings.
    context.fillStyle = PALETTE.plane;
    context.beginPath();
    context.moveTo(-120, 6);
    context.lineTo(-30, -8);
    context.lineTo(30, -8);
    context.lineTo(120, 6);
    context.lineTo(30, 16);
    context.lineTo(-30, 16);
    context.closePath();
    context.fill();
    // Fuselage.
    context.fillStyle = PALETTE.planeShade;
    context.beginPath();
    context.moveTo(0, -22);
    context.lineTo(14, 18);
    context.lineTo(-14, 18);
    context.closePath();
    context.fill();
    // Tail.
    context.fillStyle = PALETTE.planeAccent;
    context.beginPath();
    context.moveTo(-34, 14);
    context.lineTo(0, 6);
    context.lineTo(34, 14);
    context.lineTo(0, 24);
    context.closePath();
    context.fill();
    // Cockpit glint.
    context.fillStyle = 'rgba(142,240,200,0.85)';
    context.beginPath();
    context.ellipse(0, -6, 7, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  /** The HUD: airspeed, altitude, heading, throttle, rings, score and the next-ring indicator. */
  function drawHud(state) {
    context.textBaseline = 'top';
    const hud = state.stalled ? PALETTE.hudWarn : PALETTE.hud;
    // Left: airspeed.
    context.fillStyle = PALETTE.panel;
    context.fillRect(20, 20, 190, 96);
    text('AIRSPEED', 34, 30, 16, PALETTE.muted, 'left');
    text(`${Math.round(state.speed)} kt`, 34, 50, 34, hud, 'left');
    // Right: altitude.
    context.fillStyle = PALETTE.panel;
    context.fillRect(VIEW.width - 210, 20, 190, 96);
    text('ALTITUDE', VIEW.width - 196, 30, 16, PALETTE.muted, 'left');
    text(`${Math.round(state.y)} ft`, VIEW.width - 196, 50, 34, hud, 'left');
    // Centre top: heading tape and rings.
    text(`HDG ${Math.round(((state.heading * 180) / Math.PI) % 360)}°`, VIEW.width / 2, 24, 26, PALETTE.text, 'center');
    text(`RINGS ${state.rings}/${RINGS.count}   SCORE ${Math.round(state.score)}`, VIEW.width / 2, 54, 20, PALETTE.hud, 'center');
    // Throttle bar bottom-left.
    context.fillStyle = PALETTE.panel;
    context.fillRect(20, VIEW.height - 84, 190, 44);
    text(`THR ${Math.round(state.throttle * 100)}%`, 34, VIEW.height - 74, 18, PALETTE.muted, 'left');
    context.fillStyle = PALETTE.hud;
    context.fillRect(140, VIEW.height - 74, 56 * state.throttle, 20);
    context.strokeStyle = PALETTE.muted;
    context.strokeRect(140, VIEW.height - 74, 56, 20);
    // Bank indicator bottom-right.
    context.fillStyle = PALETTE.panel;
    context.fillRect(VIEW.width - 210, VIEW.height - 84, 190, 44);
    text(`BANK ${Math.round((state.bank * 180) / Math.PI)}°`, VIEW.width - 196, VIEW.height - 74, 18, PALETTE.muted, 'left');
    if (state.stalled) text('STALL', VIEW.width / 2, VIEW.height / 2 - 40, 40, PALETTE.hudWarn, 'center');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 82, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 40, 24, PALETTE.ring, 'center');
  }

  const TITLE_LINES = ['Chase view. Fly through the gold rings, land on the runway.', '← → or mouse: bank.  ↑ ↓: pitch.  Shift/Ctrl: throttle.', ''];
  const PAUSED_LINES = ['The sky will wait for you.'];
  const OVER_LINES = ['', ''];

  /** Paint one frame: sky, terrain, runway, rings, the plane, then the HUD or a panel. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.skyTop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky(state);
    drawMountains(state);
    drawGround(state);
    drawRings(state);
    drawPlane(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[2] = `Best score ${best}`;
      drawPanel('Skyway', TITLE_LINES, 'Press Space or click to take off');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = `Score ${Math.round(state.score)}   Rings ${state.rings}/${RINGS.count}`;
      OVER_LINES[1] = `Best score ${best}`;
      drawPanel(state.landed ? 'Landed!' : 'Crashed', OVER_LINES, 'Press Space or click to fly again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
