import crypto from 'crypto';
import path from 'path';

import { SvgConfig } from './types';
import { buildSvgTitle, escapeXml, loadGeneratedRecords, recordDateKey } from './svgData';

const COLUMNS = 288;
const EXPECTED_ROWS = 365;
const HOUR_COLUMNS = 12;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function luminance(color: { r: number; g: number; b: number }): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function deterministicNoise(seed: string): number {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const value = hash.readUInt32BE(0) / 0xffffffff;
  return value * 2 - 1;
}

function mixChannel(left: number, right: number, amount: number): number {
  return left + (right - left) * amount;
}

function remap(value: number, inMin: number, inMax: number): number {
  if (inMax === inMin) {
    return 0;
  }

  return clamp((value - inMin) / (inMax - inMin), 0, 1);
}

function clampEdgeOffset(offsetColumns: number, earlyColumns: number, lateColumns: number): number {
  return clamp(offsetColumns, earlyColumns, lateColumns);
}

function detectRowEdges(entries: Array<{ average: { r: number; g: number; b: number } }>): { sunrise: number; sunset: number } {
  const values = entries.map(entry => luminance(entry.average));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const threshold = min + (max - min) * 0.2;
  const sunrise = values.findIndex(value => value >= threshold);
  const sunset = values.length - 1 - [...values].reverse().findIndex(value => value >= threshold);
  return {
    sunrise: sunrise >= 0 ? sunrise : 0,
    sunset: sunset >= 0 ? sunset : values.length - 1
  };
}

