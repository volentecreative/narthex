#!/usr/bin/env node
/* Concatenate src/core.js + each module into dist/. No transpiling, no
 * minifying: jsDelivr minifies on request (append .min.js to any path), and the
 * source stays readable in the browser's Sources panel where people debug it. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const core = readFileSync(join(root, 'src/core.js'), 'utf8').replace('__VERSION__', pkg.version);

// Order matters only for the bundle: modules are independent, but modal and
// nav share the scroll lock, so nav registering first is a nice-to-have.
const ORDER = ['modal', 'accordion', 'nav', 'scroll', 'utils', 'fslist', 'livestream', 'shadow-css'];
const files = readdirSync(join(root, 'src/modules')).filter((f) => f.endsWith('.js')).map((f) => basename(f, '.js'));
const modules = [...ORDER.filter((m) => files.includes(m)), ...files.filter((m) => !ORDER.includes(m))];

const banner = (what) =>
  `/*! narthex v${pkg.version} — ${what} — ${pkg.homepage}\n * Attribute-driven utilities for Webflow. MIT. */\n`;

mkdirSync(join(root, 'dist'), { recursive: true });
const built = [];
for (const m of modules) {
  const src = readFileSync(join(root, `src/modules/${m}.js`), 'utf8');
  writeFileSync(join(root, `dist/${m}.js`), banner(m) + core + '\n' + src);
  built.push(`dist/${m}.js`);
}
const all = modules.map((m) => readFileSync(join(root, `src/modules/${m}.js`), 'utf8')).join('\n');
writeFileSync(join(root, 'dist/narthex.js'), banner('all modules') + core + '\n' + all);
built.push('dist/narthex.js');
writeFileSync(join(root, 'dist/modules.json'), JSON.stringify({ version: pkg.version, modules }, null, 2) + '\n');
console.log(`built ${built.length} files for v${pkg.version}: ${modules.join(', ')}`);
