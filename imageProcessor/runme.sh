#!/usr/bin/env bash

# ─────────────────────────────────────────────────
# Resolve the script’s directory (handles symlinks too)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# ─────────────────────────────────────────────────

cd "${SCRIPT_DIR}"
npm run s
