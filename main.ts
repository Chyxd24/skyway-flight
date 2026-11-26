// Skyway Flight — the program that hands the game in. It copies this repository's game/ folder
// (plain static files a desktop browser loads offline: game/index.html and its ES modules, with no
// library and no network request) and screenshots/ to /output, then writes /output/dossier.json,
// the summary the judge reads, using the vendored make.fun library.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080. Outside the
// grader's container MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (RULES.txt, "The gate"): at most 4 screenshots, each within 256 KiB; at
// most 993 files in game/ and 48 MiB of game files in all; no path under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const entries = readdirSync(join(here, 'game'));
const shots = readdirSync(join(here, 'screenshots'));
const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
const textBytes = Buffer.byteLength(dossier.text ?? '', 'utf8');
// The vendored kit's "## Game" header states its own source and total byte counts; surface them on
// the hand-in line so the scorer can see the caps are respected without opening the dossier.
const totals = /^Totals: (\d+) files? and director(?:y|ies) \((\d+) bytes\)$/m.exec(dossier.text ?? '');
const where = totals ? `${totals[1]} files/dirs, ${totals[2]} B` : 'unknown size';
process.stdout.write(
  `Skyway Flight: handed in ${entries.length} game/ entries (${where}) and ${shots.length} screenshots; ` +
  `dossier.json ${dossier.schema} (text ${textBytes} B); serve game/ and fly the 9 rings.\n`,
);
