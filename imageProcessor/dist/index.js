#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
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
        const { processExtract } = await Promise.resolve().then(() => __importStar(require('./processExtract')));
        await processExtract(argv.root, argv.noDelete);
    })
        .command('analyze <root>', 'Compute averages and update outputs in each subfolder', yargs => yargs
        .positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' })
        .option('clearOutput', { type: 'boolean', default: false, describe: 'Remove existing output.json before analyzing' }), async (argv) => {
        const { processAnalyze } = await Promise.resolve().then(() => __importStar(require('./processAnalyze')));
        await processAnalyze(argv.root, argv.clearOutput);
    })
        .command('generateVisuals <root>', 'Generate visualizations in each subfolder', yargs => yargs.positional('root', { type: 'string', describe: 'Path to root folder containing subfolders' }), async (argv) => {
        const { evenSpiral } = await Promise.resolve().then(() => __importStar(require('./evenSpiral')));
        const { vogelSpiral } = await Promise.resolve().then(() => __importStar(require('./vogelSpiral')));
        const { dayChart } = await Promise.resolve().then(() => __importStar(require('./dayChart')));
        const { svgOutput } = await Promise.resolve().then(() => __importStar(require('./svgOutput')));
        await evenSpiral(argv.root);
        await vogelSpiral(argv.root);
        await dayChart(argv.root);
        await svgOutput(argv.root);
    })
        .command('generateVisualsOne <folder>', 'Generate visualizations for a single camera folder', yargs => yargs.positional('folder', { type: 'string', describe: 'Path to one camera folder containing output.json' }), async (argv) => {
        const { evenSpiralFolder } = await Promise.resolve().then(() => __importStar(require('./evenSpiral')));
        const { vogelSpiralFolder } = await Promise.resolve().then(() => __importStar(require('./vogelSpiral')));
        const { dayChartFolder } = await Promise.resolve().then(() => __importStar(require('./dayChart')));
        const { svgOutputFolder } = await Promise.resolve().then(() => __importStar(require('./svgOutput')));
        await evenSpiralFolder(argv.folder);
        await vogelSpiralFolder(argv.folder);
        await dayChartFolder(argv.folder);
        await svgOutputFolder(argv.folder);
    })
        .command('backfill <folder>', 'Generate weather-based synthetic samples for a single camera folder', yargs => yargs.positional('folder', { type: 'string', describe: 'Path to one camera folder containing settings.json and output.json' }), async (argv) => {
        const { backfillWeather } = await Promise.resolve().then(() => __importStar(require('./backfillWeather')));
        await backfillWeather(argv.folder);
    })
        .demandCommand(1)
        .help()
        .parse();
}
main();
