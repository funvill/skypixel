#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vogelSpiral = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
// === Visualization Settings (tweak for different layouts) ===
const CONFIG = {
    circleRadius: 5, // base radius of each circle in pixels
    strokeWidth: 1, // border width for each circle
    strokeColor: '#ccc', // border color for circles
    backgroundColor: 'black', // SVG background color
    spacingFactor: 0.9, // fraction of diameter between centers (<1 for overlap)
    goldenAngle: Math.PI * (3 - Math.sqrt(5)), // Vogel's spiral angle
    pathStroke: 'red', // color for spiral path segments
    pathStrokeWidth: 1, // width of spiral path segments
    debugNumbers: false, // show numbers on circles
    debugSegmentLines: false, // show lines between circles
};
/**
 * Calculates appropriate text color (black or white) for contrast against given RGB.
 */
function getContrastingTextColor(r, g, b) {
    // Perceived luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 186 ? 'black' : 'white';
}
/**
 * Generates a Vogel-style spiral visualization SVG with radial spokes,
 * continuous red path, and numbered circles with contrasting text.
 */
async function vogelSpiral(root) {
    console.log(`\n🔎 Generating visuals under ${root}\n`);
    const subdirs = await promises_1.default.readdir(root);
    const { circleRadius, strokeWidth, strokeColor, backgroundColor, spacingFactor, goldenAngle, pathStroke, pathStrokeWidth, debugNumbers, debugSegmentLines } = CONFIG;
    const diameter = circleRadius * 2;
    const spacing = diameter * spacingFactor;
    for (const name of subdirs) {
        const folder = path_1.default.join(root, name);
        const stat = await promises_1.default.stat(folder).catch(() => null);
        if (!stat || !stat.isDirectory())
            continue;
        const outputPath = path_1.default.join(folder, 'output.json');
        const exists = await promises_1.default.stat(outputPath).then(() => true).catch(() => false);
        if (!exists) {
            console.log(`⚠️  Skipping ${folder}: output.json missing`);
            continue;
        }
        const data = JSON.parse(await promises_1.default.readFile(outputPath, 'utf-8'));
        if (data.length === 0) {
            console.log(`⚠️  No data points in ${folder}`);
            continue;
        }
        // Compute canvas size
        const n = data.length;
        const rMax = spacing * Math.sqrt(n - 1);
        const canvasSize = rMax * 2 + diameter;
        const center = canvasSize / 2;
        const svgParts = [];
        svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}">`, `<rect width="100%" height="100%" fill="${backgroundColor}"/>`);
        // Compute spiral coordinates
        const coords = [];
        for (let i = 0; i < n; i++) {
            const theta = i * goldenAngle;
            const r = spacing * Math.sqrt(i);
            coords.push({
                x: center + r * Math.cos(theta),
                y: center + r * Math.sin(theta)
            });
        }
        // Red path segments
        if (debugSegmentLines) {
            for (let i = 1; i < coords.length; i++) {
                const prev = coords[i - 1];
                const curr = coords[i];
                svgParts.push(`<line x1="${prev.x.toFixed(2)}" y1="${prev.y.toFixed(2)}" ` +
                    `x2="${curr.x.toFixed(2)}" y2="${curr.y.toFixed(2)}" ` +
                    `stroke="${pathStroke}" stroke-width="${pathStrokeWidth}"/>`);
            }
        }
        // Draw numbered circles with contrasting text
        coords.forEach((pt, i) => {
            const avg = data[i].average;
            const r = avg.r;
            const g = avg.g;
            const b = avg.b;
            const fill = avg.a !== undefined
                ? `rgba(${r},${g},${b},${(avg.a / 255).toFixed(2)})`
                : `rgb(${r},${g},${b})`;
            svgParts.push(`<circle cx="${pt.x.toFixed(2)}" cy="${pt.y.toFixed(2)}" ` +
                `r="${circleRadius}" fill="${fill}" ` +
                `stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);
            if (debugNumbers) {
                const textColor = getContrastingTextColor(r, g, b);
                svgParts.push(`<text x="${pt.x.toFixed(2)}" y="${(pt.y + circleRadius / 3).toFixed(2)}" ` +
                    `text-anchor="middle" alignment-baseline="middle" ` +
                    `font-size="${circleRadius}px" fill="${textColor}">${i + 1}</text>`);
            }
        });
        svgParts.push('</svg>');
        const svgPath = path_1.default.join(folder, 'VogelSpiral.svg');
        await promises_1.default.writeFile(svgPath, svgParts.join(''));
        console.log(`✅ Generated VogelSpiral.svg for ${folder}`);
    }
}
exports.vogelSpiral = vogelSpiral;
