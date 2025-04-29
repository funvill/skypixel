#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const sharp_1 = __importDefault(require("sharp"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
/**
 * Extracts the region from the source image and saves a preview prefixed with 'sky_'.
 */
async function saveRegionPreview(filePath, region) {
    const dir = path_1.default.dirname(filePath);
    const base = path_1.default.basename(filePath);
    const previewName = `sky_${base}`;
    const previewPath = path_1.default.join(dir, previewName);
    await (0, sharp_1.default)(filePath)
        .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
        .toFile(previewPath);
}
/**
 * Computes the average color of a region from the source image.
 */
async function computeAverage(file, region) {
    const { data, info } = await (0, sharp_1.default)(file)
        .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const pixelCount = region.width * region.height;
    const sums = new Array(info.channels).fill(0);
    for (let i = 0; i < data.length; i += info.channels) {
        for (let c = 0; c < info.channels; c++)
            sums[c] += data[i + c];
    }
    const avg = sums.map(sum => Math.round(sum / pixelCount));
    const [r, g, b, a] = avg;
    return info.channels === 4 ? { r, g, b, a } : { r, g, b };
}
/**
 * Generates an SVG of 10x10px blocks for each average color and writes it.
 */
async function saveSvgBlocks(folder, results) {
    const blockSize = 10;
    const columns = (24 * 2);
    const rows = Math.ceil(results.length / columns);
    const width = columns * blockSize;
    const height = rows * blockSize;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
    results.forEach((entry, idx) => {
        const { r, g, b, a } = entry.average;
        const col = idx % columns;
        const row = Math.floor(idx / columns);
        const x = col * blockSize;
        const y = row * blockSize;
        const fill = a !== undefined
            ? `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`
            : `rgb(${r},${g},${b})`;
        svg += `<rect x="${x}" y="${y}" width="${blockSize}" height="${blockSize}" fill="${fill}"/>`;
    });
    svg += `</svg>`;
    const svgPath = path_1.default.join(folder, 'output.svg');
    await promises_1.default.writeFile(svgPath, svg);
}
async function processSingle(file, region) {
    try {
        await saveRegionPreview(file, region);
        const avg = await computeAverage(file, region);
        console.log(`Average color for ${file}:`, avg);
    }
    catch (err) {
        console.error(`Error processing ${file}:`, err);
        process.exit(1);
    }
}
async function processBatch(settingsPath) {
    try {
        const content = await promises_1.default.readFile(settingsPath, 'utf-8');
        const entries = JSON.parse(content);
        for (const entry of entries) {
            const folder = entry.folder;
            const region = {
                x: Number(entry.x),
                y: Number(entry.y),
                width: Number(entry.width),
                height: Number(entry.height)
            };
            const files = await promises_1.default.readdir(folder);
            const pngs = files.filter(f => /\.png$/i.test(f) && !/^sky_/i.test(f));
            console.log(`Processing ${pngs.length} images in ${folder}`);
            const results = [];
            const outJson = path_1.default.join(folder, 'output.json');
            await promises_1.default.writeFile(outJson, JSON.stringify([], null, 2));
            for (const fname of pngs) {
                const filePath = path_1.default.join(folder, fname);
                await saveRegionPreview(filePath, region);
                const avg = await computeAverage(filePath, region);
                results.push({ file: fname, average: avg });
                await promises_1.default.writeFile(outJson, JSON.stringify(results, null, 2));
            }
            // Generate SVG blocks after processing all images
            await saveSvgBlocks(folder, results);
            console.log(`Wrote ${results.length} items to ${outJson} and generated output.svg`);
        }
    }
    catch (err) {
        console.error('Error processing batch:', err);
        process.exit(1);
    }
}
async function main() {
    const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .option('file', { type: 'string', describe: 'Path to PNG file' })
        .option('x', { type: 'number', describe: 'X coordinate' })
        .option('y', { type: 'number', describe: 'Y coordinate' })
        .option('width', { type: 'number', describe: 'Region width' })
        .option('height', { type: 'number', describe: 'Region height' })
        .option('settings', { type: 'string', describe: 'Path to settings JSON file for batch processing' })
        .check(args => {
        if (args.settings)
            return true;
        const needed = ['file', 'x', 'y', 'width', 'height'];
        for (const opt of needed) {
            if (args[opt] === undefined)
                throw new Error(`--${opt} is required in single-file mode`);
        }
        return true;
    })
        .parseSync();
    if ('settings' in argv && argv.settings) {
        await processBatch(argv.settings);
    }
    else {
        await processSingle(argv.file, {
            x: argv.x,
            y: argv.y,
            width: argv.width,
            height: argv.height
        });
    }
}
main();
