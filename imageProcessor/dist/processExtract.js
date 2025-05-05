"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processExtract = void 0;
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
 * Processes all subfolders under a root directory for extraction.
 */
async function processExtract(root, noDelete) {
    console.log(`\n🔎 Extracting sky from folders under ${root}` + (noDelete ? ' (no delete)' : '') + `\n`);
    const subdirs = await promises_1.default.readdir(root);
    const skipped = [];
    for (const name of subdirs) {
        const folder = path_1.default.join(root, name);
        const stat = await promises_1.default.stat(folder).catch(() => null);
        if (!stat || !stat.isDirectory())
            continue;
        const settingsFile = path_1.default.join(folder, 'settings.json');
        const hasSettings = await promises_1.default.stat(settingsFile).then(() => true).catch(() => false);
        if (!hasSettings) {
            skipped.push(folder);
            console.log(`⚠️  Skipping ${folder}: no settings.json`);
            continue;
        }
        const s = JSON.parse(await promises_1.default.readFile(settingsFile, 'utf-8'));
        if (s.x === undefined || s.y === undefined || s.width === undefined || s.height === undefined) {
            console.log(`⚠️  Skipping ${folder}: incomplete settings.json`);
            continue;
        }
        const region = { x: +s.x, y: +s.y, width: +s.width, height: +s.height };
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
                if (!noDelete)
                    await deleteFile(fp);
                process.stdout.write('.');
            }
            catch (err) {
                console.error(`\n❌ Error extracting ${fp}:`, err);
            }
        }
        console.log(`\n   ✅ Done extract for ${folder}\n`);
    }
    console.log(`\n✅ Done extracting from all folders\n`);
    if (skipped.length)
        console.log(`Skipped folders (no valid settings):\n${skipped.join('\n')}`);
}
exports.processExtract = processExtract;
