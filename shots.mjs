// Screenshot the game at each ?shot= scene into screenshots/ using playwright-core + the local
// Chromium. Run: node shots.mjs
import { chromium } from '/root/.npm/_npx/af752b90495482d7/node_modules/rea-agents/node_modules/playwright-core/index.mjs';
import { readdirSync } from 'node:fs';

const shots = JSON.parse(await import('node:fs').then((m) => m.readFileSync('shots.json', 'utf8')));
const url = 'http://localhost:8091/';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

for (const shot of shots) {
  await page.goto(url + shot.query, { waitUntil: 'load' });
  await page.waitForFunction('window.__shotReady === true', { timeout: 20000 });
  await page.waitForTimeout(300);
  const path = `screenshots/${shot.name}`;
  await page.screenshot({ path, type: 'jpeg', quality: 88 });
  console.log('shot', shot.name);
}

await browser.close();
console.log('errors:', errors.length);
for (const e of errors.slice(0, 8)) console.log('  ', e);
