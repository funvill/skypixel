# Fake Sky Data Generator

Generate a synthetic sky-color time series for any location using Open-Meteo archive weather data.

The CLI writes one RGB sample every five minutes for a full year. It does not rely on camera images.

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Generate A Project

```bash
node dist/index.js generate \
  --title "Whistler" \
  --latitude 50.1187095 \
  --longitude -122.9545036 \
  --timezone "America/Vancouver" \
  --year 2025
```

Outputs are written to `fakedata/output/<location-slug>/<year>/`.

Each project folder now contains a `settings.json`. The generator loads that file, merges it with the built-in defaults, and uses the merged settings for generation. This means you can tune a single project by editing its `settings.json` and rerunning the commands.

## Render Day Grid

```bash
node dist/index.js svg \
  --input output/whistler/2025/sky-color-data.json
```

The renderer writes both:

- `day-grid.svg`
- `day-grid.png`

The command loads render defaults from the `settings.json` in the same folder as the input JSON. You can still pass `--boxSize` to override the configured box size for a single run.

## Render Spiral SVG

```bash
node dist/index.js spiral \
  --input output/whistler/2025/sky-color-data.json
```

The spiral renderer loads its default pattern and layout settings from the project `settings.json`. You can still pass `--pattern even` or `--pattern vogel` to override the project default for one run.

## Validate Day Grid

```bash
node dist/index.js validate-grid \
  --fake output/whistler/2025/day-grid.svg \
  --real ../images/IEhDUXECe_k/dayChart.svg
```

The validator compares the fake day-grid SVG to the real day-grid SVG, writes a JSON report next to the fake SVG, and includes pass/fail checks plus recommendations.

## Where Settings Live

Project settings live in:

```text
fakedata/output/<location-slug>/<year>/settings.json
```

Legacy flat settings files are upgraded automatically when loaded.

## Settings Reference

### `location`

| Setting | Possible values | Default |
| --- | --- | --- |
| `location.title` | Any string | `Location` |
| `location.latitude` | `-90` to `90` | `0` |
| `location.longitude` | `-180` to `180` | `0` |
| `location.timezone` | Any valid IANA timezone | `UTC` |
| `location.year` | Integer year | `2025` |

### `generator.weather`

| Setting | Possible values | Default |
| --- | --- | --- |
| `generator.weather.cachePolicy` | `prefer-cache`, `refresh` | `prefer-cache` |
| `generator.weather.apiBaseUrl` | Any Open-Meteo archive endpoint | `https://archive-api.open-meteo.com/v1/archive` |
| `generator.weather.transitionMinutes` | Positive number of minutes | `20` |
| `generator.weather.visibilityFallbackMeters` | Positive number of meters | `16000` |

### `generator.palette`

Each palette setting is an RGB object with `r`, `g`, and `b` values from `0` to `255`.

| Setting | Possible values | Default |
| --- | --- | --- |
| `generator.palette.preDawn` | RGB object | `{18, 28, 48}` |
| `generator.palette.dawnGray` | RGB object | `{88, 100, 128}` |
| `generator.palette.sunriseWarm` | RGB object | `{228, 176, 122}` |
| `generator.palette.dayBlue` | RGB object | `{126, 184, 236}` |
| `generator.palette.dusk` | RGB object | `{214, 156, 120}` |
| `generator.palette.twilightGray` | RGB object | `{104, 110, 130}` |
| `generator.palette.night` | RGB object | `{12, 20, 36}` |

### `generator.lighting`

These are scalar multipliers. `1` means current default behavior.

| Setting | Possible values | Default |
| --- | --- | --- |
| `generator.lighting.radiationStrength` | `0` and higher | `1` |
| `generator.lighting.cloudDarkeningStrength` | `0` and higher | `1` |
| `generator.lighting.moistureDarkeningStrength` | `0` and higher | `1` |
| `generator.lighting.exposureStrength` | `0` and higher | `1` |
| `generator.lighting.summerDayCoreFlatteningStrength` | `0` and higher | `1` |
| `generator.lighting.rendererDayCoreDarkeningStrength` | `0` and higher | `1` |
| `generator.lighting.seasonalSaturationBase` | Positive number | `0.98` |
| `generator.lighting.seasonalSaturationAmplitude` | `0` and higher | `0.03` |

### `generator.transition`

These settings control dawn and dusk behavior, including jitter, warmth, cool blue transitions, and cloud-bank effects.

