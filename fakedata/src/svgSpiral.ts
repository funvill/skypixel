import fs from 'fs/promises';
import path from 'path';

import { SpiralSvgConfig } from './types';
import { buildSvgTitle, escapeXml, loadGeneratedRecords } from './svgData';

function chordDistance(b: number, theta1: number, theta2: number): number {
  const r1 = b * theta1;
  const r2 = b * theta2;
  const dtheta = theta2 - theta1;
  return Math.sqrt(r1 * r1 + r2 * r2 - 2 * r1 * r2 * Math.cos(dtheta));
}

function findTheta2(b: number, theta1: number, target: number, maxStep: number): number {
  let low = 0;
  let high = maxStep;
  while (chordDistance(b, theta1, theta1 + high) < target) {
    high *= 2;
  }

  for (let index = 0; index < 8; index++) {
    const mid = (low + high) / 2;
    if (chordDistance(b, theta1, theta1 + mid) < target) low = mid;
    else high = mid;
  }

  return theta1 + (low + high) / 2;
}

function rgbFill(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

async function renderEvenSpiralWithSettings(config: SpiralSvgConfig): Promise<string> {
  const { inputPath, records } = await loadGeneratedRecords(config.inputFile);
  const outputPath = path.resolve(config.outputFile ?? path.join(path.dirname(inputPath), 'evenSpiral.svg'));
  const { circleRadius, strokeWidth, strokeColor, backgroundColor, b, chord, maxThetaStep } = config.settings.render.spiral.even;

  const coords: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  let theta = 0;
  for (let index = 1; index < records.length; index++) {
    theta = findTheta2(b, theta, chord, maxThetaStep);
    const radius = b * theta;
    coords.push({ x: radius * Math.cos(theta), y: radius * Math.sin(theta) });
  }

  const maxRadius = Math.max(...coords.map(point => Math.hypot(point.x, point.y)));
  const size = (maxRadius + circleRadius) * 2;
  const center = size / 2;
  const svg: string[] = [];
  svg.push('<?xml version="1.0" encoding="UTF-8"?>');
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="title">`);
  svg.push(`<title>${escapeXml(buildSvgTitle(inputPath, 'even spiral'))}</title>`);
  svg.push(`<rect width="100%" height="100%" fill="${backgroundColor}"/>`);

  coords.forEach((point, index) => {
    const record = records[index];
    const cx = center + point.x;
    const cy = center + point.y;
    svg.push(
      `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${circleRadius}" fill="${rgbFill(record.average.r, record.average.g, record.average.b)}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
    );
  });

  svg.push('</svg>');
  await fs.writeFile(outputPath, `${svg.join('')}\n`);
  console.log(`Wrote even spiral SVG to ${outputPath}`);
  return outputPath;
}

async function renderVogelSpiralWithSettings(config: SpiralSvgConfig): Promise<string> {
  const { inputPath, records } = await loadGeneratedRecords(config.inputFile);
  const outputPath = path.resolve(config.outputFile ?? path.join(path.dirname(inputPath), 'VogelSpiral.svg'));
  const { circleRadius, strokeWidth, strokeColor, backgroundColor, spacingFactor, goldenAngle } = config.settings.render.spiral.vogel;

  const diameter = circleRadius * 2;
  const spacing = diameter * spacingFactor;
  const maxRadius = spacing * Math.sqrt(records.length - 1);
  const canvasSize = maxRadius * 2 + diameter;
  const center = canvasSize / 2;
  const svg: string[] = [];
  svg.push('<?xml version="1.0" encoding="UTF-8"?>');
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" role="img" aria-labelledby="title">`);
  svg.push(`<title>${escapeXml(buildSvgTitle(inputPath, 'vogel spiral'))}</title>`);
  svg.push(`<rect width="100%" height="100%" fill="${backgroundColor}"/>`);

  records.forEach((record, index) => {
    const theta = index * goldenAngle;
    const radius = spacing * Math.sqrt(index);
    const x = center + radius * Math.cos(theta);
    const y = center + radius * Math.sin(theta);
    svg.push(
      `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${circleRadius}" fill="${rgbFill(record.average.r, record.average.g, record.average.b)}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
    );
  });

  svg.push('</svg>');
  await fs.writeFile(outputPath, `${svg.join('')}\n`);
  console.log(`Wrote Vogel spiral SVG to ${outputPath}`);
  return outputPath;
}

export async function renderSpiralSvg(config: SpiralSvgConfig): Promise<string> {
  const pattern = config.pattern ?? config.settings.render.spiral.defaultPattern;
  if (pattern === 'vogel') {
    return renderVogelSpiralWithSettings(config);
  }

  return renderEvenSpiralWithSettings(config);
}