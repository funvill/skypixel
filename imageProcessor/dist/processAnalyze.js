"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAnalyze = void 0;
const sharp_1 = __importDefault(require("sharp"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
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
 * Processes all subfolders under a root directory for analysis.
 */
async function processAnalyze(root, clearOutput) {
    console.log(`\n🔎 Analyzing sky images in folders under ${root}` + (clearOutput ? ' (clearing existing output)' : '') + `\n`);
    const subdirs = await promises_1.default.readdir(root);
    for (const name of subdirs) {
        const folder = path_1.default.join(root, name);
        const stat = await promises_1.default.stat(folder).catch(() => null);
        if (!stat || !stat.isDirectory())
            continue;
        console.log(`🔎 Analyzing ${folder}`);
        const outputPath = path_1.default.join(folder, 'output.json');
        let existing = [];
        if (clearOutput) {
            await deleteFile(outputPath);
        }
        else {
            const exists = await promises_1.default.stat(outputPath).then(() => true).catch(() => false);
            if (exists) {
                existing = JSON.parse(await promises_1.default.readFile(outputPath, 'utf-8'));
            }
        }
        const files = await promises_1.default.readdir(folder);
        const skies = files.filter(f => /^sky_.*\.(png|jpe?g)$/i.test(f));
        if (skies.length === 0) {
            console.log(`   ⚠️  No 'sky_' images in ${folder}`);
            continue;
        }
        const results = [...existing];
        const processed = new Set(existing.map(r => r.file));
        // remove the processed skies from the list
        const unprocessed = skies.filter(f => !processed.has(f));
        process.stdout.write(`   📄 Found ${unprocessed.length} images that need to be analyze `);
        for (const f of unprocessed) {
            try {
                const avg = await computeAverage(path_1.default.join(folder, f));
                results.push({ file: f, average: avg });
                process.stdout.write('+');
            }
            catch (err) {
                console.error(`\n❌ Error analyzing ${f}:`, err);
            }
        }
        await promises_1.default.writeFile(outputPath, JSON.stringify(results, null, 2));
        console.log(`\n   ✅ Wrote ${results.length} records to output.json for ${folder}\n`);
    }
}
exports.processAnalyze = processAnalyze;
