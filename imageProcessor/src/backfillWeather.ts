import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { BackfillRecord, AverageColor, formatLocalMinute, loadObservedRecords, parseOutputFileDate } from './data';

interface CameraSettings {
  title?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface WeatherResponse {
  timezone: string;
  hourly: {
    time: string[];
    temperature_2m: Array<number | null>;
    relative_humidity_2m: Array<number | null>;
    cloud_cover: Array<number | null>;
    precipitation: Array<number | null>;
    rain: Array<number | null>;
    snowfall: Array<number | null>;
    shortwave_radiation: Array<number | null>;
    weather_code: Array<number | null>;
    visibility: Array<number | null>;
    wind_speed_10m: Array<number | null>;
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

interface PreparedWeather {
  raw: WeatherResponse;
  hourlyDates: Date[];
  dayIndex: Map<string, number>;
}

interface WeatherAtTime {
  weatherCode: number;
  cloudCover: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  shortwaveRadiation: number;
  temperature: number;
  humidity: number;
  visibility: number;
  windSpeed: number;
  solarPhase: number;
  daylightRatio: number;
}

interface TrainingSample {
  date: Date;
  average: AverageColor;
  weather: WeatherAtTime;
}

interface TrainingIndex {
  buckets: Map<string, TrainingSample[]>;
  fallback: TrainingSample[];
}

const WEATHER_FILE = 'weather.open-meteo.json';
const BACKFILL_FILE = 'backfill.json';
const INTERVAL_MINUTES = 5;
const MATCH_TOLERANCE_MS = 2 * 60 * 1000;
const HOURLY_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'cloud_cover',
  'precipitation',
  'rain',
  'snowfall',
  'shortwave_radiation',
  'weather_code',
  'visibility',
  'wind_speed_10m'
].join(',');

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function parseIsoMinute(value: string): Date {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function roundColor(color: AverageColor): AverageColor {
  return {
    r: Math.round(clamp(color.r, 0, 255)),
    g: Math.round(clamp(color.g, 0, 255)),
    b: Math.round(clamp(color.b, 0, 255))
  };
}

function deterministicNoise(seed: string): number {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const value = hash.readUInt32BE(0) / 0xffffffff;
  return value * 2 - 1;
}

function getGapBoundaries(observedByKey: Map<string, TrainingSample>, targetDate: Date, intervalMs: number) {
  let previous: TrainingSample | null = null;
  let next: TrainingSample | null = null;

  for (let cursor = targetDate.getTime() - intervalMs; cursor >= targetDate.getTime() - intervalMs * 72; cursor -= intervalMs) {
    const candidate = observedByKey.get(formatLocalMinute(new Date(cursor)));
    if (candidate) {
      previous = candidate;
      break;
    }
  }

  for (let cursor = targetDate.getTime() + intervalMs; cursor <= targetDate.getTime() + intervalMs * 72; cursor += intervalMs) {
    const candidate = observedByKey.get(formatLocalMinute(new Date(cursor)));
    if (candidate) {
      next = candidate;
      break;
    }
  }

  return { previous, next };
}

function computeSolarPhase(date: Date, sunrise: Date, sunset: Date): { solarPhase: number; daylightRatio: number } {
  const timestamp = date.getTime();
  const sunriseTime = sunrise.getTime();
  const sunsetTime = sunset.getTime();

  if (timestamp <= sunriseTime) {
    const minutesToSunrise = (sunriseTime - timestamp) / 60000;
    return {
      solarPhase: clamp(-minutesToSunrise / 90, -1, 0),
      daylightRatio: 0
    };
  }

  if (timestamp >= sunsetTime) {
    const minutesFromSunset = (timestamp - sunsetTime) / 60000;
    return {
      solarPhase: clamp(minutesFromSunset / 90, 0, 1),
      daylightRatio: 0
    };
  }

  const daylightRatio = (timestamp - sunriseTime) / Math.max(1, sunsetTime - sunriseTime);
  return {
    solarPhase: daylightRatio * 2 - 1,
    daylightRatio
  };
}

function featureDistance(left: WeatherAtTime, right: WeatherAtTime): number {
  const weatherPenalty = left.weatherCode === right.weatherCode ? 0 : 0.75;
  return (
    weatherPenalty +
    Math.abs(left.cloudCover - right.cloudCover) / 100 +
    Math.abs(left.shortwaveRadiation - right.shortwaveRadiation) / 700 +
    Math.abs(left.temperature - right.temperature) / 20 +
    Math.abs(left.humidity - right.humidity) / 100 +
    Math.abs(left.precipitation - right.precipitation) / 4 +
    Math.abs(left.windSpeed - right.windSpeed) / 60 +
    Math.abs(left.solarPhase - right.solarPhase) * 1.5 +
    Math.abs(left.daylightRatio - right.daylightRatio)
  );
}

function phaseBucket(weather: WeatherAtTime): string {
  if (weather.daylightRatio === 0 && weather.solarPhase < 0) return 'pre-dawn';
  if (weather.daylightRatio === 0 && weather.solarPhase >= 0) return 'night';
  if (weather.daylightRatio < 0.18) return weather.solarPhase < 0 ? 'sunrise' : 'sunset';
  if (weather.daylightRatio > 0.82) return weather.solarPhase < 0 ? 'sunrise' : 'sunset';
  return 'day';
}

function cloudBucket(value: number): number {
  return Math.max(0, Math.min(4, Math.floor(value / 20)));
}

function buildBucketKey(weather: WeatherAtTime): string {
  const weatherBand = weather.weatherCode >= 60 ? 'wet' : weather.weatherCode >= 45 ? 'mist' : 'dry';
  return [phaseBucket(weather), weatherBand, cloudBucket(weather.cloudCover)].join('|');
}

function createTrainingIndex(training: TrainingSample[]): TrainingIndex {
  const buckets = new Map<string, TrainingSample[]>();
  for (const sample of training) {
    const key = buildBucketKey(sample.weather);
    const list = buckets.get(key);
    if (list) list.push(sample);
    else buckets.set(key, [sample]);
  }

  const maxFallback = 1800;
  const step = Math.max(1, Math.ceil(training.length / maxFallback));
  const fallback = training.filter((_, index) => index % step === 0);
  return { buckets, fallback };
}

function getCandidatePool(index: TrainingIndex, weather: WeatherAtTime): TrainingSample[] {
  const primaryKey = buildBucketKey(weather);
  const primary = index.buckets.get(primaryKey) ?? [];
  if (primary.length >= 24) return primary;

  const candidates = [...primary];
  for (const delta of [-1, 1]) {
    const adjacentCloud = cloudBucket(weather.cloudCover) + delta;
    if (adjacentCloud < 0 || adjacentCloud > 4) continue;

    const neighboringKey = [
      phaseBucket(weather),
      weather.weatherCode >= 60 ? 'wet' : weather.weatherCode >= 45 ? 'mist' : 'dry',
      adjacentCloud
    ].join('|');
    const neighboring = index.buckets.get(neighboringKey);
    if (neighboring) candidates.push(...neighboring);
  }

  if (candidates.length >= 24) return candidates;
  return index.fallback;
}

function blendBoundaryColor(previous: TrainingSample | null, next: TrainingSample | null, targetDate: Date, predicted: AverageColor): AverageColor {
  if (!previous && !next) return predicted;
  if (!previous) return next!.average;
  if (!next) return previous.average;

  const span = Math.max(1, next.date.getTime() - previous.date.getTime());
  const ratio = clamp((targetDate.getTime() - previous.date.getTime()) / span, 0, 1);

  return {
    r: lerp(previous.average.r, next.average.r, ratio),
    g: lerp(previous.average.g, next.average.g, ratio),
    b: lerp(previous.average.b, next.average.b, ratio)
  };
}

function predictColor(cameraKey: string, targetDate: Date, targetWeather: WeatherAtTime, trainingIndex: TrainingIndex, previous: TrainingSample | null, next: TrainingSample | null): { average: AverageColor; confidence: number } {
  const candidatePool = getCandidatePool(trainingIndex, targetWeather);
  const nearest = candidatePool
    .map(sample => ({ sample, distance: featureDistance(targetWeather, sample.weather) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 8);

  if (nearest.length === 0) {
    const fallback = blendBoundaryColor(previous, next, targetDate, { r: 127, g: 127, b: 127 });
    return { average: roundColor(fallback), confidence: 0.1 };
  }

  let weightTotal = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const neighbor of nearest) {
    const weight = 1 / Math.max(0.15, neighbor.distance);
    weightTotal += weight;
    red += neighbor.sample.average.r * weight;
    green += neighbor.sample.average.g * weight;
    blue += neighbor.sample.average.b * weight;
  }

  const predicted = {
    r: red / weightTotal,
    g: green / weightTotal,
    b: blue / weightTotal
  };

  const boundary = blendBoundaryColor(previous, next, targetDate, predicted);
  const hasTwoBoundaries = !!previous && !!next;
  const mix = hasTwoBoundaries ? 0.55 : 0.2;
  const blended = {
    r: lerp(predicted.r, boundary.r, mix),
    g: lerp(predicted.g, boundary.g, mix),
    b: lerp(predicted.b, boundary.b, mix)
  };

  const varianceBase = nearest.reduce((sum, neighbor) => {
    return sum + Math.abs(neighbor.sample.average.r - predicted.r) + Math.abs(neighbor.sample.average.g - predicted.g) + Math.abs(neighbor.sample.average.b - predicted.b);
  }, 0) / (nearest.length * 3);
  const jitterScale = clamp(varianceBase * (hasTwoBoundaries ? 0.12 : 0.2), 0, 18);

  const jittered = {
    r: blended.r + deterministicNoise(`${cameraKey}:${formatLocalMinute(targetDate)}:r`) * jitterScale,
    g: blended.g + deterministicNoise(`${cameraKey}:${formatLocalMinute(targetDate)}:g`) * jitterScale,
    b: blended.b + deterministicNoise(`${cameraKey}:${formatLocalMinute(targetDate)}:b`) * jitterScale
  };

  const averageDistance = nearest.reduce((sum, neighbor) => sum + neighbor.distance, 0) / nearest.length;
  const confidence = clamp(1 - averageDistance / 4 - (hasTwoBoundaries ? 0 : 0.15), 0.15, 0.95);

  return { average: roundColor(jittered), confidence: Number(confidence.toFixed(2)) };
}

function interpolateNumeric(values: Array<number | null>, index: number, ratio: number): number {
  const start = values[index] ?? values[index + 1] ?? 0;
  const end = values[index + 1] ?? start;
  return lerp(start, end, ratio);
}

function prepareWeather(weather: WeatherResponse): PreparedWeather {
  return {
    raw: weather,
    hourlyDates: weather.hourly.time.map(parseIsoMinute),
    dayIndex: new Map(weather.daily.time.map((value, index) => [value, index]))
  };
}

function weatherAt(weather: PreparedWeather, date: Date): WeatherAtTime | null {
  if (!weather.raw.hourly.time.length) return null;

  const targetTime = date.getTime();
  let index = 0;
  while (index < weather.hourlyDates.length - 2 && weather.hourlyDates[index + 1].getTime() <= targetTime) {
    index++;
  }

  const start = weather.hourlyDates[index];
  const end = weather.hourlyDates[Math.min(index + 1, weather.hourlyDates.length - 1)];
  const span = Math.max(1, end.getTime() - start.getTime());
  const ratio = clamp((targetTime - start.getTime()) / span, 0, 1);

  const dayKey = formatLocalMinute(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0)).slice(0, 10);
  const dayIndex = weather.dayIndex.get(dayKey);
  if (dayIndex === undefined) return null;

  const sunrise = parseIsoMinute(weather.raw.daily.sunrise[dayIndex]);
  const sunset = parseIsoMinute(weather.raw.daily.sunset[dayIndex]);
  const { solarPhase, daylightRatio } = computeSolarPhase(date, sunrise, sunset);

  return {
    weatherCode: Math.round(interpolateNumeric(weather.raw.hourly.weather_code, index, ratio)),
    cloudCover: interpolateNumeric(weather.raw.hourly.cloud_cover, index, ratio),
    precipitation: interpolateNumeric(weather.raw.hourly.precipitation, index, ratio),
    rain: interpolateNumeric(weather.raw.hourly.rain, index, ratio),
    snowfall: interpolateNumeric(weather.raw.hourly.snowfall, index, ratio),
    shortwaveRadiation: interpolateNumeric(weather.raw.hourly.shortwave_radiation, index, ratio),
    temperature: interpolateNumeric(weather.raw.hourly.temperature_2m, index, ratio),
    humidity: interpolateNumeric(weather.raw.hourly.relative_humidity_2m, index, ratio),
    visibility: interpolateNumeric(weather.raw.hourly.visibility, index, ratio),
    windSpeed: interpolateNumeric(weather.raw.hourly.wind_speed_10m, index, ratio),
    solarPhase,
    daylightRatio
  };
}

async function fetchWeather(folder: string, settings: CameraSettings, startDate: Date, endDate: Date): Promise<WeatherResponse> {
  const weatherPath = path.join(folder, WEATHER_FILE);
  const cachedExists = await fs.stat(weatherPath).then(() => true).catch(() => false);
  if (cachedExists) {
    const cached = JSON.parse(await fs.readFile(weatherPath, 'utf-8')) as WeatherResponse;
    if (cached?.hourly?.time?.length && cached?.daily?.time?.length) {
      return cached;
    }
  }

  const params = new URLSearchParams({
    latitude: `${settings.latitude}`,
    longitude: `${settings.longitude}`,
    timezone: settings.timezone ?? 'auto',
    start_date: formatLocalMinute(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0)).slice(0, 10),
    end_date: formatLocalMinute(new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0)).slice(0, 10),
    hourly: HOURLY_FIELDS,
    daily: 'sunrise,sunset'
  });

  const url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed with ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as WeatherResponse;
  await fs.writeFile(weatherPath, JSON.stringify(payload, null, 2));
  return payload;
}

export async function backfillWeather(folder: string) {
  const settingsPath = path.join(folder, 'settings.json');
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8')) as CameraSettings;
  if (settings.latitude === undefined || settings.longitude === undefined || !settings.timezone) {
    throw new Error(`Missing latitude/longitude/timezone in ${settingsPath}`);
  }

  const observedRecords = await loadObservedRecords(folder);
  const observedEntries = observedRecords
    .map(record => {
      const date = parseOutputFileDate(record.file);
      if (!date) return null;
      return { date, average: record.average };
    })
    .filter((entry): entry is { date: Date; average: AverageColor } => !!entry)
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (observedEntries.length < 24) {
    throw new Error('Not enough observed samples to build a weather backfill model.');
  }

  const start = observedEntries[0].date;
  const end = observedEntries[observedEntries.length - 1].date;
  const weather = prepareWeather(await fetchWeather(folder, settings, start, end));

  const training: TrainingSample[] = observedEntries
    .map(entry => {
      const sampleWeather = weatherAt(weather, entry.date);
      if (!sampleWeather) return null;
      return {
        date: entry.date,
        average: entry.average,
        weather: sampleWeather
      };
    })
    .filter((entry): entry is TrainingSample => !!entry);
  const trainingIndex = createTrainingIndex(training);

  const observedByKey = new Map(training.map(sample => [formatLocalMinute(sample.date), sample]));
  const observedKeys = new Set(observedEntries.map(entry => formatLocalMinute(entry.date)));
  const intervalMs = INTERVAL_MINUTES * 60 * 1000;
  const roundedStart = new Date(start);
  roundedStart.setMinutes(Math.floor(roundedStart.getMinutes() / INTERVAL_MINUTES) * INTERVAL_MINUTES, 0, 0);

  const backfill: BackfillRecord[] = [];
  for (let cursor = roundedStart.getTime(); cursor <= end.getTime(); cursor += intervalMs) {
    const targetDate = new Date(cursor);
    const key = formatLocalMinute(targetDate);
    const exactObserved = observedKeys.has(key);
    if (exactObserved) continue;

    const targetWeather = weatherAt(weather, targetDate);
    if (!targetWeather) continue;

    const { previous, next } = getGapBoundaries(observedByKey, targetDate, intervalMs);
    const prediction = predictColor(path.basename(folder), targetDate, targetWeather, trainingIndex, previous, next);

    backfill.push({
      timestamp: key,
      average: prediction.average,
      source: 'weather-backfill',
      confidence: prediction.confidence,
      weather: {
        weatherCode: targetWeather.weatherCode,
        cloudCover: Number(targetWeather.cloudCover.toFixed(2)),
        shortwaveRadiation: Number(targetWeather.shortwaveRadiation.toFixed(2)),
        temperature: Number(targetWeather.temperature.toFixed(2)),
        humidity: Number(targetWeather.humidity.toFixed(2)),
        precipitation: Number(targetWeather.precipitation.toFixed(2)),
        solarPhase: Number(targetWeather.solarPhase.toFixed(3)),
        daylightRatio: Number(targetWeather.daylightRatio.toFixed(3))
      }
    });
  }

  const backfillPath = path.join(folder, BACKFILL_FILE);
  await fs.writeFile(backfillPath, JSON.stringify(backfill, null, 2));
  console.log(`✅ Wrote ${backfill.length} synthetic records to ${backfillPath}`);
}
