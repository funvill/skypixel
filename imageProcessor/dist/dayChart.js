#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayChartFolder = exports.dayChart = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const data_1 = require("./data");
// === Visualization Settings ===
const CONFIG = {
    boxSize: 20, // size of each box in pixels
    pointsOnARow: (24 * 60) / 5, // boxes per row (e.g., minutes per day / interval)
    backgroundColor: 'white', // canvas background color
    labelOffset: false, // label each box with its sequence index
    intervalMinutes: 5, // expected interval between data points (minutes)
    toleranceMinutes: 2, // allow ±2 min when matching timestamps
    missingFill: 'green' // fill color for missing data slots
};
async function dayChart(root) {
    console.log(`\n🔎 Generating dayChart under ${root}\n`);
    const subdirs = await promises_1.default.readdir(root);
    const { boxSize, pointsOnARow, backgroundColor, labelOffset, intervalMinutes, toleranceMinutes, missingFill } = CONFIG;
    const msInterval = intervalMinutes * 60 * 1000;
    const msTolerance = toleranceMinutes * 60 * 1000;
    for (const name of subdirs) {
        const folder = path_1.default.join(root, name);
        await renderDayChartFolder(folder, CONFIG);
    }
}
exports.dayChart = dayChart;
async function dayChartFolder(folder) {
    await renderDayChartFolder(folder, CONFIG);
}
exports.dayChartFolder = dayChartFolder;
async function renderDayChartFolder(folder, config) {
    const stat = await promises_1.default.stat(folder).catch(() => null);
    if (!stat || !stat.isDirectory())
        return;
    const outputPath = path_1.default.join(folder, 'output.json');
    if (!(await promises_1.default.stat(outputPath).then(() => true).catch(() => false)))
        return;
    const entries = await (0, data_1.loadMergedEntries)(folder);
    if (entries.length === 0)
        return;
    const { boxSize, pointsOnARow, backgroundColor, labelOffset, intervalMinutes, toleranceMinutes, missingFill } = config;
    const msInterval = intervalMinutes * 60 * 1000;
    const msTolerance = toleranceMinutes * 60 * 1000;
    // Determine start/end and expected count
    const first = entries[0].date;
    // floor first to nearest interval
    const totalMin = first.getHours() * 60 + first.getMinutes();
    const flooredMin = Math.floor(totalMin / intervalMinutes) * intervalMinutes;
    const start = new Date(first);
    start.setHours(Math.floor(flooredMin / 60), flooredMin % 60, 0, 0);
    const last = entries[entries.length - 1].date;
    const expectedCount = Math.floor((last.getTime() - start.getTime()) / msInterval) + 1;
    const rows = Math.ceil(expectedCount / pointsOnARow);
    const width = pointsOnARow * boxSize;
    const height = rows * boxSize;
    // Build SVG
    const svg = [];
    svg.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`, `<rect width="100%" height="100%" fill="${backgroundColor}"/>`);
    // Iterate expected slots
    for (let i = 0; i < expectedCount; i++) {
        const expectedTime = new Date(start.getTime() + i * msInterval);
        // find matching entry
        const match = entries.find(e => Math.abs(e.date.getTime() - expectedTime.getTime()) <= msTolerance);
        const col = i % pointsOnARow;
        const row = Math.floor(i / pointsOnARow);
        const x = col * boxSize;
        const y = row * boxSize;
        let fill = missingFill;
        if (match) {
            const { r, g, b, a } = match.average;
            fill = a !== undefined
                ? `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`
                : `rgb(${r},${g},${b})`;
        }
        svg.push(`<rect x="${x}" y="${y}" width="${boxSize}" height="${boxSize}" ` +
            `fill="${fill}" stroke="#444" stroke-width="1"/>`);
        if (labelOffset) {
            svg.push(`<text x="${x + boxSize / 2}" y="${y + boxSize / 2 + 4}" ` +
                `text-anchor="middle" alignment-baseline="middle" ` +
                `font-size="${Math.floor(boxSize / 3)}px" fill="white">${i}</text>`);
        }
    }
    svg.push(`</svg>`);
    const outFile = path_1.default.join(folder, 'dayChart.svg');
    await promises_1.default.writeFile(outFile, svg.join('\n'));
    console.log(`✅ Generated ${folder}/dayChart.svg (${width}×${height})`);
}
