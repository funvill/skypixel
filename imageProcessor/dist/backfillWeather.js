"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillWeather = void 0;
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const data_1 = require("./data");
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
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function lerp(start, end, amount) {
    return start + (end - start) * amount;
}
function parseIsoMinute(value) {
    const [datePart, timePart] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
}
function roundColor(color) {
    return {
        r: Math.round(clamp(color.r, 0, 255)),
        g: Math.round(clamp(color.g, 0, 255)),
        b: Math.round(clamp(color.b, 0, 255))
    };
}
function deterministicNoise(seed) {
    const hash = crypto_1.default.createHash('sha256').update(seed).digest();
    const value = hash.readUInt32BE(0) / 0xffffffff;
    return value * 2 - 1;
}
function getGapBoundaries(observedByKey, targetDate, intervalMs) {
    let previous = null;
    let next = null;
    for (let cursor = targetDate.getTime() - intervalMs; cursor >= targetDate.getTime() - intervalMs * 72; cursor -= intervalMs) {
        const candidate = observedByKey.get((0, data_1.formatLocalMinute)(new Date(cursor)));
        if (candidate) {
            previous = candidate;
            break;
        }
    }
    for (let cursor = targetDate.getTime() + intervalMs; cursor <= targetDate.getTime() + intervalMs * 72; cursor += intervalMs) {
        const candidate = observedByKey.get((0, data_1.formatLocalMinute)(new Date(cursor)));
        if (candidate) {
            next = candidate;
            break;
        }
    }
    return { previous, next };
}
function computeSolarPhase(date, sunrise, sunset) {
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
function featureDistance(left, right) {
    const weatherPenalty = left.weatherCode === right.weatherCode ? 0 : 0.75;
    return (weatherPenalty +
        Math.abs(left.cloudCover - right.cloudCover) / 100 +
        Math.abs(left.shortwaveRadiation - right.shortwaveRadiation) / 700 +
        Math.abs(left.temperature - right.temperature) / 20 +
        Math.abs(left.humidity - right.humidity) / 100 +
        Math.abs(left.precipitation - right.precipitation) / 4 +
        Math.abs(left.windSpeed - right.windSpeed) / 60 +
        Math.abs(left.solarPhase - right.solarPhase) * 1.5 +
        Math.abs(left.daylightRatio - right.daylightRatio));
}
function phaseBucket(weather) {
    if (weather.daylightRatio === 0 && weather.solarPhase < 0)
        return 'pre-dawn';
    if (weather.daylightRatio === 0 && weather.solarPhase >= 0)
        return 'night';
    if (weather.daylightRatio < 0.18)
        return weather.solarPhase < 0 ? 'sunrise' : 'sunset';
    if (weather.daylightRatio > 0.82)
        return weather.solarPhase < 0 ? 'sunrise' : 'sunset';
    return 'day';
}
function cloudBucket(value) {
    return Math.max(0, Math.min(4, Math.floor(value / 20)));
}
function buildBucketKey(weather) {
    const weatherBand = weather.weatherCode >= 60 ? 'wet' : weather.weatherCode >= 45 ? 'mist' : 'dry';
    return [phaseBucket(weather), weatherBand, cloudBucket(weather.cloudCover)].join('|');
}
function createTrainingIndex(training) {
    const buckets = new Map();
    for (const sample of training) {
        const key = buildBucketKey(sample.weather);
        const list = buckets.get(key);
        if (list)
            list.push(sample);
        else
            buckets.set(key, [sample]);
    }
    const maxFallback = 1800;
    const step = Math.max(1, Math.ceil(training.length / maxFallback));
    const fallback = training.filter((_, index) => index % step === 0);
    return { buckets, fallback };
}
function getCandidatePool(index, weather) {
    var _a;
    const primaryKey = buildBucketKey(weather);
    const primary = (_a = index.buckets.get(primaryKey)) !== null && _a !== void 0 ? _a : [];
    if (primary.length >= 24)
        return primary;
    const candidates = [...primary];
    for (const delta of [-1, 1]) {
        const adjacentCloud = cloudBucket(weather.cloudCover) + delta;
        if (adjacentCloud < 0 || adjacentCloud > 4)
            continue;
        const neighboringKey = [
            phaseBucket(weather),
            weather.weatherCode >= 60 ? 'wet' : weather.weatherCode >= 45 ? 'mist' : 'dry',
            adjacentCloud
        ].join('|');
        const neighboring = index.buckets.get(neighboringKey);
        if (neighboring)
            candidates.push(...neighboring);
    }
    if (candidates.length >= 24)
        return candidates;
    return index.fallback;
}
function blendBoundaryColor(previous, next, targetDate, predicted) {
    if (!previous && !next)
        return predicted;
    if (!previous)
        return next.average;
    if (!next)
        return previous.average;
    const span = Math.max(1, next.date.getTime() - previous.date.getTime());
    const ratio = clamp((targetDate.getTime() - previous.date.getTime()) / span, 0, 1);
    return {
        r: lerp(previous.average.r, next.average.r, ratio),
        g: lerp(previous.average.g, next.average.g, ratio),
        b: lerp(previous.average.b, next.average.b, ratio)
    };
}
function predictColor(cameraKey, targetDate, targetWeather, trainingIndex, previous, next) {
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
        r: blended.r + deterministicNoise(`${cameraKey}:${(0, data_1.formatLocalMinute)(targetDate)}:r`) * jitterScale,
        g: blended.g + deterministicNoise(`${cameraKey}:${(0, data_1.formatLocalMinute)(targetDate)}:g`) * jitterScale,
        b: blended.b + deterministicNoise(`${cameraKey}:${(0, data_1.formatLocalMinute)(targetDate)}:b`) * jitterScale
    };
    const averageDistance = nearest.reduce((sum, neighbor) => sum + neighbor.distance, 0) / nearest.length;
    const confidence = clamp(1 - averageDistance / 4 - (hasTwoBoundaries ? 0 : 0.15), 0.15, 0.95);
    return { average: roundColor(jittered), confidence: Number(confidence.toFixed(2)) };
}
function interpolateNumeric(values, index, ratio) {
    var _a, _b, _c;
    const start = (_b = (_a = values[index]) !== null && _a !== void 0 ? _a : values[index + 1]) !== null && _b !== void 0 ? _b : 0;
    const end = (_c = values[index + 1]) !== null && _c !== void 0 ? _c : start;
    return lerp(start, end, ratio);
}
function prepareWeather(weather) {
    return {
        raw: weather,
        hourlyDates: weather.hourly.time.map(parseIsoMinute),
        dayIndex: new Map(weather.daily.time.map((value, index) => [value, index]))
    };
}
function weatherAt(weather, date) {
    if (!weather.raw.hourly.time.length)
        return null;
    const targetTime = date.getTime();
    let index = 0;
    while (index < weather.hourlyDates.length - 2 && weather.hourlyDates[index + 1].getTime() <= targetTime) {
        index++;
    }
    const start = weather.hourlyDates[index];
    const end = weather.hourlyDates[Math.min(index + 1, weather.hourlyDates.length - 1)];
    const span = Math.max(1, end.getTime() - start.getTime());
    const ratio = clamp((targetTime - start.getTime()) / span, 0, 1);
    const dayKey = (0, data_1.formatLocalMinute)(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0)).slice(0, 10);
    const dayIndex = weather.dayIndex.get(dayKey);
    if (dayIndex === undefined)
        return null;
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
async function fetchWeather(folder, settings, startDate, endDate) {
    var _a, _b, _c, _d, _e;
    const weatherPath = path_1.default.join(folder, WEATHER_FILE);
    const cachedExists = await promises_1.default.stat(weatherPath).then(() => true).catch(() => false);
    if (cachedExists) {
        const cached = JSON.parse(await promises_1.default.readFile(weatherPath, 'utf-8'));
        if (((_b = (_a = cached === null || cached === void 0 ? void 0 : cached.hourly) === null || _a === void 0 ? void 0 : _a.time) === null || _b === void 0 ? void 0 : _b.length) && ((_d = (_c = cached === null || cached === void 0 ? void 0 : cached.daily) === null || _c === void 0 ? void 0 : _c.time) === null || _d === void 0 ? void 0 : _d.length)) {
            return cached;
        }
    }
    const params = new URLSearchParams({
        latitude: `${settings.latitude}`,
        longitude: `${settings.longitude}`,
        timezone: (_e = settings.timezone) !== null && _e !== void 0 ? _e : 'auto',
        start_date: (0, data_1.formatLocalMinute)(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0)).slice(0, 10),
        end_date: (0, data_1.formatLocalMinute)(new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0)).slice(0, 10),
        hourly: HOURLY_FIELDS,
        daily: 'sunrise,sunset'
    });
    const url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Weather request failed with ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    await promises_1.default.writeFile(weatherPath, JSON.stringify(payload, null, 2));
    return payload;
}
async function backfillWeather(folder) {
    const settingsPath = path_1.default.join(folder, 'settings.json');
    const settings = JSON.parse(await promises_1.default.readFile(settingsPath, 'utf-8'));
    if (settings.latitude === undefined || settings.longitude === undefined || !settings.timezone) {
        throw new Error(`Missing latitude/longitude/timezone in ${settingsPath}`);
    }
    const observedRecords = await (0, data_1.loadObservedRecords)(folder);
    const observedEntries = observedRecords
        .map(record => {
        const date = (0, data_1.parseOutputFileDate)(record.file);
        if (!date)
            return null;
        return { date, average: record.average };
    })
        .filter((entry) => !!entry)
        .sort((left, right) => left.date.getTime() - right.date.getTime());
    if (observedEntries.length < 24) {
        throw new Error('Not enough observed samples to build a weather backfill model.');
    }
    const start = observedEntries[0].date;
    const end = observedEntries[observedEntries.length - 1].date;
    const weather = prepareWeather(await fetchWeather(folder, settings, start, end));
    const training = observedEntries
        .map(entry => {
        const sampleWeather = weatherAt(weather, entry.date);
        if (!sampleWeather)
            return null;
        return {
            date: entry.date,
            average: entry.average,
            weather: sampleWeather
        };
    })
        .filter((entry) => !!entry);
    const trainingIndex = createTrainingIndex(training);
    const observedByKey = new Map(training.map(sample => [(0, data_1.formatLocalMinute)(sample.date), sample]));
    const observedKeys = new Set(observedEntries.map(entry => (0, data_1.formatLocalMinute)(entry.date)));
    const intervalMs = INTERVAL_MINUTES * 60 * 1000;
    const roundedStart = new Date(start);
    roundedStart.setMinutes(Math.floor(roundedStart.getMinutes() / INTERVAL_MINUTES) * INTERVAL_MINUTES, 0, 0);
    const backfill = [];
    for (let cursor = roundedStart.getTime(); cursor <= end.getTime(); cursor += intervalMs) {
        const targetDate = new Date(cursor);
        const key = (0, data_1.formatLocalMinute)(targetDate);
        const exactObserved = observedKeys.has(key);
        if (exactObserved)
            continue;
        const targetWeather = weatherAt(weather, targetDate);
        if (!targetWeather)
            continue;
        const { previous, next } = getGapBoundaries(observedByKey, targetDate, intervalMs);
        const prediction = predictColor(path_1.default.basename(folder), targetDate, targetWeather, trainingIndex, previous, next);
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
    const backfillPath = path_1.default.join(folder, BACKFILL_FILE);
    await promises_1.default.writeFile(backfillPath, JSON.stringify(backfill, null, 2));
    console.log(`✅ Wrote ${backfill.length} synthetic records to ${backfillPath}`);
}
exports.backfillWeather = backfillWeather;
