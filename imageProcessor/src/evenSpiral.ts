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
 * Calculates a contrasting text color (black/white) for legibility.
 */
function getContrastingTextColor(r: number, g: number, b: number): string {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 186 ? 'black' : 'white';
}

/**
 * Distance between two points on Archimedes spiral: r=b*θ
 */
function chordDistance(b: number, theta1: number, theta2: number): number {
  const r1 = b * theta1;
  const r2 = b * theta2;
  const dtheta = theta2 - theta1;
  return Math.sqrt(
    r1 * r1 + r2 * r2 - 2 * r1 * r2 * Math.cos(dtheta)
  );
}

/**
 * Uses binary search to find θ2 > θ1 such that chordDistance == targetChord
 */
function findTheta2(b: number, theta1: number, target: number, maxStep: number): number {
  // find high bound
  let low = 0;
  let high = maxStep;
  while (chordDistance(b, theta1, theta1 + high) < target) {
    high *= 2;
  }
  // binary search for ~8 iterations
  for (let i = 0; i < 8; i++) {
    const mid = (low + high) / 2;
    if (chordDistance(b, theta1, theta1 + mid) < target) low = mid;
    else high = mid;
  }
  return theta1 + (low + high) / 2;
}

/**
 * Generates a bead-chain along an Archimedes spiral so each bead touches the previous.
 */
export async function evenSpiral(root: string) {
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

    // compute coords on spiral
    const coords: { x: number; y: number }[] = [];
    let theta = 0;
    coords.push({ x: 0, y: 0 }); // center
    for (let i = 1; i < n; i++) {
      theta = findTheta2(b, theta, chord, maxThetaStep);
      const r = b * theta;
      coords.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
    }

    // determine canvas
    const maxR = Math.max(...coords.map(p => Math.hypot(p.x, p.y)));
    const size = (maxR + circleRadius) * 2;
    const center = size / 2;

    const svg: string[] = [];
    svg.push(
      `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${size}\" height=\"${size}\">`,
      `<rect width=\"100%\" height=\"100%\" fill=\"${backgroundColor}\"/>`
    );

    // path segments
    if (enablePathStroke) {
      for (let i = 1; i < coords.length; i++) {
        const p0 = coords[i - 1];
        const p1 = coords[i];
        svg.push(
          `<line x1=\"${(center + p0.x).toFixed(2)}\" y1=\"${(center + p0.y).toFixed(2)}\" ` +
          `x2=\"${(center + p1.x).toFixed(2)}\" y2=\"${(center + p1.y).toFixed(2)}\" ` +
          `stroke=\"${pathStroke}\" stroke-width=\"${pathStrokeWidth}\"/>`
        );
      }
    }

    // beads & labels
    coords.forEach((pt, i) => {
      const cx = center + pt.x;
      const cy = center + pt.y;
      const avg = data[i].average;
      const fill = avg.a !== undefined
        ? `rgba(${avg.r},${avg.g},${avg.b},${(avg.a / 255).toFixed(2)})`
        : `rgb(${avg.r},${avg.g},${avg.b})`;
      svg.push(
        `<circle cx=\"${cx.toFixed(2)}\" cy=\"${cy.toFixed(2)}\" ` +
        `r=\"${circleRadius}\" fill=\"${fill}\" ` +
        `stroke=\"${strokeColor}\" stroke-width=\"${strokeWidth}\"/>`
      );

      if (enableText) {

        const textColor = getContrastingTextColor(avg.r, avg.g, avg.b);
        svg.push(
          `<text x=\"${cx.toFixed(2)}\" y=\"${(cy + circleRadius / 3).toFixed(2)}\" ` +
          `text-anchor=\"middle\" alignment-baseline=\"middle\" ` +
          `font-size=\"${circleRadius}px\" fill=\"${textColor}\">${i + 1}</text>`
        );
      }
    });

    svg.push('</svg>');

    await fs.writeFile(path.join(folder, 'evenSpiral.svg'), svg.join(''));
    console.log(`✅ Generated evenSpiral.svg for ${folder}`);
  }
}