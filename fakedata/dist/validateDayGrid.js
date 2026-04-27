"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadGridSvg = loadGridSvg;
exports.validateDayGrid = validateDayGrid;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function luminance(color) {
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}
function saturation(color) {
    return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
}
function yellowBias(color) {
    return (color.r + color.g) / 2 - color.b;
}
function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function percentile(values, ratio) {
    if (!values.length) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.round((sorted.length - 1) * clamp(ratio, 0, 1));
    return sorted[index];
}
function stddev(values) {
    if (values.length < 2) {
        return 0;
    }
    const mean = average(values);
    return Math.sqrt(average(values.map(value => (value - mean) ** 2)));
}
function parseAttributes(tag) {
    const attributes = {};
    const regex = /([a-zA-Z:-]+)="([^"]*)"/g;
    let match;
    while ((match = regex.exec(tag)) !== null) {
        attributes[match[1]] = match[2];
    }
    return attributes;
}
function parseRgb(fill) {
    const match = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(fill.trim());
    if (!match) {
        return null;
    }
    return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3])
    };
}
async function loadGridSvg(svgFile) {
    const svgPath = path_1.default.resolve(svgFile);
    const raw = await promises_1.default.readFile(svgPath, 'utf-8');
    const rectTags = raw.match(/<rect\b[^>]*>/g) ?? [];
    const rects = rectTags.map(tag => {
        const attributes = parseAttributes(tag);
        const width = Number(attributes.width);
        const height = Number(attributes.height);
        const x = Number(attributes.x ?? '0');
        const y = Number(attributes.y ?? '0');
        const fill = attributes.fill ?? '';
        const color = parseRgb(fill);
        return { width, height, x, y, color };
    }).filter(rect => Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.color);
    if (!rects.length) {
        throw new Error(`No grid rectangles found in ${svgPath}`);
    }
    const sizeCounts = new Map();
    for (const rect of rects) {
        const key = `${rect.width}x${rect.height}`;
        sizeCounts.set(key, (sizeCounts.get(key) ?? 0) + 1);
    }
    const bestSize = [...sizeCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
    if (!bestSize) {
        throw new Error(`Unable to infer cell size from ${svgPath}`);
    }
    const [cellWidth, cellHeight] = bestSize.split('x').map(Number);
    const cells = rects.filter(rect => rect.width === cellWidth && rect.height === cellHeight && rect.color !== null);
    const xs = [...new Set(cells.map(cell => cell.x))].sort((left, right) => left - right);
    const ys = [...new Set(cells.map(cell => cell.y))].sort((left, right) => left - right);
    const xIndex = new Map(xs.map((value, index) => [value, index]));
    const yIndex = new Map(ys.map((value, index) => [value, index]));
    const grid = ys.map(() => xs.map(() => ({ r: 0, g: 0, b: 0 })));
    for (const cell of cells) {
        const row = yIndex.get(cell.y);
        const col = xIndex.get(cell.x);
        if (row === undefined || col === undefined || !cell.color) {
            continue;
        }
        grid[row][col] = cell.color;
    }
    return {
        svgPath,
        rows: grid.length,
        cols: grid[0]?.length ?? 0,
        cellWidth,
        cellHeight,
        cells: grid
    };
}
function movingAverage(values, radius) {
    return values.map((_, index) => {
        const start = Math.max(0, index - radius);
        const end = Math.min(values.length - 1, index + radius);
        return average(values.slice(start, end + 1));
    });
}
function collectEdgeSamples(lumGrid, cols) {
    const samples = [];
    for (const row of lumGrid) {
        const min = Math.min(...row);
        const max = Math.max(...row);
        const range = max - min;
        if (range < 8) {
            continue;
        }
        const low = min + range * 0.2;
        const high = min + range * 0.8;
        const sunrise = row.findIndex(value => value >= low);
        const leftHigh = row.findIndex(value => value >= high);
        const sunset = row.length - 1 - [...row].reverse().findIndex(value => value >= low);
        const rightHigh = row.length - 1 - [...row].reverse().findIndex(value => value >= high);
        const span = sunset - sunrise;
        if (sunrise < 4 || sunset > cols - 5 || leftHigh < sunrise || rightHigh > sunset) {
            continue;
        }
        if (span < cols * 0.2 || span > cols * 0.9) {
            continue;
        }
        const leftWidthMinutes = (leftHigh - sunrise) * 5;
        const rightWidthMinutes = (sunset - rightHigh) * 5;
        if (leftWidthMinutes > 140 || rightWidthMinutes > 140) {
            continue;
        }
        const daylight = row.slice(sunrise, sunset + 1);
        const centerStart = Math.floor(daylight.length * 0.35);
        const centerEnd = Math.ceil(daylight.length * 0.65);
        const leftShoulder = daylight.slice(Math.floor(daylight.length * 0.12), Math.ceil(daylight.length * 0.27));
        const rightShoulder = daylight.slice(Math.floor(daylight.length * 0.73), Math.ceil(daylight.length * 0.88));
        const center = daylight.slice(centerStart, centerEnd);
        const shoulders = leftShoulder.concat(rightShoulder);
        samples.push({
            sunrise,
            sunset,
            leftWidthMinutes,
            rightWidthMinutes,
            rowCenterExcess: average(center) - average(shoulders)
        });
    }
    return samples;
}
function computeGridMetrics(grid) {
    const lumGrid = grid.cells.map(row => row.map(luminance));
    const allColors = grid.cells.flat();
    const columnMeans = Array.from({ length: grid.cols }, (_, col) => average(lumGrid.map(row => row[col])));
    const rowMeans = lumGrid.map(row => average(row));
    const columnResidual = columnMeans.map((value, index) => value - movingAverage(columnMeans, 4)[index]);
    const rowResidual = rowMeans.map((value, index) => value - movingAverage(rowMeans, 3)[index]);
    const edgeSamples = collectEdgeSamples(lumGrid, grid.cols);
    const sunriseDiffs = edgeSamples.slice(1).map((sample, index) => sample.sunrise - edgeSamples[index].sunrise);
    const sunsetDiffs = edgeSamples.slice(1).map((sample, index) => sample.sunset - edgeSamples[index].sunset);
    const edgeVariability = edgeSamples.length
        ? average([
            stddev(edgeSamples.map(sample => sample.leftWidthMinutes)),
            stddev(edgeSamples.map(sample => sample.rightWidthMinutes)),
            stddev(sunriseDiffs) * 4,
            stddev(sunsetDiffs) * 4
        ])
        : 0;
    return {
        rows: grid.rows,
        cols: grid.cols,
        luminanceMean: average(allColors.map(luminance)),
        saturationMean: average(allColors.map(saturation)),
        yellowMean: average(allColors.map(yellowBias)),
        dayCenterExcess: average(edgeSamples.map(sample => sample.rowCenterExcess)),
        leftEdgeWidthMinutes: percentile(edgeSamples.map(sample => sample.leftWidthMinutes), 0.5),
        rightEdgeWidthMinutes: percentile(edgeSamples.map(sample => sample.rightWidthMinutes), 0.5),
        edgeJaggedness: edgeVariability,
        columnBanding: stddev(columnResidual),
        rowBanding: stddev(rowResidual)
    };
}
function buildChecks(fake, real) {
    return [
        { name: 'mean luminance', fake: fake.luminanceMean, real: real.luminanceMean, tolerance: 12, passed: Math.abs(fake.luminanceMean - real.luminanceMean) <= 12 },
        { name: 'mean saturation', fake: fake.saturationMean, real: real.saturationMean, tolerance: 10, passed: Math.abs(fake.saturationMean - real.saturationMean) <= 10 },
        { name: 'mean yellow bias', fake: fake.yellowMean, real: real.yellowMean, tolerance: 8, passed: Math.abs(fake.yellowMean - real.yellowMean) <= 8 },
        { name: 'day center excess', fake: fake.dayCenterExcess, real: real.dayCenterExcess, tolerance: 8, passed: Math.abs(fake.dayCenterExcess - real.dayCenterExcess) <= 8 },
        { name: 'left edge width', fake: fake.leftEdgeWidthMinutes, real: real.leftEdgeWidthMinutes, tolerance: 15, passed: Math.abs(fake.leftEdgeWidthMinutes - real.leftEdgeWidthMinutes) <= 15 },
        { name: 'right edge width', fake: fake.rightEdgeWidthMinutes, real: real.rightEdgeWidthMinutes, tolerance: 20, passed: Math.abs(fake.rightEdgeWidthMinutes - real.rightEdgeWidthMinutes) <= 20 },
        { name: 'edge jaggedness', fake: fake.edgeJaggedness, real: real.edgeJaggedness, tolerance: 5, passed: Math.abs(fake.edgeJaggedness - real.edgeJaggedness) <= 5 },
        { name: 'column banding', fake: fake.columnBanding, real: real.columnBanding, tolerance: 3, passed: Math.abs(fake.columnBanding - real.columnBanding) <= 3 },
        { name: 'row banding', fake: fake.rowBanding, real: real.rowBanding, tolerance: 3, passed: Math.abs(fake.rowBanding - real.rowBanding) <= 3 }
    ];
}
function buildRecommendations(fake, real) {
    const suggestions = [];
    if (fake.dayCenterExcess > real.dayCenterExcess + 6) {
        suggestions.push('Day core is brighter than the shoulders. Remove center-of-day lifting and keep the daytime palette flatter across the daylight span.');
    }
    if (fake.leftEdgeWidthMinutes < real.leftEdgeWidthMinutes - 15 || fake.rightEdgeWidthMinutes < real.rightEdgeWidthMinutes - 20) {
        suggestions.push('Sunrise or sunset transitions are too thin. Push cloud-bank gray farther into the daylight side, especially at sunset, so the edge reads thicker and less cleanly cut.');
    }
    if (fake.leftEdgeWidthMinutes > real.leftEdgeWidthMinutes + 15 || fake.rightEdgeWidthMinutes > real.rightEdgeWidthMinutes + 20) {
        suggestions.push('Sunrise or sunset transitions are too wide. Tighten the edge window and keep full daytime color active sooner after sunrise and later before sunset.');
    }
    if (fake.edgeJaggedness < real.edgeJaggedness - 5) {
        suggestions.push('Day-night boundaries are too smooth. Increase irregular edge breakup with correlated cloud-bank style occlusion and more row-to-row edge displacement.');
    }
    if (fake.columnBanding > real.columnBanding + 3) {
        suggestions.push('Vertical banding is too visible. Reduce column-locked logic and remove effects that depend on broad daylight-ratio buckets.');
    }
    if (fake.rowBanding > real.rowBanding + 3) {
        suggestions.push('Horizontal row artifacts are stronger than the real grid. Reduce row-wise exposure stripes and quantization in the camera-response layer.');
    }
    if (fake.yellowMean > real.yellowMean + 8) {
        suggestions.push('The fake grid is warmer than the real grid. Shift the daytime palette toward gray-blue and reduce yellow excess in the camera-balance step.');
    }
    if (!suggestions.length) {
        suggestions.push('The fake grid is within the current validation tolerances. If visuals still look off, tighten metric thresholds or add a new metric for the specific artifact you see.');
    }
    return suggestions;
}
async function validateDayGrid(fakeSvgFile, realSvgFile, outputFile) {
    const fakeGrid = await loadGridSvg(fakeSvgFile);
    const realGrid = await loadGridSvg(realSvgFile);
    const fakeMetrics = computeGridMetrics(fakeGrid);
    const realMetrics = computeGridMetrics(realGrid);
    const checks = buildChecks(fakeMetrics, realMetrics);
    const report = {
        fakeSvg: fakeGrid.svgPath,
        realSvg: realGrid.svgPath,
        passed: checks.every(check => check.passed),
        checks,
        fake: fakeMetrics,
        real: realMetrics,
        recommendations: buildRecommendations(fakeMetrics, realMetrics)
    };
    const reportPath = path_1.default.resolve(outputFile ?? path_1.default.join(path_1.default.dirname(fakeGrid.svgPath), 'day-grid.validation.json'));
    await promises_1.default.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Wrote day-grid validation report to ${reportPath}`);
    return reportPath;
}
