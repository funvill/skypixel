import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Deletes a file if it exists.
 */
async function deleteFile(filePath: string) {
  try { await fs.unlink(filePath); } catch {}
}


/**
 * Computes average color of the entire image file.
 */
async function computeAverage(filePath: string) {
  const { data, info } = await sharp(filePath)
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
async function saveSvgBlocks(folder: string, results: { file: string; average: any }[]) {
  const block = 10;
  const cols = Math.min(10, results.length);
  const rows = Math.ceil(results.length / cols);
  const svgParts = [`<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${cols*block}\" height=\"${rows*block}\">`];

  results.forEach((r, i) => {
    const { r: R, g, b, a } = r.average;
    const x = (i % cols) * block;
    const y = Math.floor(i / cols) * block;
    const fill = a !== undefined
      ? `rgba(${R},${g},${b},${(a/255).toFixed(2)})`
      : `rgb(${R},${g},${b})`;
    svgParts.push(`<rect x=\"${x}\" y=\"${y}\" width=\"${block}\" height=\"${block}\" fill=\"${fill}\"/>`);
  });

  svgParts.push('</svg>');
  await fs.writeFile(path.join(folder, 'output.svg'), svgParts.join(''));
}


/**
 * Processes all subfolders under a root directory for analysis.
 */
export async function processAnalyze(root: string, clearOutput: boolean) {
  console.log(`\n🔎 Analyzing sky images in folders under ${root}` + (clearOutput ? ' (clearing existing output)' : '') + `\n`);

  const subdirs = await fs.readdir(root);
  for (const name of subdirs) {
    const folder = path.join(root, name);
    const stat = await fs.stat(folder).catch(() => null);
    if (!stat || !stat.isDirectory()) continue;

    console.log(`🔎 Analyzing ${folder}`);
    const outputPath = path.join(folder, 'output.json');
    let existing: { file: string; average: any }[] = [];
    if (clearOutput) {
      await deleteFile(outputPath);      
    } else {
      const exists = await fs.stat(outputPath).then(() => true).catch(() => false);
      if (exists) {
        existing = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
      }
    }

    const files = await fs.readdir(folder);
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
        const avg = await computeAverage(path.join(folder, f));
        results.push({ file: f, average: avg });
        process.stdout.write('+');
      } catch (err) {
        console.error(`\n❌ Error analyzing ${f}:`, err);
      }
    }

    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    await saveSvgBlocks(folder, results);
    console.log(`\n   ✅ Wrote ${results.length} records to output.json and output.svg for ${folder}\n`);
  }
}