| Setting | Possible values | Default |
| --- | --- | --- |
| `generator.transition.dawnDuskJitterStrength` | `0` and higher | `1` |
| `generator.transition.warmthStrength` | `0` and higher | `1` |
| `generator.transition.coolStrength` | `0` and higher | `1` |
| `generator.transition.featherStrength` | `0` and higher | `1` |
| `generator.transition.occlusionStrength` | `0` and higher | `1` |
| `generator.transition.ambientStrength` | `0` and higher | `1` |

### `generator.camera`

These settings control the camera-style balance and low-light response.

| Setting | Possible values | Default |
| --- | --- | --- |
| `generator.camera.dayCoolStrength` | `0` and higher | `1` |
| `generator.camera.twilightCoolStrength` | `0` and higher | `1` |
| `generator.camera.grayCloudStrength` | `0` and higher | `1` |
| `generator.camera.lowLightJitterStrength` | `0` and higher | `1` |

### `generator.moon`

These settings control moonlit nights and lunar flare behavior.

| Setting | Possible values | Default |
| --- | --- | --- |
| `generator.moon.brightness` | `0` and higher | `1` |
| `generator.moon.blueBoost` | `0` and higher | `1` |
| `generator.moon.flareStrength` | `0` and higher | `1` |

### `generator.noise`

These settings control the final frame-to-frame jitter and night jitter scaling.

| Setting | Possible values | Default |
| --- | --- | --- |
| `generator.noise.daylightJitterStrength` | `0` and higher | `1` |
| `generator.noise.nightJitterMultiplier` | `0` and higher | `0.18` |

### `generator.confidence`

| Setting | Possible values | Default |
| --- | --- | --- |
| `generator.confidence.min` | `0` to `1` | `0.45` |
| `generator.confidence.max` | `0` to `1` | `0.95` |

### `render.dayGrid`

These settings control the day-grid renderer, borders, glow colors, afterglow, PNG export, and layout spacing.

| Setting | Possible values | Default |
| --- | --- | --- |
| `render.dayGrid.boxSize` | Positive integer or float | `4` |
| `render.dayGrid.exportPng` | `true`, `false` | `true` |
| `render.dayGrid.leftMarginScale` | Positive number | `10` |
| `render.dayGrid.topMarginScale` | Positive number | `5` |
| `render.dayGrid.mirrorLegendBorder` | `true`, `false` | `true` |
| `render.dayGrid.edgeShiftEarlyColumns` | Integer columns | `-1` |
| `render.dayGrid.edgeShiftLateColumns` | Integer columns | `2` |
| `render.dayGrid.edgeJitterStrength` | `0` and higher | `1` |
| `render.dayGrid.sunriseGlowIntensity` | `0` and higher | `1` |
| `render.dayGrid.sunsetGlowIntensity` | `0` and higher | `1` |
| `render.dayGrid.sunriseGlowColor` | RGB object | `{236, 178, 114}` |
| `render.dayGrid.sunsetGlowColor` | RGB object | `{244, 166, 96}` |
| `render.dayGrid.sunriseGlowHighlightColor` | RGB object | `{246, 224, 204}` |
| `render.dayGrid.sunsetGlowHighlightColor` | RGB object | `{252, 230, 208}` |
| `render.dayGrid.sunriseGrayColor` | RGB object | `{108, 114, 128}` |
| `render.dayGrid.sunsetGrayColor` | RGB object | `{84, 96, 118}` |
| `render.dayGrid.sunsetGrayAmount` | `0` and higher | `1` |
| `render.dayGrid.sunsetGrayBlueStrength` | `0` and higher | `1` |
| `render.dayGrid.sunsetAfterglowIntensity` | `0` and higher | `2.35` |
| `render.dayGrid.sunsetAfterglowCenterColumns` | Positive number of 5-minute cells | `4.5` |
| `render.dayGrid.sunsetAfterglowReachColumns` | Positive number of 5-minute cells | `4.5` |
| `render.dayGrid.sunsetAfterglowColor` | RGB object | `{92, 110, 146}` |

### `render.spiral`

| Setting | Possible values | Default |
| --- | --- | --- |
| `render.spiral.defaultPattern` | `even`, `vogel` | `even` |
| `render.spiral.even.circleRadius` | Positive number | `5` |
| `render.spiral.even.strokeWidth` | `0` and higher | `1` |
| `render.spiral.even.strokeColor` | Any SVG color string | `#ccc` |
| `render.spiral.even.backgroundColor` | Any SVG color string | `black` |
| `render.spiral.even.b` | Positive number | `2` |
| `render.spiral.even.maxThetaStep` | Positive number | `1` |
| `render.spiral.even.chord` | Positive number | `10` |
| `render.spiral.vogel.circleRadius` | Positive number | `5` |
| `render.spiral.vogel.strokeWidth` | `0` and higher | `1` |
| `render.spiral.vogel.strokeColor` | Any SVG color string | `#ccc` |
| `render.spiral.vogel.backgroundColor` | Any SVG color string | `black` |
| `render.spiral.vogel.spacingFactor` | Positive number | `0.9` |
| `render.spiral.vogel.goldenAngle` | Positive number in radians | `2.399963229728653` |

