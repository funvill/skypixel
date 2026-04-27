#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { generateSkyColor } from './colorModel';
import { ProgressBar } from './progress';
import { inferProjectFolderFromInput, loadProjectSettings, saveProjectSettings } from './settings';
import { renderSvgDayGrid } from './svgDayGrid';
import { renderSpiralSvg } from './svgSpiral';
import { endOfYear, expectedIntervals, formatLocalMinute, INTERVAL_MINUTES, startOfYear, addMinutes } from './time';
import { GeneratedRecord, GeneratorConfig } from './types';
import { validateDayGrid } from './validateDayGrid';
import { describeWeatherWindow, fetchWeather, prepareWeather, summarizeWeather, weatherAt } from './weather';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'location';
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function validateConfig(config: GeneratorConfig): void {
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

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

async function generateYear(config: GeneratorConfig): Promise<void> {
  validateConfig(config);

  const locationSlug = slugify(config.title);
  const outputFolder = path.join(config.outputRoot, locationSlug, String(config.year));
  await fs.mkdir(outputFolder, { recursive: true });
  const { settings } = await loadProjectSettings(outputFolder, {
    title: config.title,
    latitude: config.latitude,
    longitude: config.longitude,
    timezone: config.timezone,
    year: config.year
  });
  const location = settings.location;

  const start = startOfYear(location.year);
  const end = endOfYear(location.year);

  console.log(`Starting generation for ${location.title}`);
  console.log(`Location: ${location.latitude}, ${location.longitude} (${location.timezone})`);
  console.log(`Year: ${location.year}`);
  console.log(`Output: ${outputFolder}`);

  console.log('Fetching weather archive...');
  const weatherResult = await fetchWeather(outputFolder, location.latitude, location.longitude, location.timezone, start, end, settings.generator.weather);
  console.log(`Weather source: ${weatherResult.source}`);
  const weatherResponse = weatherResult.payload;
  const weatherWindow = describeWeatherWindow(weatherResponse);
  console.log(`Weather coverage: ${weatherWindow.start} -> ${weatherWindow.end}`);

  const preparedWeather = prepareWeather(weatherResponse);
  const total = expectedIntervals(location.year);
  const progress = new ProgressBar(total, 'Generating');

  const records: GeneratedRecord[] = [];
  let cursor = start;
  let processed = 0;

  while (true) {
    const timestamp = formatLocalMinute(cursor);
    const weather = weatherAt(preparedWeather, cursor, settings.generator.weather);
    if (!weather) {
      throw new Error(`No interpolated weather data available for ${timestamp}`);
    }

    const prediction = generateSkyColor(locationSlug, timestamp, cursor, weather, settings);
    records.push({
      timestamp,
      average: prediction.average,
      source: 'synthetic-weather',
      confidence: prediction.confidence,
      weather: summarizeWeather(weather)
    });

    processed++;
    progress.update(processed);

    if (processed % 20000 === 0) {
      progress.log(`Progress milestone: ${processed}/${total}`);
    }

    if (timestamp === formatLocalMinute(end)) {
      break;
    }

    cursor = addMinutes(cursor, INTERVAL_MINUTES);
  }

  if (records.length !== total) {
    throw new Error(`Expected ${total} records but generated ${records.length}`);
  }

  await saveProjectSettings(outputFolder, settings);

  const outputPath = path.join(outputFolder, 'sky-color-data.json');
  await writeJson(outputPath, records);

  console.log(`Wrote ${records.length} records to ${outputPath}`);
}

void yargs(hideBin(process.argv))
  .scriptName('fake-sky')
  .command(
    'generate',
    'Generate synthetic sky colors for a location and year',
    command => command
      .option('title', { type: 'string', demandOption: true, describe: 'Location title' })
      .option('latitude', { type: 'number', demandOption: true, describe: 'Latitude in decimal degrees' })
      .option('longitude', { type: 'number', demandOption: true, describe: 'Longitude in decimal degrees' })
      .option('timezone', { type: 'string', demandOption: true, describe: 'IANA timezone, for example America/Vancouver' })
      .option('year', { type: 'number', demandOption: true, describe: 'Four-digit year to generate' })
      .option('outputRoot', { type: 'string', default: path.join(process.cwd(), 'output'), describe: 'Root output folder' }),
    async argv => {
      try {
        await generateYear({
          title: argv.title as string,
          latitude: argv.latitude as number,
          longitude: argv.longitude as number,
          timezone: argv.timezone as string,
          year: argv.year as number,
          outputRoot: argv.outputRoot as string
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    }
  )
  .command(
    'svg',
    'Render a day-grid SVG from generated fake sky JSON',
    command => command
      .option('input', { type: 'string', demandOption: true, describe: 'Path to sky-color-data.json' })
      .option('output', { type: 'string', describe: 'Path to output SVG file' })
      .option('boxSize', { type: 'number', describe: 'Size of each 5-minute cell in pixels. Defaults to settings.json value.' }),
    async argv => {
      try {
        const projectFolder = inferProjectFolderFromInput(argv.input as string);
        const { settings } = await loadProjectSettings(projectFolder);
        await renderSvgDayGrid({
          inputFile: argv.input as string,
          outputFile: argv.output as string | undefined,
          boxSize: argv.boxSize as number | undefined,
          settings
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    }
  )
  .command(
    'validate-grid',
    'Compare a fake day-grid SVG against a real day-grid SVG and write a validation report',
    command => command
      .option('fake', { type: 'string', demandOption: true, describe: 'Path to the generated fake day-grid SVG' })
      .option('real', { type: 'string', demandOption: true, describe: 'Path to the real day-grid SVG' })
      .option('output', { type: 'string', describe: 'Path to the output validation report JSON' }),
    async argv => {
      try {
        await validateDayGrid(
          argv.fake as string,
          argv.real as string,
          argv.output as string | undefined
        );
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    }
  )
  .command(
    'spiral',
    'Render a spiral SVG from generated fake sky JSON using a parent layout',
    command => command
      .option('input', { type: 'string', demandOption: true, describe: 'Path to sky-color-data.json' })
      .option('output', { type: 'string', describe: 'Path to output SVG file' })
      .option('pattern', { type: 'string', choices: ['even', 'vogel'] as const, describe: 'Spiral layout to use. Defaults to settings.json value.' }),
    async argv => {
      try {
        const projectFolder = inferProjectFolderFromInput(argv.input as string);
        const { settings } = await loadProjectSettings(projectFolder);
        await renderSpiralSvg({
          inputFile: argv.input as string,
          outputFile: argv.output as string | undefined,
          pattern: argv.pattern as 'even' | 'vogel' | undefined,
          settings
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    }
  )
  .demandCommand(1)
  .strict()
  .help()
  .parse();