#!/usr/bin/env node
/**
 * Verify that requirements matrix covers all P0 items from source document
 * Uses original line number set comparison, not just count
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'PC端AI_Todo开发任务清单.md');
const matrixFile = path.join(rootDir, 'docs', 'acceptance', 'requirements-matrix.md');

try {
  // Read files
  const sourceContent = fs.readFileSync(sourceFile, 'utf8');
  const matrixContent = fs.readFileSync(matrixFile, 'utf8');

  // Extract P0 line numbers from source
  const sourceLines = sourceContent.split('\n');
  const sourceP0Lines = new Set();
  for (let i = 0; i < sourceLines.length; i++) {
    if (sourceLines[i].includes('[P0]')) {
      sourceP0Lines.add(i + 1); // 1-based line numbers
    }
  }

  // Extract original line numbers from matrix
  // Matrix format: | ID | 原文行号 | 需求 | ...
  const matrixP0Lines = new Map(); // line -> count of occurrences
  const matrixLines = matrixContent.split('\n');
  for (const line of matrixLines) {
    if (line.includes('| P0 |')) {
      // Extract line number from format | ID | 123 | ...
      const match = line.match(/\|\s*(\d+)\s*\|/)
      if (match) {
        const lineNum = parseInt(match[1], 10)
        matrixP0Lines.set(lineNum, (matrixP0Lines.get(lineNum) || 0) + 1)
      }
    }
  }

  // Find missing, extra, and duplicate
  const missingLines = []
  for (const line of sourceP0Lines) {
    if (!matrixP0Lines.has(line)) {
      missingLines.push(line)
    }
  }

  const extraLines = []
  for (const line of matrixP0Lines.keys()) {
    if (!sourceP0Lines.has(line)) {
      extraLines.push(line)
    }
  }

  const duplicateLines = []
  for (const [line, count] of matrixP0Lines.entries()) {
    if (count > 1) {
      duplicateLines.push(line)
    }
  }

  // Output results
  console.log('=== Matrix Coverage Verification ===')
  console.log(`Source P0 count: ${sourceP0Lines.size}`)
  console.log(`Matrix unique P0 count: ${matrixP0Lines.size}`)
  console.log('')

  let hasError = false

  if (missingLines.length > 0) {
    console.log(`FAIL: ${missingLines.length} source P0 items missing from matrix:`)
    console.log(`  Missing line numbers: ${missingLines.sort((a, b) => a - b).join(', ')}`)
    hasError = true
  }

  if (extraLines.length > 0) {
    console.log(`FAIL: ${extraLines.length} matrix items not in source:`)
    console.log(`  Extra line numbers: ${extraLines.sort((a, b) => a - b).join(', ')}`)
    hasError = true
  }

  if (duplicateLines.length > 0) {
    console.log(`FAIL: ${duplicateLines.length} duplicate matrix entries:`)
    console.log(`  Duplicate line numbers: ${duplicateLines.sort((a, b) => a - b).join(', ')}`)
    hasError = true
  }

  if (hasError) {
    process.exit(1)
  }

  console.log('PASS: Matrix covers all P0 items correctly')
  process.exit(0)
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exit(1)
}
