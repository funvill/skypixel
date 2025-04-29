#!/usr/bin/env bash

## Script to capture a frame from a live-streaming YouTube video.
## 
## 1. Install the prerequisites
##    sudo apt install ffmpeg yt-dlp

# ─────────────────────────────────────────────────
# Resolve the script’s directory (handles symlinks too)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# ─────────────────────────────────────────────────


# Usage check
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 YOUR_STREAM_ID"
  exit 1
fi

STREAM_ID="$1"
OUTPUT_DIR="${SCRIPT_DIR}/${STREAM_ID}"

# 1. Create the output folder if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# 2. (Re)fetch the live-stream URL
STREAM_URL=$(yt-dlp -g "https://www.youtube.com/watch?v=${STREAM_ID}")

# 3. Build a timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M")

# 4. Capture one frame (skip first 5 sec to prime buffer)
ffmpeg -y \
  -ss 00:00:05 \
  -i "$STREAM_URL" \
  -frames:v 1 \
  "${OUTPUT_DIR}/${STREAM_ID}-${TIMESTAMP}.png"
