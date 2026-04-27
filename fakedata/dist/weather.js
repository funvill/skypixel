"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWeather = fetchWeather;
exports.prepareWeather = prepareWeather;
exports.weatherAt = weatherAt;
exports.summarizeWeather = summarizeWeather;
exports.describeWeatherWindow = describeWeatherWindow;
exports.debugTimestamp = debugTimestamp;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const time_1 = require("./time");
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
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function lerp(start, end, amount) {
    return start + (end - start) * amount;
}
function interpolateNumeric(values, index, ratio, fallback = 0) {
    const start = values[index] ?? values[index + 1] ?? fallback;
    const end = values[index + 1] ?? start;
    return lerp(start, end, ratio);
}
function computeSolarPhase(date, sunrise, sunset, transitionMinutes) {
    const timestamp = (0, time_1.toTick)(date);
    const sunriseTick = (0, time_1.toTick)(sunrise);
    const sunsetTick = (0, time_1.toTick)(sunset);
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
function validateWeatherPayload(payload) {
    if (!payload.hourly?.time?.length) {
        throw new Error('Weather payload is missing hourly.time values.');
    }
    if (!payload.daily?.time?.length || !payload.daily?.sunrise?.length || !payload.daily?.sunset?.length) {
        throw new Error('Weather payload is missing daily sunrise and sunset values.');
    }
}
async function fetchWeather(outputFolder, latitude, longitude, timezone, startDate, endDate, settings) {
    const weatherPath = path_1.default.join(outputFolder, 'weather.open-meteo.json');
    const exists = await promises_1.default.stat(weatherPath).then(() => true).catch(() => false);
    if (exists && settings.cachePolicy !== 'refresh') {
        const cached = JSON.parse(await promises_1.default.readFile(weatherPath, 'utf-8'));
        validateWeatherPayload(cached);
        return { payload: cached, source: 'cache' };
    }
    const params = new URLSearchParams({
        latitude: `${latitude}`,
        longitude: `${longitude}`,
        timezone,
        start_date: (0, time_1.formatLocalDate)(startDate),
        end_date: (0, time_1.formatLocalDate)(endDate),
        hourly: HOURLY_FIELDS,
        daily: 'sunrise,sunset'
    });
    const url = `${settings.apiBaseUrl}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Weather request failed with ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    validateWeatherPayload(payload);
    await promises_1.default.writeFile(weatherPath, JSON.stringify(payload, null, 2));
    return { payload, source: 'api' };
}
function prepareWeather(weather) {
    return {
        raw: weather,
        hourlyDates: weather.hourly.time.map(time_1.parseIsoMinute),
        hourlyTicks: weather.hourly.time.map(value => (0, time_1.toTick)((0, time_1.parseIsoMinute)(value))),
        dayIndex: new Map(weather.daily.time.map((value, index) => [value, index]))
    };
}
function weatherAt(weather, date, settings) {
    if (!weather.raw.hourly.time.length) {
        return null;
    }
    const targetTick = (0, time_1.toTick)(date);
    let index = 0;
    while (index < weather.hourlyTicks.length - 2 && weather.hourlyTicks[index + 1] <= targetTick) {
        index++;
    }
    const start = weather.hourlyTicks[index];
    const end = weather.hourlyTicks[Math.min(index + 1, weather.hourlyTicks.length - 1)];
    const span = Math.max(1, end - start);
    const ratio = clamp((targetTick - start) / span, 0, 1);
    const dayIndex = weather.dayIndex.get((0, time_1.formatLocalDate)(date));
    if (dayIndex === undefined) {
        return null;
    }
    const sunrise = (0, time_1.parseIsoMinute)(weather.raw.daily.sunrise[dayIndex]);
    const sunset = (0, time_1.parseIsoMinute)(weather.raw.daily.sunset[dayIndex]);
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
function summarizeWeather(weather) {
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
function describeWeatherWindow(weather) {
    const start = weather.hourly.time[0] ?? '';
    const end = weather.hourly.time[weather.hourly.time.length - 1] ?? '';
    return { start, end };
}
function debugTimestamp(value) {
    return (0, time_1.formatLocalMinute)(value);
}
