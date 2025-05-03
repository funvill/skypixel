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
const VERSION = 'v3.1 (2025-May-03)';
function printVersion() {
    console.log(`SkyPixel CLI\nVersion: ${VERSION}\n`);
}
/**
 * Extracts a sky region and saves to 'sky_' prefixed file.
 */
async function saveRegionPreview(filePath, region) {
    const dir = path_1.default.dirname(filePath);
    const base = path_1.default.basename(filePath);
    const outName = `sky_${base}`;
    await (0, sharp_1.default)(filePath)
        .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
        .toFile(path_1.default.join(dir, outName));
}
/**
 * Deletes a file if it exists.
 */
async function deleteFile(filePath) {
    try {
        await promises_1.default.unlink(filePath);
    }
    catch { }
}
/**
 * Computes average color of the entire image file.
 */
async function computeAverage(filePath) {
    const { data, info } = await (0, sharp_1.default)(filePath)
        .raw()
        .toBuffer({ resolveWithObject: true });
    const pixelCount = info.width * info.height;
    const sums = new Array(info.channels).fill(0);
    for (let i = 0; i < data.length; i += info.channels) {
        for (let c = 0; c < info.channels; c++) {
            sums[c] += data[i + c];
        }
    }
    const avg = sums.map(sum => Math.round(sum / pixelCount));
    const [r, g, b, a] = avg;
    return info.channels === 4 ? { r, g, b, a } : { r, g, b };
}
/**
 * Saves an SVG palette of 10×10px blocks for each color.
 */
async function saveSvgBlocks(folder, results) {
    const block = 10;
    const cols = Math.min(10, results.length);
    const rows = Math.ceil(results.length / cols);
    const svgParts = [`<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${cols * block}\" height=\"${rows * block}\">`];
    results.forEach((r, i) => {
        const { r: R, g, b, a } = r.average;
        const x = (i % cols) * block;
        const y = Math.floor(i / cols) * block;
        const fill = a !== undefined
            ? `rgba(${R},${g},${b},${(a / 255).toFixed(2)})`
            : `rgb(${R},${g},${b})`;
        svgParts.push(`<rect x=\"${x}\" y=\"${y}\" width=\"${block}\" height=\"${block}\" fill=\"${fill}\"/>`);
    });
    svgParts.push('</svg>');
    await promises_1.default.writeFile(path_1.default.join(folder, 'output.svg'), svgParts.join(''));
}
/**
 * Processes all subfolders under a root directory for extraction.
 */
async function processExtract(root) {
    console.log(`\n🔎 Extracting sky from folders under ${root}\n`);
    let foldersWithoutSettings = [];
    const subdirs = await promises_1.default.readdir(root);
    for (const name of subdirs) {
        const folder = path_1.default.join(root, name);
        const stat = await promises_1.default.stat(folder).catch(() => null);
        if (!stat || !stat.isDirectory())
            continue;
        const settingsFile = path_1.default.join(folder, 'settings.json');
        const hasSettings = await promises_1.default.stat(settingsFile).then(() => true).catch(() => false);
        if (!hasSettings) {
            foldersWithoutSettings.push(folder);
            console.log(`⚠️  Skipping ${folder}: no settings.json`);
            continue;
        }
        const s = JSON.parse(await promises_1.default.readFile(settingsFile, 'utf-8'));
        // Check if the settings.json file has a 'x', 'y', 'width', 'height' properties
        // If not skip this folder
        if (s.x === undefined || s.y === undefined || s.width === undefined || s.height === undefined) {
            console.log(`⚠️  Skipping ${folder}: no x,y,width,height in settings.json`);
            continue;
        }
        const region = {
            x: Number(s.x), y: Number(s.y),
            width: Number(s.width), height: Number(s.height)
        };
        console.log(`🔎 Extracting sky for ${folder} using settings ${JSON.stringify(region)}`);
        const files = await promises_1.default.readdir(folder);
        const images = files.filter(f => /\.(png|jpe?g)$/i.test(f) && !/^sky_/i.test(f));
        if (images.length === 0) {
            console.log(`   ⚠️  No images to extract in ${folder}`);
            continue;
        }
        process.stdout.write(`   📄 Found ${images.length} images to extract `);
        for (const f of images) {
            const fp = path_1.default.join(folder, f);
            try {
                await saveRegionPreview(fp, region);
                await deleteFile(fp);
                process.stdout.write('.');
            }
            catch (err) {
                console.error(`\n❌ Error extracting ${fp}:`, err);
            }
        }
        console.log(`\n   ✅ Done extract for ${folder}\n`);
    }
    console.log(`\n✅ Done extracting sky from all folders\n`);
    if (foldersWithoutSettings.length > 0) {
        console.log(`Folders without settings.json:\n${foldersWithoutSettings.join('\n')}`);
    }
}
/**
 * Processes all subfolders under a root directory for analysis.
 */
async function processAnalyze(root) {
    console.log(`\n🔎 Analyzing sky images in folders under ${root}\n`);
    const subdirs = await promises_1.default.readdir(root);
    for (const name of subdirs) {
        const folder = path_1.default.join(root, name);
        const stat = await promises_1.default.stat(folder).catch(() => null);
        if (!stat || !stat.isDirectory())
            continue;
        console.log(`🔎 Analyzing ${folder}`);
        const files = await promises_1.default.readdir(folder);
        const skies = files.filter(f => /^sky_.*\.(png|jpe?g)$/i.test(f));
        if (skies.length === 0) {
            console.log(`   ⚠️  No 'sky_' images in ${folder}`);
            continue;
        }
        process.stdout.write(`   📄 Found ${skies.length} images to analyze `);
        const results = [];
        for (const f of skies) {
            // ToDo: Check to see if the file is already analyzed and in the output.json, if so skip it
            try {
                const avg = await computeAverage(path_1.default.join(folder, f));
                results.push({ file: f, average: avg });
                process.stdout.write('+');
            }
            catch (err) {
                console.error(`\n❌ Error analyzing ${f}:`, err);
            }
            // ToDo: Update the output.json with the new average for this file.
        }
        await promises_1.default.writeFile(path_1.default.join(folder, 'output.json'), JSON.stringify(results, null, 2));
        // ToDo: Load the output.json and generate the SVG blocks for all the images in the output.json
        await saveSvgBlocks(folder, results);
        console.log(`\n✅ Wrote ${results.length} records and output.svg for ${folder}\n`);
    }
}
/**
 * CLI entrypoint.
 */
function main() {
    printVersion();
    // ToDo: Add a command to not delete the original images --NoDelete
    // ToDo: Add a command to remove the output.json before analyze command --ClearOutput
    (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .command('extract <root>', 'Extract sky regions and delete originals in each subfolder', yargs => yargs.positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' }), async (argv) => {
        await processExtract(argv.root);
    })
        .command('analyze <root>', 'Compute averages and update outputs in each subfolder', yargs => yargs.positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' }), async (argv) => {
        await processAnalyze(argv.root);
    })
        .demandCommand(1)
        .help()
        .parse();
}
main();
