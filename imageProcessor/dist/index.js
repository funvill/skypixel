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
const VERSION = 'v2.1 (2025-May-02)';
function printVersion() {
    console.log(`SkyPixel CLI \nVersion: ${VERSION}\n`);
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
    ;
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
    return info.channels === 4
        ? { r, g, b, a }
        : { r, g, b };
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
        const fill = (a !== undefined)
            ? `rgba(${R},${g},${b},${(a / 255).toFixed(2)})`
            : `rgb(${R},${g},${b})`;
        svgParts.push(`<rect x=\"${x}\" y=\"${y}\" width=\"${block}\" height=\"${block}\" fill=\"${fill}\"/>`);
    });
    svgParts.push('</svg>');
    await promises_1.default.writeFile(path_1.default.join(folder, 'output.svg'), svgParts.join(''));
}
// EXTRACT commands
async function extractSingle(file, region) {
    console.log(`Extracting single file: ${file}`);
    await saveRegionPreview(file, region);
    await deleteFile(file);
    console.log(`Extracted sky and removed original: ${file}`);
}
async function extractBatch(settings) {
    console.log(`Action: Extracting batch`);
    const entries = JSON.parse(await promises_1.default.readFile(settings, 'utf-8'));
    for (const e of entries) {
        let region = { x: +e.x, y: +e.y, width: +e.width, height: +e.height };
        const files = await promises_1.default.readdir(e.folder);
        console.log(`🔎 Processing folder: ${e.folder}`);
        // Filter out non-PNG/JPG files and those starting with 'sky_'
        const imageFiles = files.filter(f => /\.(png|jpe?g)$/i.test(f) && !/^sky_/i.test(f));
        if (imageFiles.length === 0) {
            console.log(`   ❗ WARN: No files to process in folder ${e.folder}`);
            continue;
        }
        console.log(`   🖼️  Files to process: ${imageFiles.length}`);
        // Check to see if there is a settings.json file in the folder
        // If there is then use that instead of the passed in settings
        const settingsFile = path_1.default.join(e.folder, 'settings.json');
        if (await promises_1.default.stat(settingsFile).then(() => true).catch(() => false)) {
            const settingsData = JSON.parse(await promises_1.default.readFile(settingsFile, 'utf-8'));
            if (settingsData.x !== undefined)
                region.x = +settingsData.x;
            if (settingsData.y !== undefined)
                region.y = +settingsData.y;
            if (settingsData.width !== undefined)
                region.width = +settingsData.width;
            if (settingsData.height !== undefined)
                region.height = +settingsData.height;
            console.log(`   ⚙️  Using settings from ${e.folder}/${settingsFile}: ${JSON.stringify(region)}`);
        }
        for (const f of imageFiles) {
            const fp = path_1.default.join(e.folder, f);
            try {
                await saveRegionPreview(fp, region);
                await deleteFile(fp);
                process.stdout.write('.');
            }
            catch (err) {
                console.error(`\n❌ Error extracting ${fp}:`, err);
            }
        }
        console.log(`\n✅ Done extract for folder: ${e.folder}`);
    }
    console.log(`\n✅ All done!`);
}
// ANALYZE commands
async function analyzeBatch(settings) {
    const entries = JSON.parse(await promises_1.default.readFile(settings, 'utf-8'));
    console.log(`Action: 🔎 Analyzing batch with ${entries.length} folders`);
    for (const e of entries) {
        const folder = e.folder;
        const files = await promises_1.default.readdir(folder);
        // Include sky_ prefixes for PNG/JPG
        const skies = files.filter(f => /^sky_.*\.(png|jpe?g)$/i.test(f));
        const results = [];
        console.log(`🔎 Processing folder: ${folder}, ${skies.length} files`);
        for (const f of skies) {
            try {
                const avg = await computeAverage(path_1.default.join(folder, f));
                results.push({ file: f, average: avg });
                process.stdout.write('+');
            }
            catch (err) {
                console.error(`\n❌ Error analyzing ${f}:`, err);
            }
        }
        await promises_1.default.writeFile(path_1.default.join(folder, 'output.json'), JSON.stringify(results, null, 2));
        await saveSvgBlocks(folder, results);
        console.log(`\n✅ Wrote ${results.length} records and output.svg for ${folder}`);
    }
}
function main() {
    // CLI setup
    printVersion();
    (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .command('extract', 'Extract sky regions and delete originals', yargs => yargs
        .option('file', { type: 'string', describe: 'Single image file to extract (PNG/JPG)' })
        .option('x', { type: 'number', describe: 'X coordinate' })
        .option('y', { type: 'number', describe: 'Y coordinate' })
        .option('width', { type: 'number', describe: 'Region width' })
        .option('height', { type: 'number', describe: 'Region height' })
        .option('settings', { type: 'string', describe: 'Path to settings JSON' })
        .check(argv => {
        if (argv.settings)
            return true;
        for (const opt of ['file', 'x', 'y', 'width', 'height']) {
            if (argv[opt] === undefined)
                throw new Error(`--${opt} required`);
        }
        return true;
    }), async (argv) => {
        if (argv.settings)
            await extractBatch(argv.settings);
        else
            await extractSingle(argv.file, { x: argv.x, y: argv.y, width: argv.width, height: argv.height });
    })
        .command('analyze', 'Compute averages and update outputs', yargs => yargs.option('settings', { type: 'string', demandOption: true, describe: 'Path to settings JSON' }), async (argv) => {
        await analyzeBatch(argv.settings);
    })
        .demandCommand(1)
        .help()
        .parse();
}
main();
// End of file
