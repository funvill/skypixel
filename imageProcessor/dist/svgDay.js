#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.svgDay = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
// === Visualization Settings ===
const CONFIG = {
    circleRadius: 5, // radius of each circle in pixels (bead radius)
    strokeWidth: 1, // border width for circles
    strokeColor: '#ccc', // border color for circles
    backgroundColor: 'black', // SVG background color
    // Archimedes spiral parameter: r = b * θ
    b: 2, // controls radial growth per radian; tweak for tightness
    maxThetaStep: 1, // initial theta search bound (radians)
    chord: 10, // distance between bead centers = 2 * circleRadius
    enableText: false, // enable text labels
    enablePathStroke: false, // enable path stroke (for debugging)
    pathStroke: 'red', // color for spiral path
    pathStrokeWidth: 1 // width of spiral path segments
};
/**
 * Generates a bead-chain along an Archimedes spiral so each bead touches the previous.
 */
async function svgDay(root) {
    console.log(`\n🔎 Generating Archimedes-bead spiral under ${root}\n`);
    const subdirs = await promises_1.default.readdir(root);
    const { circleRadius, strokeWidth, strokeColor, backgroundColor, b, maxThetaStep, chord, enableText, enablePathStroke, pathStroke, pathStrokeWidth } = CONFIG;
    for (const name of subdirs) {
        const folder = path_1.default.join(root, name);
        const stat = await promises_1.default.stat(folder).catch(() => null);
        if (!(stat === null || stat === void 0 ? void 0 : stat.isDirectory()))
            continue;
        const outputPath = path_1.default.join(folder, 'output.json');
        if (!(await promises_1.default.stat(outputPath).then(() => true).catch(() => false)))
            continue;
        const data = JSON.parse(await promises_1.default.readFile(outputPath, 'utf-8'));
        const n = data.length;
        if (n === 0)
            continue;
        // ToDo
        // await fs.writeFile(path.join(folder, 'evenSpiral.svg'), svg.join(''));
        console.log(`❌ ToDo: generate day.svg for ${folder}`);
        // console.log(`✅ Generated day.svg for ${folder}`);
    }
}
exports.svgDay = svgDay;
