#!/usr/bin/env node
/**
 * EZTODO API Quality Gate
 * Uses project venv, fails if not available
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'services', 'api');

// Determine Python path based on platform
const isWin = process.platform === 'win32';
const venvPython = isWin
  ? path.join(apiDir, 'venv', 'Scripts', 'python.exe')
  : path.join(apiDir, 'venv', 'bin', 'python');

console.log('=== API Quality Gate ===');

// Check if venv exists
if (!fs.existsSync(venvPython)) {
  console.error(`FAIL: Virtual environment not found at ${venvPython}`);
  console.error('Please run: cd services/api && python -m venv venv && venv/bin/pip install -r requirements.txt');
  process.exit(1);
}

// Check if pytest is installed
console.log('[1/2] Checking pytest availability...');
try {
  execSync(`"${venvPython}" -c "import pytest"`, { stdio: 'pipe' });
  console.log('[✓] pytest available');
} catch (e) {
  console.error('FAIL: pytest not installed in virtual environment');
  console.error('Please run: services/api/venv/bin/pip install -r requirements.txt');
  process.exit(1);
}

// Run tests
console.log('\n[2/2] Running pytest...');
try {
  execSync(`"${venvPython}" -m pytest tests/ -v`, {
    cwd: apiDir,
    stdio: 'inherit',
  });
  console.log('\n[✓] API quality gate passed');
} catch (e) {
  console.error('\nFAIL: pytest failed');
  process.exit(1);
}
