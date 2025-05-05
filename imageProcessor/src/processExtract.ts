import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Deletes a file if it exists.
 */
async function deleteFile(filePath: string) {
  try { await fs.unlink(filePath); } catch {}
}


/**
 * Extracts a sky region and saves to 'sky_' prefixed file.
 */
async function saveRegionPreview(filePath: string, region: Region) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const outName = `sky_${base}`;
  await sharp(filePath)
    .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
    .toFile(path.join(dir, outName));
}

/**
 * Processes all subfolders under a root directory for extraction.
 */
export async function processExtract(root: string, noDelete: boolean) {
  console.log(`\n🔎 Extracting sky from folders under ${root}` + (noDelete ? ' (no delete)' : '') + `\n`);

  const subdirs = await fs.readdir(root);
  const skipped: string[] = [];
  for (const name of subdirs) {
    const folder = path.join(root, name);
    const stat = await fs.stat(folder).catch(() => null);
    if (!stat || !stat.isDirectory()) continue;

    const settingsFile = path.join(folder, 'settings.json');
    const hasSettings = await fs.stat(settingsFile).then(() => true).catch(() => false);
    if (!hasSettings) {
      skipped.push(folder);
      console.log(`⚠️  Skipping ${folder}: no settings.json`);
      continue;
    }
    const s = JSON.parse(await fs.readFile(settingsFile, 'utf-8'));
    if (s.x === undefined || s.y === undefined || s.width === undefined || s.height === undefined) {
      console.log(`⚠️  Skipping ${folder}: incomplete settings.json`);
      continue;
    }
    const region: Region = { x: +s.x, y: +s.y, width: +s.width, height: +s.height };
    console.log(`🔎 Extracting sky for ${folder} using settings ${JSON.stringify(region)}`);

    const files = await fs.readdir(folder);
    const images = files.filter(f => /\.(png|jpe?g)$/i.test(f) && !/^sky_/i.test(f));
    if (images.length === 0) {
      console.log(`   ⚠️  No images to extract in ${folder}`);
      continue;
    }

    process.stdout.write(`   📄 Found ${images.length} images to extract `);
    for (const f of images) {
      const fp = path.join(folder, f);
      try {
        await saveRegionPreview(fp, region);
        if (!noDelete) await deleteFile(fp);
        process.stdout.write('.');
      } catch (err) {
        console.error(`\n❌ Error extracting ${fp}:`, err);
      }
    }
    console.log(`\n   ✅ Done extract for ${folder}\n`);
  }

  console.log(`\n✅ Done extracting from all folders\n`);
  if (skipped.length) console.log(`Skipped folders (no valid settings):\n${skipped.join('\n')}`);
}