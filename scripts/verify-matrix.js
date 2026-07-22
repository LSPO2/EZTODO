#!/usr/bin/env node
/**
 * Verify that requirements matrix covers all P0 items from source document
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'PC端AI_Todo开发任务清单.md');
const matrixFile = path.join(rootDir, 'docs', 'acceptance', 'requirements-matrix.md');

function countPattern(content, pattern) {
  const regex = new RegExp(pattern, 'g');
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

try {
  const sourceContent = fs.readFileSync(sourceFile, 'utf8');
  const matrixContent = fs.readFileSync(matrixFile, 'utf8');

  const sourceCount = countPattern(sourceContent, '\\[P0\\]');
  const matrixCount = countPattern(matrixContent, '\\| P0 \\|');

  console.log('=== Matrix Coverage Verification ===');
  console.log(`Source P0 count: ${sourceCount}`);
  console.log(`Matrix P0 count: ${matrixCount}`);
  console.log('');

  if (sourceCount !== matrixCount) {
    console.log('FAIL: Matrix coverage mismatch!');
    console.log(`Expected: ${sourceCount}`);
    console.log(`Actual: ${matrixCount}`);
    console.log(`Difference: ${sourceCount - matrixCount}`);
    process.exit(1);
  }

  console.log(`PASS: Matrix covers all ${sourceCount} P0 items`);
  process.exit(0);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
