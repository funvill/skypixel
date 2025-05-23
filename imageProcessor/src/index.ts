#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {processExtract} from './processExtract';
import {processAnalyze} from './processAnalyze';
import {vogelSpiral} from './vogelSpiral';
import {evenSpiral} from './evenSpiral';
import {dayChart} from './dayChart';
import {svgOutput} from './svgOutput';



const VERSION = 'v3.2 (2025-May-03)';

function printVersion() {
  console.log(`SkyPixel CLI\nVersion: ${VERSION}\n`);
}

/**
 * CLI entrypoint.
 */
function main() {
  printVersion();

  yargs(hideBin(process.argv))
    .command('extract <root>', 'Extract sky regions in each subfolder', yargs =>
      yargs
        .positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' })
        .option('noDelete', { type: 'boolean', default: false, describe: 'Do not delete original images after extraction' })
    , async argv => {
      await processExtract(argv.root as string, argv.noDelete as boolean);
    })
    .command('analyze <root>', 'Compute averages and update outputs in each subfolder', yargs =>
      yargs
        .positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' })
        .option('clearOutput', { type: 'boolean', default: false, describe: 'Remove existing output.json before analyzing' })
    , async argv => {
      await processAnalyze(argv.root as string, argv.clearOutput as boolean);
    })
    .command('generateVisuals <root>', 'Generate visualizations in each subfolder', yargs =>
      yargs.positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' })
    , async argv => {
      await evenSpiral(argv.root as string);
      await vogelSpiral(argv.root as string);
      await dayChart(argv.root as string);
      await svgOutput(argv.root as string);
      
      
    })    
    .demandCommand(1)
    .help()
    .parse();
}

main();