#!/bin/bash
# Verify that requirements matrix covers all P0 items from source document

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

SOURCE_FILE="$ROOT_DIR/PC端AI_Todo开发任务清单.md"
MATRIX_FILE="$ROOT_DIR/docs/acceptance/requirements-matrix.md"

if [ ! -f "$SOURCE_FILE" ]; then
    echo "ERROR: Source file not found: $SOURCE_FILE"
    exit 1
fi

if [ ! -f "$MATRIX_FILE" ]; then
    echo "ERROR: Matrix file not found: $MATRIX_FILE"
    exit 1
fi

# Count P0 items in source
SOURCE_COUNT=$(grep -c '\[P0\]' "$SOURCE_FILE" || true)

# Count P0 rows in matrix (lines with | P0 | pattern)
MATRIX_COUNT=$(grep -c '| P0 |' "$MATRIX_FILE" || true)

echo "=== Matrix Coverage Verification ==="
echo "Source P0 count: $SOURCE_COUNT"
echo "Matrix P0 count: $MATRIX_COUNT"
echo ""

if [ "$SOURCE_COUNT" -ne "$MATRIX_COUNT" ]; then
    echo "FAIL: Matrix coverage mismatch!"
    echo "Expected: $SOURCE_COUNT"
    echo "Actual: $MATRIX_COUNT"
    echo "Difference: $((SOURCE_COUNT - MATRIX_COUNT))"

    # Find missing line numbers
    echo ""
    echo "Source P0 line numbers:"
    grep -n '\[P0\]' "$SOURCE_FILE" | cut -d: -f1 | tr '\n' ' '
    echo ""
    exit 1
fi

echo "PASS: Matrix covers all $SOURCE_COUNT P0 items"
exit 0
