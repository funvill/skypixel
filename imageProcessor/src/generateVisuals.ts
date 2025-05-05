#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

// === Visualization Settings (tweak for different layouts) ===
const CONFIG = {
  circleRadius: 5,                  // base radius of each circle in pixels
  strokeWidth: 1,                   // border width for each circle
  strokeColor: '#ccc',              // border color for circles
  backgroundColor: 'black',         // SVG background color
  spacingFactor: 0.9,               // fraction of diameter between centers (<1 for overlap)
  goldenAngle: Math.PI * (3 - Math.sqrt(5)), // Vogel's spiral angle

  // Feature toggles
  enableSizeVariation: false,       // vary circle size randomly
  sizeVariationFactor: 0.2,         // max ± variation (fraction of base radius)
};

/**
 * Generates a Vogel-style spiral visualization SVG with optional effects.
 */
export async function generateVisuals(root: string) {
  console.log(`\n🔎 Generating visuals under ${root}\n`);
  const subdirs = await fs.readdir(root);

  const {
    circleRadius,
    strokeWidth,
    strokeColor,
    backgroundColor,
    spacingFactor,
    goldenAngle,
    enableSizeVariation,
    sizeVariationFactor
  } = CONFIG;

  const diameter = circleRadius * 2;
  const spacing = diameter * spacingFactor;

  for (const name of subdirs) {
    const folder = path.join(root, name);
    const stat = await fs.stat(folder).catch(() => null);
    if (!stat || !stat.isDirectory()) continue;

    const outputPath = path.join(folder, 'output.json');
    const exists = await fs.stat(outputPath).then(() => true).catch(() => false);
    if (!exists) {
      console.log(`⚠️  Skipping ${folder}: output.json missing`);
      continue;
    }

    const data: { file: string; average: any }[] =
      JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    if (data.length === 0) {
      console.log(`⚠️  No data points in ${folder}`);
      continue;
    }

    // Compute canvas size
    const n = data.length;
    const rMax = spacing * Math.sqrt(n - 1);
    const canvasSize = rMax * 2 + diameter;
    const center = canvasSize / 2;

    const svgParts: string[] = [];
    svgParts.push(
      `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${canvasSize}\" height=\"${canvasSize}\">`,
      `<rect width=\"100%\" height=\"100%\" fill=\"${backgroundColor}\"/>`
    );


    // Compute spiral coordinates
    const coords: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const theta = i * goldenAngle;
      const r = spacing * Math.sqrt(i);
      coords.push({
        x: center + r * Math.cos(theta),
        y: center + r * Math.sin(theta)
      });
    }


    // Draw circles
    coords.forEach((pt, i) => {
      const avg = data[i].average;
      const fill = avg.a !== undefined
        ? `rgba(${avg.r},${avg.g},${avg.b},${(avg.a/255).toFixed(2)})`
        : `rgb(${avg.r},${avg.g},${avg.b})`;

      // size variation
      let rVar = circleRadius;
      if (enableSizeVariation) {
        const delta = (Math.random() * 2 - 1) * sizeVariationFactor * circleRadius;
        rVar += delta;
      }

      // opacity fade
      let opacity = 1;
      
      svgParts.push(
        `<circle cx=\"${pt.x.toFixed(2)}\" cy=\"${pt.y.toFixed(2)}\" ` +
        `r=\"${rVar.toFixed(2)}\" fill=\"${fill}\"` +
        ` stroke=\"${strokeColor}\" stroke-width=\"${strokeWidth}\"` +
        ` fill-opacity=\"${opacity.toFixed(2)}\"/>`
      );
    });

    svgParts.push('</svg>');

    const svgPath = path.join(folder, 'visualization.svg');
    await fs.writeFile(svgPath, svgParts.join(''));
    console.log(`✅ Generated visualization.svg for ${folder}`);
  }
}