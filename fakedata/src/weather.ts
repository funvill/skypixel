import fs from 'fs/promises';
import path from 'path';

import { formatLocalDate, formatLocalMinute, parseIsoMinute, toTick } from './time';
import { GeneratorWeatherSettings, LocalDateTime, PreparedWeather, WeatherAtTime, WeatherResponse } from './types';

export interface WeatherFetchResult {
  payload: WeatherResponse;
  source: 'cache' | 'api';
}

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

function interpolateNumeric(values: Array<number | null>, index: number, ratio: number, fallback = 0): number {
  const start = values[index] ?? values[index + 1] ?? fallback;
  const end = values[index + 1] ?? start;
  return lerp(start, end, ratio);
}

function computeSolarPhase(date: LocalDateTime, sunrise: LocalDateTime, sunset: LocalDateTime, transitionMinutes: number): { solarPhase: number; daylightRatio: number; dayLengthMinutes: number; minutesFromSunrise: number; minutesToSunset: number } {
  const timestamp = toTick(date);
  const sunriseTick = toTick(sunrise);
  const sunsetTick = toTick(sunset);
  const dayLengthMinutes = Math.max(1, (sunsetTick - sunriseTick) / 60000);
  const minutesFromSunrise = (timestamp - sunriseTick) / 60000;
  const minutesToSunset = (sunsetTick - timestamp) / 60000;

  if (timestamp <= sunriseTick) {
    const minutesToSunrise = (sunriseTick - timestamp) / 60000;
    return {
      solarPhase: clamp(-minutesToSunrise / transitionMinutes, -1, 0),
      daylightRatio: 0,
      dayLengthMinutes,
      minutesFromSunrise,
      minutesToSunset
    };
  }

  if (timestamp >= sunsetTick) {
    const minutesFromSunset = (timestamp - sunsetTick) / 60000;
    return {
      solarPhase: clamp(minutesFromSunset / transitionMinutes, 0, 1),
      daylightRatio: 0,
      dayLengthMinutes,
      minutesFromSunrise,
      minutesToSunset
    };
  }

  const daylightRatio = (timestamp - sunriseTick) / Math.max(1, sunsetTick - sunriseTick);
  return {
    solarPhase: daylightRatio * 2 - 1,
    daylightRatio,
    dayLengthMinutes,
    minutesFromSunrise,
    minutesToSunset
  };
}

function validateWeatherPayload(payload: WeatherResponse): void {
  if (!payload.hourly?.time?.length) {
    throw new Error('Weather payload is missing hourly.time values.');
  }

  if (!payload.daily?.time?.length || !payload.daily?.sunrise?.length || !payload.daily?.sunset?.length) {
    throw new Error('Weather payload is missing daily sunrise and sunset values.');
  }
}

