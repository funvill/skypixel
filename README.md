# Skypixels

Skypixels is a long-running webcam art and data project that samples the sky every 5 minutes, extracts the sky region from each frame, calculates its average color, and turns that color history into printable SVG compositions.

After a full year of collection, this repository now holds a year-scale archive of sky color data from many public webcams. The immediate goal is to use that archive to explore poster-sized visualizations and physical print outcomes.

Project write-up: https://blog.abluestar.com/projects/2025-skypixles/

Preview: https://htmlpreview.github.io/?https://github.com/funvill/skypixel/blob/main/index.html

## What This Project Does

At a high level, each camera follows the same pipeline:

1. Capture a frame from a public webcam or live stream every 5 minutes.
2. Crop the portion of the image that contains sky.
3. Compute the average RGB color of that cropped sky image.
4. Store those color samples as a time series.
5. Render SVG outputs that can scale cleanly for large-format prints.

The result is a color timeline of the sky: weather, daylight, cloud cover, haze, and seasonal change reduced into a dense visual record.

## Why SVG

The visual outputs are generated as SVG so they can be enlarged for poster or canvas printing without losing resolution. That matters for this project because the final work is intended to move beyond screen previews into physical, large-scale prints and painted interpretations.

## Repository Structure

```text
.
|- readme.md
|- index.html                # lightweight browser preview of generated outputs
|- runme.sh                  # captures frames from configured webcams and streams
|- capture_frame.sh          # captures a single frame from a YouTube live stream
|- imageProcessor/
|  |- package.json
|  |- src/
|     |- processExtract.ts   # crops the sky region from each raw image
|     |- processAnalyze.ts   # computes average sky color for each cropped image
|     |- dayChart.ts         # time-grid SVG output
|     |- svgOutput.ts        # generic row-based SVG output
|     |- evenSpiral.ts       # evenly spaced Archimedean spiral layout
|     |- vogelSpiral.ts      # Vogel spiral layout
|- images/
	 |- camera-folder/
			|- settings.json       # crop settings, title, source link, description
			|- sky_*.jpg           # extracted sky images
			|- output.json         # average color data over time
			|- dayChart.svg
			|- output.svg
			|- evenSpiral.svg
			|- VogelSpiral.svg
```

## Data Model Per Camera

Each camera or stream has its own folder under `images/`.

Typical contents:

- `settings.json`: manual crop coordinates plus metadata such as title, description, and source URL.
- `sky_YYYYMMDD_HHMM.jpg`: cropped sky image generated from the raw frame.
- `output.json`: array of analyzed records. Each record stores the cropped filename and the average color, for example:

```json
{
	"file": "sky_20250502_1635.jpg",
	"average": { "r": 140, "g": 147, "b": 147 }
}
```

- `dayChart.svg`, `output.svg`, `evenSpiral.svg`, `VogelSpiral.svg`: generated visualizations of the collected color data.

## Capture Sources

This project pulls from a mix of:

- direct image URLs from road, airport, and weather webcams
- NAV CANADA weather cameras
- YouTube live streams where the frame includes a useful portion of sky

Many of the original stream selections came from manually searching for live webcams with a stable sky view, especially in Canada, then testing whether the framing was visually useful for long-term collection.

## Processing Pipeline

### 1. Capture

The root `runme.sh` script downloads current frames from a list of public webcam endpoints and YouTube live streams. YouTube capture is handled by `capture_frame.sh`, which uses `yt-dlp` and `ffmpeg` to resolve the live stream and save a single timestamped frame.

Raw frames are saved into the appropriate camera folder under `images/`.

### 2. Extract

`imageProcessor/src/processExtract.ts` reads `settings.json` for each folder and crops the region defined by:

- `x`
- `y`
- `width`
- `height`

The cropped result is written as a `sky_` prefixed image. This reduces storage and preserves just the portion of the frame that matters for later analysis.

### 3. Analyze

`imageProcessor/src/processAnalyze.ts` loads each cropped sky image and computes the average color across all pixels. Those values are appended to `output.json` so the dataset becomes a time-indexed color history of that location.

### 4. Visualize

The processor generates several SVG layouts from `output.json`:

- `dayChart.svg`: one row per day with 288 samples across, making daily rhythm and seasonal daylight patterns easy to read.
- `output.svg`: a simple rectangular timeline using fixed-width rows.
- `evenSpiral.svg`: an evenly spaced Archimedean spiral made from color circles.
- `VogelSpiral.svg`: a denser sunflower-like spiral using Vogel spacing.

These outputs are intended both as analytical views and as candidates for large-format prints.

## Running The Processor

From `imageProcessor/`:

```bash
npm install
npm run extract
npm run analyze
npm run visuals
```

Or run the full batch:

```bash
npm start
```

This compiles the TypeScript and runs extract, analyze, and visualization generation against the `../images` archive.

## Viewing The Results

Open `index.html` in a browser. It loads each camera folder, reads `settings.json`, shows the title and source, and displays the `dayChart.svg` preview with links to the other SVG outputs.

## Current Status

This project has now accumulated roughly a full year of sky samples across multiple cameras. That changes the nature of the work: the repo is no longer only about data collection, but about deciding which visual forms best communicate a year of atmosphere, weather, place, and time.

The next step is to use this archive to evaluate which layouts are strongest for poster-sized prints and other physical presentation formats.

## Notes

- Crop regions are defined manually per camera.
- Some sources are more stable than others; outages and missing frames are part of the dataset.
- The visualizations intentionally preserve gaps, which can also reveal source reliability and capture interruptions.

## Good Webcam Sources

- https://metcam.navcanada.ca/hb/index.jsp?lang=e