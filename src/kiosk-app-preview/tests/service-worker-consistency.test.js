/**
 * Service Worker Consistency Test
 *
 * Verifies that:
 * 1. All files referenced in service-worker.js exist in the filesystem
 * 2. All JS and JSON files in the kiosk-app are included in the service worker cache
 *
 * Run with: node src/kiosk-app/tests/service-worker-consistency.test.js
 */

const fs = require('fs');
const path = require('path');

const KIOSK_ROOT = path.join(__dirname, '..');
const SW_PATH = path.join(KIOSK_ROOT, 'service-worker.js');

// Files that should be cached but might be intentionally excluded
const EXCLUDED_FILES = [
  'service-worker.js',  // SW doesn't cache itself
  'qr-generator.html',  // Dev tool, not needed offline
];

// Directories to scan for cacheable files
const SCAN_DIRS = [
  { dir: 'js', extensions: ['.js'] },
  { dir: 'js/views', extensions: ['.js'] },
  { dir: 'data', extensions: ['.json'] },
  { dir: 'css', extensions: ['.css'] },
  { dir: 'assets', extensions: ['.svg', '.jpg', '.png', '.mp3'] },
];

function extractUrlsFromServiceWorker() {
  const swContent = fs.readFileSync(SW_PATH, 'utf-8');

  // Extract urlsToCache array
  const match = swContent.match(/const urlsToCache\s*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('Could not find urlsToCache array in service-worker.js');
  }

  // Parse URLs from the array
  const urlsBlock = match[1];
  const urls = [];
  const urlRegex = /['"]([^'"]+)['"]/g;
  let urlMatch;

  while ((urlMatch = urlRegex.exec(urlsBlock)) !== null) {
    urls.push(urlMatch[1]);
  }

  return urls;
}

function getExistingFiles() {
  const files = [];

  for (const { dir, extensions } of SCAN_DIRS) {
    const fullDir = path.join(KIOSK_ROOT, dir);

    if (!fs.existsSync(fullDir)) {
      continue;
    }

    const entries = fs.readdirSync(fullDir);

    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (extensions.includes(ext)) {
        // Convert to URL format (forward slashes, relative path)
        const relativePath = `/${dir}/${entry}`.replace(/\\/g, '/');
        files.push(relativePath);
      }
    }
  }

  // Add root files
  if (fs.existsSync(path.join(KIOSK_ROOT, 'index.html'))) {
    files.push('/index.html');
  }

  return files;
}

function normalizeUrl(url) {
  // Remove leading slash for comparison, handle both / and /index.html as root
  if (url === '/') return '/index.html';
  return url;
}

function runTests() {
  console.log('Service Worker Consistency Tests\n');
  console.log('='.repeat(50));

  const errors = [];

  // Get URLs from service worker
  let swUrls;
  try {
    swUrls = extractUrlsFromServiceWorker();
    console.log(`\n Found ${swUrls.length} URLs in service-worker.js`);
  } catch (err) {
    console.error(`\n FATAL: ${err.message}`);
    process.exit(1);
  }

  // Get existing files
  const existingFiles = getExistingFiles();
  console.log(` Found ${existingFiles.length} cacheable files in filesystem\n`);

  // Normalize URLs for comparison
  const normalizedSwUrls = new Set(swUrls.map(normalizeUrl));

  // Test 1: All SW URLs should exist in filesystem
  console.log('Test 1: Checking if all SW URLs exist in filesystem...');
  for (const url of swUrls) {
    if (url === '/') continue; // Root is special case

    const filePath = path.join(KIOSK_ROOT, url);
    if (!fs.existsSync(filePath)) {
      errors.push(`  MISSING FILE: ${url} (referenced in SW but doesn't exist)`);
    }
  }

  if (errors.length === 0) {
    console.log('  All SW URLs point to existing files\n');
  } else {
    console.log('  FAILURES:');
    errors.forEach(e => console.log(e));
    console.log('');
  }

  // Test 2: All existing files should be in SW cache
  console.log('Test 2: Checking if all existing files are cached in SW...');
  const missingFromSw = [];

  for (const file of existingFiles) {
    const normalized = normalizeUrl(file);
    const basename = path.basename(file);

    if (EXCLUDED_FILES.includes(basename)) {
      continue;
    }

    if (!normalizedSwUrls.has(normalized) && !normalizedSwUrls.has(file)) {
      missingFromSw.push(file);
    }
  }

  if (missingFromSw.length === 0) {
    console.log('  All files are included in SW cache\n');
  } else {
    console.log('  MISSING FROM CACHE:');
    missingFromSw.forEach(f => {
      errors.push(`  NOT CACHED: ${f} (exists but not in service-worker.js)`);
      console.log(`    ${f}`);
    });
    console.log('');
  }

  // Summary
  console.log('='.repeat(50));
  if (errors.length === 0) {
    console.log('\n ALL TESTS PASSED\n');
    process.exit(0);
  } else {
    console.log(`\n TESTS FAILED: ${errors.length} error(s)\n`);
    errors.forEach(e => console.log(e));
    console.log('');
    process.exit(1);
  }
}

runTests();
