/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = process.cwd();
const eslintBin = path.join(projectRoot, 'node_modules', '.bin', 'eslint');

const configFiles = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml'
];

const hasConfig = configFiles.some((file) => fs.existsSync(path.join(projectRoot, file)));

if (!fs.existsSync(eslintBin)) {
  console.log('[lint:ci] eslint is not installed. Skipping lint.');
  process.exit(0);
}

if (!hasConfig) {
  console.log('[lint:ci] No ESLint config found. Skipping lint.');
  process.exit(0);
}

const candidateDirs = ['src', 'app', 'components', 'lib'];
const targets = candidateDirs.filter((dir) => fs.existsSync(path.join(projectRoot, dir)));

if (targets.length === 0) {
  console.log('[lint:ci] No lint targets found.');
  process.exit(0);
}

const result = spawnSync(eslintBin, targets, { stdio: 'inherit' });
process.exit(result.status ?? 0);