function adjustEdgeColor(
  settings: SvgConfig['settings'],
  dayKey: string,
  rowIndex: number,
  columnIndex: number,
  color: { r: number; g: number; b: number },
  sunriseEdge: number,
  sunsetEdge: number
): { r: number; g: number; b: number } {
  const dayGridSettings = settings.render.dayGrid;
  const daylightSpan = Math.max(1, sunsetEdge - sunriseEdge);
  const daylightProgress = remap(columnIndex, sunriseEdge, sunsetEdge);
  const summerWeight = clamp((daylightSpan - 145) / 80, 0, 1);
  const dayCoreWeight = clamp(1 - Math.abs(daylightProgress - 0.5) / 0.22, 0, 1)
    * summerWeight
    * settings.generator.lighting.rendererDayCoreDarkeningStrength;

  let adjusted = {
    r: mixChannel(color.r, color.r * 0.84, dayCoreWeight * 0.32),
    g: mixChannel(color.g, color.g * 0.86, dayCoreWeight * 0.28),
    b: mixChannel(color.b, color.b * 0.92 + 8, dayCoreWeight * 0.18)
  };

  const applyWarmGlow = (edge: 'sunrise' | 'sunset', edgeColumn: number, base: { r: number; g: number; b: number }) => {
    const side = edge === 'sunrise' ? 1 : -1;
    const isSunset = edge === 'sunset';
    const jitterStrength = dayGridSettings.edgeJitterStrength;
    const glowShift = Math.round(deterministicNoise(`${dayKey}:${edge}:glow-shift`) * 1.2 * jitterStrength);
    const rowShift = Math.round(deterministicNoise(`${dayKey}:${edge}:${Math.floor(rowIndex / 5)}:glow-row`) * 0.8 * jitterStrength);
    const edgeOffset = clampEdgeOffset(glowShift + rowShift, dayGridSettings.edgeShiftEarlyColumns, dayGridSettings.edgeShiftLateColumns);
    const effectiveEdge = edgeColumn + edgeOffset;
    const distance = (columnIndex - effectiveEdge) * side;
    const inwardReach = isSunset ? 7 : 6;
    const outwardReach = isSunset ? 2.5 : 2;
    if (distance < -outwardReach || distance > inwardReach) {
      return base;
    }

    const inwardWeight = distance >= 0
      ? clamp(1 - distance / inwardReach, 0, 1)
      : clamp(1 - Math.abs(distance) / outwardReach, 0, 1) * 0.45;
    const seasonalBoost = 0.5 + summerWeight * (isSunset ? 0.45 : 0.3);
    const shimmer = clamp(0.82 + deterministicNoise(`${dayKey}:${edge}:${rowIndex}:${Math.floor(columnIndex / 3)}:glow`) * 0.22, 0.45, 1.15);
    const texture = clamp(
      0.82
      + deterministicNoise(`${dayKey}:${edge}:${Math.floor(rowIndex / 3)}:${Math.floor(columnIndex / 2)}:texture-fine`) * 0.16
      + deterministicNoise(`${dayKey}:${edge}:${Math.floor(rowIndex / 7)}:${Math.floor(columnIndex / 6)}:texture-coarse`) * 0.12,
      0.55,
      1.18
    );
    const pearlescent = clamp(0.5 + inwardWeight * 0.4 + summerWeight * 0.15, 0, 1);
    const glowIntensity = edge === 'sunrise' ? dayGridSettings.sunriseGlowIntensity : dayGridSettings.sunsetGlowIntensity;
    const glowAmount = clamp(inwardWeight * seasonalBoost * shimmer * texture * glowIntensity, 0, 0.62);
    const warmTarget = edge === 'sunrise'
      ? dayGridSettings.sunriseGlowColor
      : dayGridSettings.sunsetGlowColor;
    const brightTarget = edge === 'sunrise'
      ? dayGridSettings.sunriseGlowHighlightColor
      : dayGridSettings.sunsetGlowHighlightColor;

    const warmed = {
      r: mixChannel(base.r, warmTarget.r, glowAmount),
      g: mixChannel(base.g, warmTarget.g, glowAmount * 0.92),
      b: mixChannel(base.b, warmTarget.b, glowAmount * 0.72)
    };

    const brightAmount = glowAmount * pearlescent * clamp(texture - 0.78, 0, 0.35);

    return {
      r: mixChannel(warmed.r, brightTarget.r, brightAmount),
      g: mixChannel(warmed.g, brightTarget.g, brightAmount * 0.95),
      b: mixChannel(warmed.b, brightTarget.b, brightAmount * 0.9)
    };
  };

  const applyEdge = (edge: 'sunrise' | 'sunset', edgeColumn: number, base: { r: number; g: number; b: number }) => {
    const side = edge === 'sunrise' ? 1 : -1;
    const isSunset = edge === 'sunset';
    const jitterStrength = dayGridSettings.edgeJitterStrength;
    const dayShift = Math.round(deterministicNoise(`${dayKey}:${edge}:shift-day`) * 1.4 * jitterStrength);
    const rowBlockShift = Math.round(deterministicNoise(`${dayKey}:${edge}:${Math.floor(rowIndex / 8)}:shift-row`) * 1.1 * jitterStrength);
    const rowShift = Math.round(deterministicNoise(`${dayKey}:${edge}:${rowIndex}:shift-fine`) * 0.8 * jitterStrength);
    const edgeOffset = clampEdgeOffset(dayShift + rowBlockShift + rowShift, dayGridSettings.edgeShiftEarlyColumns, dayGridSettings.edgeShiftLateColumns);
    const effectiveEdge = edgeColumn + edgeOffset;
    const distance = (columnIndex - effectiveEdge) * side;
    const nightReach = isSunset ? -8 : -10;
    const dayReach = isSunset ? 24 : 16;
    if (distance < nightReach || distance > dayReach) {
      return base;
    }

    const bandWeight = distance >= 0
      ? clamp(1 - distance / dayReach, 0, 1)
      : clamp(1 - Math.abs(distance) / Math.abs(nightReach), 0, 1);
    const bank = Math.max(0, deterministicNoise(`${dayKey}:${edge}:${Math.floor(columnIndex / 7)}:bank`));
    const front = Math.max(0, deterministicNoise(`${dayKey}:${edge}:${Math.floor(rowIndex / 4)}:${Math.floor(columnIndex / 10)}:front`));
    const notch = Math.max(0, deterministicNoise(`${dayKey}:${edge}:${Math.floor(columnIndex / 5)}:notch`));
    const shelf = Math.max(0, deterministicNoise(`${dayKey}:${edge}:${rowIndex}:${Math.floor(columnIndex / 14)}:shelf`));
    const occlusion = clamp((bank * 0.8 + front * 0.6 + notch * 0.4 + shelf * (isSunset ? 0.8 : 0.45)) * bandWeight, 0, 0.97);
    const grayTarget = edge === 'sunrise'
      ? dayGridSettings.sunriseGrayColor
      : {
        r: mixChannel(base.r, dayGridSettings.sunsetGrayColor.r, dayGridSettings.sunsetGrayBlueStrength),
        g: mixChannel(base.g, dayGridSettings.sunsetGrayColor.g, dayGridSettings.sunsetGrayBlueStrength),
        b: mixChannel(base.b, dayGridSettings.sunsetGrayColor.b, dayGridSettings.sunsetGrayBlueStrength)
      };
    const nightLift = { r: 24, g: 28, b: 38 };

    if (distance >= 0) {
      const grayAmount = isSunset
        ? clamp((occlusion * 0.98 + bandWeight * 0.18) * dayGridSettings.sunsetGrayAmount, 0, 1)
        : clamp(occlusion * 0.88 + bandWeight * 0.08, 0, 1);
      return {
        r: mixChannel(base.r, grayTarget.r, grayAmount),
        g: mixChannel(base.g, grayTarget.g, grayAmount),
        b: mixChannel(base.b, grayTarget.b, grayAmount)
      };
    }

    const nightAmount = isSunset
      ? bandWeight * 0.36 + occlusion * 0.24
      : bandWeight * 0.28 + occlusion * 0.2;
    const dimmed = {
      r: mixChannel(base.r, nightLift.r, nightAmount),
      g: mixChannel(base.g, nightLift.g, nightAmount),
      b: mixChannel(base.b, nightLift.b, nightAmount)
    };

    if (!isSunset) {
      return dimmed;
    }

    const afterglowCenter = dayGridSettings.sunsetAfterglowCenterColumns;
    const afterglowReach = dayGridSettings.sunsetAfterglowReachColumns;
    const afterglowWeight = clamp(1 - Math.abs(distance + afterglowCenter) / afterglowReach, 0, 1);
    const afterglowTexture = clamp(
      0.82
      + deterministicNoise(`${dayKey}:sunset:${Math.floor(rowIndex / 4)}:${Math.floor(columnIndex / 3)}:afterglow`) * 0.18,
      0.55,
      1.05
    );
    const afterglowAmount = clamp(
      afterglowWeight * (0.34 + summerWeight * 0.14) * afterglowTexture * dayGridSettings.sunsetAfterglowIntensity,
      0,
      0.52
    );
    const afterglowTarget = dayGridSettings.sunsetAfterglowColor;

    return {
      r: mixChannel(dimmed.r, afterglowTarget.r, afterglowAmount),
      g: mixChannel(dimmed.g, afterglowTarget.g, afterglowAmount * 0.95),
      b: mixChannel(dimmed.b, afterglowTarget.b, afterglowAmount)
    };
  };

  adjusted = applyWarmGlow('sunrise', sunriseEdge, adjusted);
  adjusted = applyWarmGlow('sunset', sunsetEdge, adjusted);
  adjusted = applyEdge('sunrise', sunriseEdge, adjusted);
  adjusted = applyEdge('sunset', sunsetEdge, adjusted);
  return {
    r: Math.round(clamp(adjusted.r, 0, 255)),
    g: Math.round(clamp(adjusted.g, 0, 255)),
    b: Math.round(clamp(adjusted.b, 0, 255))
  };
}

