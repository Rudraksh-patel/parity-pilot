/**
 * Script to create a zip file of the project
 * Run with: node scripts/create-zip.js
 * 
 * Excludes: node_modules, dist, coverage, .git
 */

import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const outputPath = join(projectRoot, 'parity-pilot.zip');

// Files/directories to exclude
const excludes = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  'parity-pilot.zip',
  '.DS_Store',
  '*.log',
]);

function shouldExclude(path) {
  const parts = path.split(/[/\\]/);
  return parts.some(part => excludes.has(part));
}

async function createZip() {
  console.log('Creating parity-pilot.zip...');
  
  const output = createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`✓ Created ${outputPath} (${sizeInMB} MB)`);
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);

  // Add files
  archive.glob('**/*', {
    cwd: projectRoot,
    ignore: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.git/**',
      '*.zip',
      '*.log',
      '.DS_Store',
    ],
    dot: true, // Include dotfiles like .gitignore
  });

  await archive.finalize();
}

createZip().catch(err => {
  console.error('Failed to create zip:', err);
  process.exit(1);
});
