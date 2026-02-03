/**
 * Production build script for web-app
 * Compiles Tailwind CSS and copies all source files to dist/
 * Usage: node scripts/build.js
 */
import { execSync } from 'child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

// Directories and files to copy to dist/
const COPY_ITEMS = [
  'index.html',
  'css',
  'js',
  'data',
  'assets',
  'lib',
  'service-worker.js',
  'manifest.webmanifest',
];

console.log('[build] Cleaning dist/...');
if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true });
}
mkdirSync(DIST, { recursive: true });

console.log('[build] Copying source files to dist/...');
for (const item of COPY_ITEMS) {
  const src = resolve(ROOT, item);
  const dest = resolve(DIST, item);
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
    console.log(`  ✓ ${item}`);
  } else {
    console.warn(`  ⚠ ${item} not found, skipping`);
  }
}

console.log('[build] Compiling Tailwind CSS...');
execSync(
  `npx tailwindcss -i "${resolve(DIST, 'css/tailwind.css')}" -o "${resolve(DIST, 'css/tailwind.css')}" --minify`,
  { cwd: ROOT, stdio: 'inherit' }
);

console.log('[build] Done! Output in dist/');
