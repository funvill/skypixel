#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const colorModel_1 = require("./colorModel");
const progress_1 = require("./progress");
const settings_1 = require("./settings");
const svgDayGrid_1 = require("./svgDayGrid");
const svgSpiral_1 = require("./svgSpiral");
const time_1 = require("./time");
const validateDayGrid_1 = require("./validateDayGrid");
const weather_1 = require("./weather");
function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'location';
}
function assertFiniteNumber(value, label) {
    if (!Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number.`);
    }
}
function validateConfig(config) {
    if (!config.title.trim()) {
        throw new Error('title is required.');
    }
    assertFiniteNumber(config.latitude, 'latitude');
    assertFiniteNumber(config.longitude, 'longitude');
    if (config.latitude < -90 || config.latitude > 90) {
        throw new Error('latitude must be between -90 and 90.');
    }
    if (config.longitude < -180 || config.longitude > 180) {
        throw new Error('longitude must be between -180 and 180.');
    }
    if (!config.timezone.trim()) {
        throw new Error('timezone is required.');
    }
    if (!Number.isInteger(config.year) || config.year < 2000 || config.year > 2100) {
        throw new Error('year must be an integer between 2000 and 2100.');
    }
}
async function writeJson(filePath, value) {
    await promises_1.default.writeFile(filePath, JSON.stringify(value, null, 2));
}
async function generateYear(config) {
    validateConfig(config);
    const locationSlug = slugify(config.title);
    const outputFolder = path_1.default.join(config.outputRoot, locationSlug, String(config.year));
    await promises_1.default.mkdir(outputFolder, { recursive: true });
    const { settings } = await (0, settings_1.loadProjectSettings)(outputFolder, {
        title: config.title,
        latitude: config.latitude,
        longitude: config.longitude,
        timezone: config.timezone,
        year: config.year
    });
    const location = settings.location;
    const start = (0, time_1.startOfYear)(location.year);
    const end = (0, time_1.endOfYear)(location.year);
    console.log(`Starting generation for ${location.title}`);
    console.log(`Location: ${location.latitude}, ${location.longitude} (${location.timezone})`);
    console.log(`Year: ${location.year}`);
    console.log(`Output: ${outputFolder}`);
    console.log('Fetching weather archive...');
    const weatherResult = await (0, weather_1.fetchWeather)(outputFolder, location.latitude, location.longitude, location.timezone, start, end, settings.generator.weather);
    console.log(`Weather source: ${weatherResult.source}`);
    const weatherResponse = weatherResult.payload;
    const weatherWindow = (0, weather_1.describeWeatherWindow)(weatherResponse);
    console.log(`Weather coverage: ${weatherWindow.start} -> ${weatherWindow.end}`);
    const preparedWeather = (0, weather_1.prepareWeather)(weatherResponse);
    const total = (0, time_1.expectedIntervals)(location.year);
    const progress = new progress_1.ProgressBar(total, 'Generating');
    const records = [];
    let cursor = start;
    let processed = 0;
    while (true) {
        const timestamp = (0, time_1.formatLocalMinute)(cursor);
        const weather = (0, weather_1.weatherAt)(preparedWeather, cursor, settings.generator.weather);
        if (!weather) {
            throw new Error(`No interpolated weather data available for ${timestamp}`);
        }
        const prediction = (0, colorModel_1.generateSkyColor)(locationSlug, timestamp, cursor, weather, settings);
        records.push({
            timestamp,
            average: prediction.average,
            source: 'synthetic-weather',
            confidence: prediction.confidence,
            weather: (0, weather_1.summarizeWeather)(weather)
        });
        processed++;
        progress.update(processed);
        if (processed % 20000 === 0) {
            progress.log(`Progress milestone: ${processed}/${total}`);
        }
        if (timestamp === (0, time_1.formatLocalMinute)(end)) {
            break;
        }
        cursor = (0, time_1.addMinutes)(cursor, time_1.INTERVAL_MINUTES);
    }
    if (records.length !== total) {
        throw new Error(`Expected ${total} records but generated ${records.length}`);
    }
    await (0, settings_1.saveProjectSettings)(outputFolder, settings);
    const outputPath = path_1.default.join(outputFolder, 'sky-color-data.json');
    await writeJson(outputPath, records);
    console.log(`Wrote ${records.length} records to ${outputPath}`);
}
void (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .scriptName('fake-sky')
    .command('generate', 'Generate synthetic sky colors for a location and year', command => command
    .option('title', { type: 'string', demandOption: true, describe: 'Location title' })
    .option('latitude', { type: 'number', demandOption: true, describe: 'Latitude in decimal degrees' })
    .option('longitude', { type: 'number', demandOption: true, describe: 'Longitude in decimal degrees' })
    .option('timezone', { type: 'string', demandOption: true, describe: 'IANA timezone, for example America/Vancouver' })
    .option('year', { type: 'number', demandOption: true, describe: 'Four-digit year to generate' })
    .option('outputRoot', { type: 'string', default: path_1.default.join(process.cwd(), 'output'), describe: 'Root output folder' }), async (argv) => {
    try {
        await generateYear({
            title: argv.title,
            latitude: argv.latitude,
            longitude: argv.longitude,
            timezone: argv.timezone,
            year: argv.year,
            outputRoot: argv.outputRoot
        });
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
})
    .command('svg', 'Render a day-grid SVG from generated fake sky JSON', command => command
    .option('input', { type: 'string', demandOption: true, describe: 'Path to sky-color-data.json' })
    .option('output', { type: 'string', describe: 'Path to output SVG file' })
    .option('boxSize', { type: 'number', describe: 'Size of each 5-minute cell in pixels. Defaults to settings.json value.' }), async (argv) => {
    try {
        const projectFolder = (0, settings_1.inferProjectFolderFromInput)(argv.input);
        const { settings } = await (0, settings_1.loadProjectSettings)(projectFolder);
        await (0, svgDayGrid_1.renderSvgDayGrid)({
            inputFile: argv.input,
            outputFile: argv.output,
            boxSize: argv.boxSize,
            settings
        });
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
})
    .command('validate-grid', 'Compare a fake day-grid SVG against a real day-grid SVG and write a validation report', command => command
    .option('fake', { type: 'string', demandOption: true, describe: 'Path to the generated fake day-grid SVG' })
    .option('real', { type: 'string', demandOption: true, describe: 'Path to the real day-grid SVG' })
    .option('output', { type: 'string', describe: 'Path to the output validation report JSON' }), async (argv) => {
    try {
        await (0, validateDayGrid_1.validateDayGrid)(argv.fake, argv.real, argv.output);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
})
    .command('spiral', 'Render a spiral SVG from generated fake sky JSON using a parent layout', command => command
    .option('input', { type: 'string', demandOption: true, describe: 'Path to sky-color-data.json' })
    .option('output', { type: 'string', describe: 'Path to output SVG file' })
    .option('pattern', { type: 'string', choices: ['even', 'vogel'], describe: 'Spiral layout to use. Defaults to settings.json value.' }), async (argv) => {
    try {
        const projectFolder = (0, settings_1.inferProjectFolderFromInput)(argv.input);
        const { settings } = await (0, settings_1.loadProjectSettings)(projectFolder);
        await (0, svgSpiral_1.renderSpiralSvg)({
            inputFile: argv.input,
            outputFile: argv.output,
            pattern: argv.pattern,
            settings
        });
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
})
    .demandCommand(1)
    .strict()
    .help()
    .parse();