export async function renderSvgDayGrid(config: SvgConfig): Promise<string> {
  const boxSize = config.boxSize ?? config.settings.render.dayGrid.boxSize;
  if (boxSize <= 0 || !Number.isFinite(boxSize)) {
    throw new Error('boxSize must be a positive number.');
  }

  const { inputPath, records } = await loadGeneratedRecords(config.inputFile);
  const outputPath = path.resolve(config.outputFile ?? path.join(path.dirname(inputPath), 'day-grid.svg'));

  const days = new Map<string, typeof records>();
  for (const record of records) {
    const key = recordDateKey(record.timestamp);
    const day = days.get(key);
    if (day) day.push(record);
    else days.set(key, [record]);
  }

  const orderedDays = [...days.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  if (orderedDays.length !== EXPECTED_ROWS) {
    throw new Error(`Expected ${EXPECTED_ROWS} days but found ${orderedDays.length}.`);
  }

  for (const [day, entries] of orderedDays) {
    if (entries.length !== COLUMNS) {
      throw new Error(`Expected ${COLUMNS} entries for ${day} but found ${entries.length}.`);
    }

    entries.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  const gridWidth = COLUMNS * boxSize;
  const gridHeight = EXPECTED_ROWS * boxSize;
  const leftMargin = Math.max(44, Math.round(boxSize * config.settings.render.dayGrid.leftMarginScale));
  const topMargin = Math.max(22, Math.round(boxSize * config.settings.render.dayGrid.topMarginScale));
  const rightMargin = config.settings.render.dayGrid.mirrorLegendBorder ? leftMargin : 0;
  const bottomMargin = config.settings.render.dayGrid.mirrorLegendBorder ? topMargin : 0;
  const width = leftMargin + gridWidth + rightMargin;
  const height = topMargin + gridHeight + bottomMargin;
  const title = buildSvgTitle(inputPath, 'day grid');
  const monthMarks = orderedDays.flatMap(([day], rowIndex) => {
    const monthIndex = Number(day.slice(5, 7)) - 1;
    const previousMonth = rowIndex > 0 ? Number(orderedDays[rowIndex - 1][0].slice(5, 7)) - 1 : -1;
    if (monthIndex === previousMonth) {
      return [];
    }

    return [{ label: MONTH_LABELS[monthIndex], y: topMargin + rowIndex * boxSize + boxSize * 0.8 }];
  });
  const svg: string[] = [];
  svg.push('<?xml version="1.0" encoding="UTF-8"?>');
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title" shape-rendering="crispEdges">`);
  svg.push(`<title>${escapeXml(title)}</title>`);
  svg.push('<rect width="100%" height="100%" fill="white"/>');

  for (let hour = 0; hour < 24; hour++) {
    const x = leftMargin + hour * HOUR_COLUMNS * boxSize + HOUR_COLUMNS * boxSize * 0.5;
    svg.push(`<text x="${x}" y="${Math.round(topMargin * 0.72)}" font-family="Arial, sans-serif" font-size="${Math.max(9, Math.round(boxSize * 2.1))}" text-anchor="middle" fill="#444" shape-rendering="geometricPrecision">${hour}</text>`);
  }

  monthMarks.forEach(mark => {
    svg.push(`<text x="${leftMargin - Math.max(10, Math.round(boxSize * 1.5))}" y="${mark.y}" font-family="Arial, sans-serif" font-size="${Math.max(9, Math.round(boxSize * 2.1))}" text-anchor="end" fill="#444" shape-rendering="geometricPrecision">${mark.label}</text>`);
  });

  orderedDays.forEach(([dayKey, entries], rowIndex) => {
    const edges = detectRowEdges(entries);
    entries.forEach((record, columnIndex) => {
      const x = leftMargin + columnIndex * boxSize;
      const y = topMargin + rowIndex * boxSize;
      const adjusted = adjustEdgeColor(config.settings, dayKey, rowIndex, columnIndex, record.average, edges.sunrise, edges.sunset);
      const fill = `rgb(${adjusted.r},${adjusted.g},${adjusted.b})`;
      svg.push(`<rect x="${x}" y="${y}" width="${boxSize}" height="${boxSize}" fill="${fill}" stroke="none" shape-rendering="crispEdges"/>`);
    });
  });

  svg.push('</svg>');
  const fs = await import('fs/promises');
  const svgContent = `${svg.join('\n')}\n`;
  await fs.writeFile(outputPath, svgContent);

  const pngOutputPath = outputPath.replace(/\.svg$/i, '.png');
  if (config.settings.render.dayGrid.exportPng && pngOutputPath !== outputPath) {
    const sharp = (await import('sharp')).default;
    await sharp(Buffer.from(svgContent)).png().toFile(pngOutputPath);
    console.log(`Wrote PNG grid to ${pngOutputPath}`);
  }

  console.log(`Wrote SVG grid to ${outputPath}`);
  return outputPath;
}