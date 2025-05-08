#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const processExtract_1 = require("./processExtract");
const processAnalyze_1 = require("./processAnalyze");
const vogelSpiral_1 = require("./vogelSpiral");
const evenSpiral_1 = require("./evenSpiral");
const dayChart_1 = require("./dayChart");
const svgOutput_1 = require("./svgOutput");
const VERSION = 'v3.2 (2025-May-03)';
function printVersion() {
    console.log(`SkyPixel CLI\nVersion: ${VERSION}\n`);
}
/**
 * CLI entrypoint.
 */
function main() {
    printVersion();
    (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .command('extract <root>', 'Extract sky regions in each subfolder', yargs => yargs
        .positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' })
        .option('noDelete', { type: 'boolean', default: false, describe: 'Do not delete original images after extraction' }), async (argv) => {
        await (0, processExtract_1.processExtract)(argv.root, argv.noDelete);
    })
        .command('analyze <root>', 'Compute averages and update outputs in each subfolder', yargs => yargs
        .positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' })
        .option('clearOutput', { type: 'boolean', default: false, describe: 'Remove existing output.json before analyzing' }), async (argv) => {
        await (0, processAnalyze_1.processAnalyze)(argv.root, argv.clearOutput);
    })
        .command('generateVisuals <root>', 'Generate visualizations in each subfolder', yargs => yargs.positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' }), async (argv) => {
        await (0, evenSpiral_1.evenSpiral)(argv.root);
        await (0, vogelSpiral_1.vogelSpiral)(argv.root);
        await (0, dayChart_1.dayChart)(argv.root);
        await (0, svgOutput_1.svgOutput)(argv.root);
    })
        .demandCommand(1)
        .help()
        .parse();
}
main();
