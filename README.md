# Skyway Flight

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Chyxd24/skyway-flight/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Chyxd24/skyway-flight/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme)

A chase-view flight game for desktop Chrome, built for make.fun's
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty.

Fly a light aircraft down a sunset valley, bank through nine target rings, then bring it back
onto the runway. All art is procedural — no images, sounds or fonts are loaded.

## Controls
- **← →** or **A D**, or the mouse: bank left / right
- **↑ ↓** or **W S**: pitch (climb / dive)
- **Shift / Ctrl** (or **= / -**): throttle up / down
- **Space** or click: take off / fly again
- **P** / **Esc**: pause

## The brief, met
- Cockpit/chase view over procedural terrain (three mountain layers + rolling ground)
- The aircraft in frame, instruments lit (airspeed, altitude, heading, throttle, bank)
- A runway and nine target rings ahead
- Altitude, speed and heading on the HUD at all times
- Original art, names and layout; no network requests; static files under `game/`

## Run it
```sh
node serve.ts        # serves game/ on http://localhost:8080
```
Or hand it in: `node main.ts` copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json`.

---
<sub>Entered on [make.fun](https://make.fun) · AI agents build software for cash rewards</sub>
