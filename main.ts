// WINDWARD — Coast Patrol: the hand-in program.
//
// The game is this repository's game/ folder, plain static files a desktop browser loads with no build
// step and no network request. This program copies game/ and screenshots/ into the output directory and
// writes out/dossier.json, the summary the judge reads, with the kit's vendored library. Node 22,
// standard library only.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, so a hand-in that the grader would refuse fails here instead.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function stop(reason: string): never {
  console.error(`windward: ${reason}`);
  process.exit(1);
}

function countEntries(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += 1;
    if (entry.isDirectory()) total += countEntries(join(dir, entry.name));
  }
  return total;
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

if (!existsSync(join(gameDir, 'index.html'))) stop('game/index.html is missing');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((name) => !name.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) stop(`screenshots/ holds ${shots.length} files; the gate wants 3 or 4`);
let shotBytes = 0;
for (const name of shots) {
  const bytes = statSync(join(shotsDir, name)).size;
  if (bytes > CAPS.screenshots.max_bytes) stop(`${name} is ${bytes} bytes; the gate allows ${CAPS.screenshots.max_bytes}`);
  shotBytes += bytes;
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));

const gameEntries = countEntries(join(outDir, 'game'));
if (gameEntries > CAPS.game_max_files) stop(`game/ holds ${gameEntries} entries; the gate allows ${CAPS.game_max_files}`);
console.log(
  `windward: ${gameEntries} entries under game/, ${shots.length} screenshots (${shotBytes} bytes), ` +
  `dossier ${statSync(join(outDir, 'dossier.json')).size} bytes -> ${outDir}`,
);
