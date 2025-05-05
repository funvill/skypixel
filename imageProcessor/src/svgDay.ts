#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

// === Visualization Settings ===
const CONFIG = {
  circleRadius: 5,          // radius of each circle in pixels (bead radius)
  strokeWidth: 1,           // border width for circles
  strokeColor: '#ccc',      // border color for circles
  backgroundColor: 'black', // SVG background color

  // Archimedes spiral parameter: r = b * θ
  b: 2,                     // controls radial growth per radian; tweak for tightness
  maxThetaStep: 1,          // initial theta search bound (radians)
  chord: 10,                // distance between bead centers = 2 * circleRadius

  enableText: false,        // enable text labels

  enablePathStroke: false,  // enable path stroke (for debugging)
  pathStroke: 'red',        // color for spiral path
  pathStrokeWidth: 1        // width of spiral path segments
};


/**
 * Generates a bead-chain along an Archimedes spiral so each bead touches the previous.
 */
export async function svgDay(root: string) {
  console.log(`\n🔎 Generating Archimedes-bead spiral under ${root}\n`);
  const subdirs = await fs.readdir(root);
  const { circleRadius, strokeWidth, strokeColor, backgroundColor, b, maxThetaStep, chord, enableText, enablePathStroke, pathStroke, pathStrokeWidth } = CONFIG;

  for (const name of subdirs) {
    const folder = path.join(root, name);
    const stat = await fs.stat(folder).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const outputPath = path.join(folder, 'output.json');
    if (!(await fs.stat(outputPath).then(() => true).catch(() => false))) continue;

    const data: { file: string; average: any }[] = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    const n = data.length;
    if (n === 0) continue;

    // ToDo

    // await fs.writeFile(path.join(folder, 'evenSpiral.svg'), svg.join(''));
    console.log(`❌ ToDo: generate day.svg for ${folder}`);
    // console.log(`✅ Generated day.svg for ${folder}`);
  }
}