export async function fetchWeather(
  outputFolder: string,
  latitude: number,
  longitude: number,
  timezone: string,
  startDate: LocalDateTime,
  endDate: LocalDateTime,
  settings: GeneratorWeatherSettings
): Promise<WeatherFetchResult> {
  const weatherPath = path.join(outputFolder, 'weather.open-meteo.json');
  const exists = await fs.stat(weatherPath).then(() => true).catch(() => false);
  if (exists && settings.cachePolicy !== 'refresh') {
    const cached = JSON.parse(await fs.readFile(weatherPath, 'utf-8')) as WeatherResponse;
    validateWeatherPayload(cached);
    return { payload: cached, source: 'cache' };
  }

  const params = new URLSearchParams({
    latitude: `${latitude}`,
    longitude: `${longitude}`,
    timezone,
    start_date: formatLocalDate(startDate),
    end_date: formatLocalDate(endDate),
    hourly: HOURLY_FIELDS,
    daily: 'sunrise,sunset'
  });

  const url = `${settings.apiBaseUrl}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed with ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as WeatherResponse;
  validateWeatherPayload(payload);
  await fs.writeFile(weatherPath, JSON.stringify(payload, null, 2));
  return { payload, source: 'api' };
}

export function prepareWeather(weather: WeatherResponse): PreparedWeather {
  return {
    raw: weather,
    hourlyDates: weather.hourly.time.map(parseIsoMinute),
    hourlyTicks: weather.hourly.time.map(value => toTick(parseIsoMinute(value))),
    dayIndex: new Map(weather.daily.time.map((value, index) => [value, index]))
  };
}

export function weatherAt(weather: PreparedWeather, date: LocalDateTime, settings: GeneratorWeatherSettings): WeatherAtTime | null {
  if (!weather.raw.hourly.time.length) {
    return null;
  }

  const targetTick = toTick(date);
  let index = 0;
  while (index < weather.hourlyTicks.length - 2 && weather.hourlyTicks[index + 1] <= targetTick) {
    index++;
  }

  const start = weather.hourlyTicks[index];
  const end = weather.hourlyTicks[Math.min(index + 1, weather.hourlyTicks.length - 1)];
  const span = Math.max(1, end - start);
  const ratio = clamp((targetTick - start) / span, 0, 1);

  const dayIndex = weather.dayIndex.get(formatLocalDate(date));
  if (dayIndex === undefined) {
    return null;
  }

  const sunrise = parseIsoMinute(weather.raw.daily.sunrise[dayIndex]);
  const sunset = parseIsoMinute(weather.raw.daily.sunset[dayIndex]);
  const { solarPhase, daylightRatio, dayLengthMinutes, minutesFromSunrise, minutesToSunset } = computeSolarPhase(date, sunrise, sunset, settings.transitionMinutes);

  return {
    weatherCode: Math.round(interpolateNumeric(weather.raw.hourly.weather_code, index, ratio)),
    cloudCover: interpolateNumeric(weather.raw.hourly.cloud_cover, index, ratio),
    precipitation: interpolateNumeric(weather.raw.hourly.precipitation, index, ratio),
    rain: interpolateNumeric(weather.raw.hourly.rain, index, ratio),
    snowfall: interpolateNumeric(weather.raw.hourly.snowfall, index, ratio),
    shortwaveRadiation: interpolateNumeric(weather.raw.hourly.shortwave_radiation, index, ratio),
    temperature: interpolateNumeric(weather.raw.hourly.temperature_2m, index, ratio),
    humidity: interpolateNumeric(weather.raw.hourly.relative_humidity_2m, index, ratio),
    // Open-Meteo visibility is frequently null for this dataset; treat missing visibility as clear rather than zero.
    visibility: interpolateNumeric(weather.raw.hourly.visibility, index, ratio, settings.visibilityFallbackMeters),
    windSpeed: interpolateNumeric(weather.raw.hourly.wind_speed_10m, index, ratio),
    solarPhase,
    daylightRatio,
    dayLengthMinutes,
    minutesFromSunrise,
    minutesToSunset
  };
}

export function summarizeWeather(weather: WeatherAtTime): GeneratedWeatherSummary {
  return {
    weatherCode: weather.weatherCode,
    cloudCover: Number(weather.cloudCover.toFixed(2)),
    precipitation: Number(weather.precipitation.toFixed(2)),
    snowfall: Number(weather.snowfall.toFixed(2)),
    shortwaveRadiation: Number(weather.shortwaveRadiation.toFixed(2)),
    temperature: Number(weather.temperature.toFixed(2)),
    humidity: Number(weather.humidity.toFixed(2)),
    visibility: Number(weather.visibility.toFixed(2)),
    windSpeed: Number(weather.windSpeed.toFixed(2)),
    solarPhase: Number(weather.solarPhase.toFixed(3)),
    daylightRatio: Number(weather.daylightRatio.toFixed(3)),
    dayLengthMinutes: Number(weather.dayLengthMinutes.toFixed(1)),
    minutesFromSunrise: Number(weather.minutesFromSunrise.toFixed(1)),
    minutesToSunset: Number(weather.minutesToSunset.toFixed(1))
  };
}

type GeneratedWeatherSummary = {
  weatherCode: number;
  cloudCover: number;
  precipitation: number;
  snowfall: number;
  shortwaveRadiation: number;
  temperature: number;
  humidity: number;
  visibility: number;
  windSpeed: number;
  solarPhase: number;
  daylightRatio: number;
  dayLengthMinutes: number;
  minutesFromSunrise: number;
  minutesToSunset: number;
};

export function describeWeatherWindow(weather: WeatherResponse): { start: string; end: string } {
  const start = weather.hourly.time[0] ?? '';
  const end = weather.hourly.time[weather.hourly.time.length - 1] ?? '';
  return { start, end };
}

export function debugTimestamp(value: LocalDateTime): string {
  return formatLocalMinute(value);
}