// Syntax-check every built file and make sure the core guard + module
// registry are present. Cheap, runs anywhere, no browser.
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const files = readdirSync('dist').filter((f) => f.endsWith('.js'));
if (!files.length) { console.error('dist/ is empty — run npm run build'); process.exit(1); }
for (const f of files) {
  execFileSync(process.execPath, ['--check', `dist/${f}`], { stdio: 'inherit' });
  const src = readFileSync(`dist/${f}`, 'utf8');
  if (!src.includes('vci.__core')) throw new Error(`${f}: core missing`);
  if (!src.includes("vci.define(")) throw new Error(`${f}: no module defined`);
}
console.log(`checked ${files.length} dist files`);