## Example `settings.json`

This example matches the built-in default values.

```json
{
  "location": {
    "title": "Whistler",
    "latitude": 50.1187095,
    "longitude": -122.9545036,
    "timezone": "America/Vancouver",
    "year": 2025
  },
  "generator": {
    "weather": {
      "cachePolicy": "prefer-cache",
      "apiBaseUrl": "https://archive-api.open-meteo.com/v1/archive",
      "transitionMinutes": 20,
      "visibilityFallbackMeters": 16000
    },
    "palette": {
      "preDawn": { "r": 18, "g": 28, "b": 48 },
      "dawnGray": { "r": 88, "g": 100, "b": 128 },
      "sunriseWarm": { "r": 228, "g": 176, "b": 122 },
      "dayBlue": { "r": 126, "g": 184, "b": 236 },
      "dusk": { "r": 214, "g": 156, "b": 120 },
      "twilightGray": { "r": 104, "g": 110, "b": 130 },
      "night": { "r": 12, "g": 20, "b": 36 }
    },
    "lighting": {
      "radiationStrength": 1,
      "cloudDarkeningStrength": 1,
      "moistureDarkeningStrength": 1,
      "exposureStrength": 1,
      "summerDayCoreFlatteningStrength": 1,
      "rendererDayCoreDarkeningStrength": 1,
      "seasonalSaturationBase": 0.98,
      "seasonalSaturationAmplitude": 0.03
    },
    "transition": {
      "dawnDuskJitterStrength": 1,
      "warmthStrength": 1,
      "coolStrength": 1,
      "featherStrength": 1,
      "occlusionStrength": 1,
      "ambientStrength": 1
    },
    "camera": {
      "dayCoolStrength": 1,
      "twilightCoolStrength": 1,
      "grayCloudStrength": 1,
      "lowLightJitterStrength": 1
    },
    "moon": {
      "brightness": 1,
      "blueBoost": 1,
      "flareStrength": 1
    },
    "noise": {
      "daylightJitterStrength": 1,
      "nightJitterMultiplier": 0.18
    },
    "confidence": {
      "min": 0.45,
      "max": 0.95
    }
  },
  "render": {
    "dayGrid": {
      "boxSize": 4,
      "exportPng": true,
      "leftMarginScale": 10,
      "topMarginScale": 5,
      "mirrorLegendBorder": true,
      "edgeShiftEarlyColumns": -1,
      "edgeShiftLateColumns": 2,
      "edgeJitterStrength": 1,
      "sunriseGlowIntensity": 1,
      "sunsetGlowIntensity": 1,
      "sunriseGlowColor": { "r": 236, "g": 178, "b": 114 },
      "sunsetGlowColor": { "r": 244, "g": 166, "b": 96 },
      "sunriseGlowHighlightColor": { "r": 246, "g": 224, "b": 204 },
      "sunsetGlowHighlightColor": { "r": 252, "g": 230, "b": 208 },
      "sunriseGrayColor": { "r": 108, "g": 114, "b": 128 },
      "sunsetGrayColor": { "r": 84, "g": 96, "b": 118 },
      "sunsetGrayAmount": 1,
      "sunsetGrayBlueStrength": 1,
      "sunsetAfterglowIntensity": 2.35,
      "sunsetAfterglowCenterColumns": 4.5,
      "sunsetAfterglowReachColumns": 4.5,
      "sunsetAfterglowColor": { "r": 92, "g": 110, "b": 146 }
    },
    "spiral": {
      "defaultPattern": "even",
      "even": {
        "circleRadius": 5,
        "strokeWidth": 1,
        "strokeColor": "#ccc",
        "backgroundColor": "black",
        "b": 2,
        "maxThetaStep": 1,
        "chord": 10
      },
      "vogel": {
        "circleRadius": 5,
        "strokeWidth": 1,
        "strokeColor": "#ccc",
        "backgroundColor": "black",
        "spacingFactor": 0.9,
        "goldenAngle": 2.399963229728653
      }
    }
  }
}
```
