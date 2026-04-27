"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSkyColor = generateSkyColor;
const crypto_1 = __importDefault(require("crypto"));
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function lerp(start, end, amount) {
    return start + (end - start) * amount;
}
function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
}
function mixColor(left, right, amount) {
    return {
        r: lerp(left.r, right.r, amount),
        g: lerp(left.g, right.g, amount),
        b: lerp(left.b, right.b, amount)
    };
}
function transitionMinutes(settings) {
    return settings.generator.weather.transitionMinutes;
}
function averageLuminance(color) {
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}
function stableDayWeight(weather, settings) {
    if (weather.daylightRatio <= 0) {
        return 0;
    }
    const transition = transitionMinutes(settings);
    const sunriseClear = smoothstep(0, transition, weather.minutesFromSunrise);
    const sunsetClear = smoothstep(0, transition, weather.minutesToSunset);
    return clamp(sunriseClear * sunsetClear, 0, 1);
}
function totalMinutes(date) {
    return date.hour * 60 + date.minute;
}
function absoluteDayIndex(date) {
    return Math.floor(Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0, 0) / 86400000);
}
function absoluteMinuteIndex(date) {
    return Math.floor(utcTimestamp(date) / 60000);
}
function seasonalPosition(date) {
    return (absoluteDayIndex(date) % 365) / 365;
}
function summerStrength(date) {
    const distance = Math.abs(seasonalPosition(date) - 0.47);
    return clamp(1 - distance / 0.26, 0, 1);
}
function summerMiddayWeight(date, weather, settings) {
    const seasonWeight = smoothstep(0.15, 0.85, summerStrength(date));
    const transition = transitionMinutes(settings);
    const sunriseClear = smoothstep(0, transition, weather.minutesFromSunrise);
    const sunsetClear = smoothstep(0, transition, weather.minutesToSunset);
    return clamp(seasonWeight * sunriseClear * sunsetClear, 0, 1);
}
function edgeWindowWeight(weather, edge, settings) {
    const transition = transitionMinutes(settings);
    if (edge === 'sunrise') {
        if (weather.minutesFromSunrise < 0) {
            return 1 - smoothstep(-transition, 0, weather.minutesFromSunrise);
        }
        return 1 - smoothstep(0, transition, weather.minutesFromSunrise);
    }
    if (weather.minutesToSunset < 0) {
        return 1 - smoothstep(-transition, 0, weather.minutesToSunset);
    }
    return 1 - smoothstep(0, transition, weather.minutesToSunset);
}
function bucketSeed(locationKey, date, bucketMinutes, suffix) {
    const minuteBucket = Math.floor(totalMinutes(date) / bucketMinutes);
    return `${locationKey}:${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}:${bucketMinutes}:${minuteBucket}:${suffix}`;
}
function continuousBucketSeed(locationKey, date, bucketMinutes, suffix) {
    const minuteBucket = Math.floor(absoluteMinuteIndex(date) / bucketMinutes);
    return `${locationKey}:abs:${bucketMinutes}:${minuteBucket}:${suffix}`;
}
function deterministicNoise(seed) {
    const hash = crypto_1.default.createHash('sha256').update(seed).digest();
    const value = hash.readUInt32BE(0) / 0xffffffff;
    return value * 2 - 1;
}
function utcTimestamp(date) {
    return Date.UTC(date.year, date.month - 1, date.day, date.hour, date.minute, 0, 0);
}
function moonIllumination(date) {
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0, 0);
    const synodicMonthDays = 29.53058867;
    const daysSinceEpoch = (utcTimestamp(date) - knownNewMoon) / 86400000;
    const phase = ((daysSinceEpoch % synodicMonthDays) + synodicMonthDays) % synodicMonthDays / synodicMonthDays;
    return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}
function roundColor(color) {
    return {
        r: Math.round(clamp(color.r, 0, 255)),
        g: Math.round(clamp(color.g, 0, 255)),
        b: Math.round(clamp(color.b, 0, 255))
    };
}
function basePalette(weather, settings) {
    const { preDawn, sunriseWarm, dayBlue, dusk, twilightGray, dawnGray, night } = settings.generator.palette;
    const transition = transitionMinutes(settings);
    if (weather.daylightRatio === 0 && weather.minutesFromSunrise < 0) {
        const edge = edgeWindowWeight(weather, 'sunrise', settings);
        return mixColor(night, mixColor(dawnGray, sunriseWarm, 0.55), edge);
    }
    if (weather.daylightRatio === 0 && weather.minutesToSunset < 0) {
        const edge = edgeWindowWeight(weather, 'sunset', settings);
        return mixColor(night, mixColor(twilightGray, dusk, 0.45), edge);
    }
    if (weather.daylightRatio > 0 && weather.minutesFromSunrise < transition) {
        const edge = 1 - edgeWindowWeight(weather, 'sunrise', settings);
        return mixColor(sunriseWarm, dayBlue, edge);
    }
    if (weather.daylightRatio > 0 && weather.minutesToSunset < transition) {
        const edge = edgeWindowWeight(weather, 'sunset', settings);
        return mixColor(dayBlue, dusk, edge);
    }
    return dayBlue;
}
function applyRadiation(color, weather, settings) {
    const radiationFactor = clamp(weather.shortwaveRadiation / 850, 0, 1);
    const dayPlateau = stableDayWeight(weather, settings);
    const strength = settings.generator.lighting.radiationStrength;
    return {
        r: color.r + radiationFactor * (8 - dayPlateau * 4) * strength,
        g: color.g + radiationFactor * (9 - dayPlateau * 4) * strength,
        b: color.b + radiationFactor * (10 - dayPlateau * 2) * strength
    };
}
function applyClouds(color, weather, settings) {
    const cloudFactor = clamp(weather.cloudCover / 100, 0, 1);
    const overcastTint = { r: 214, g: 220, b: 228 };
    const overcastWeight = cloudFactor < 0.72
        ? cloudFactor * 0.28
        : 0.2 + (cloudFactor - 0.72) / 0.28 * 0.48;
    const mixed = mixColor(color, overcastTint, clamp(overcastWeight, 0, 0.68));
    const darkening = 1 - cloudFactor * 0.06 * settings.generator.lighting.cloudDarkeningStrength;
    return {
        r: mixed.r * darkening,
        g: mixed.g * darkening,
        b: mixed.b * darkening
    };
}
function applyMoisture(color, weather, settings) {
    const precipitationFactor = clamp((weather.precipitation + weather.rain + weather.snowfall) / 5, 0, 1);
    const stormTint = { r: 120, g: 132, b: 150 };
    const stormMixed = mixColor(color, stormTint, precipitationFactor * 0.38);
    const visibilityPenalty = weather.visibility > 0
        ? clamp(1 - weather.visibility / 16000, 0, 0.1)
        : 0;
    const windPenalty = clamp(weather.windSpeed / 100, 0, 0.08);
    const brightness = clamp(1 - (visibilityPenalty + windPenalty) * settings.generator.lighting.moistureDarkeningStrength, 0.78, 1.02);
    return {
        r: stormMixed.r * brightness,
        g: stormMixed.g * brightness,
        b: stormMixed.b * brightness
    };
}
function applySnow(color, weather) {
    const snowFactor = clamp(weather.snowfall / 3, 0, 1);
    const snowTint = { r: 220, g: 229, b: 242 };
    return mixColor(color, snowTint, snowFactor * 0.42);
}
function applyTemperature(color, weather) {
    const coldFactor = clamp((5 - weather.temperature) / 30, 0, 1);
    const warmFactor = clamp((weather.temperature - 18) / 20, 0, 1);
    return {
        r: color.r + warmFactor * 8 - coldFactor * 2,
        g: color.g + warmFactor * 3,
        b: color.b + coldFactor * 6 - warmFactor * 2
    };
}
function applyExposure(color, weather, settings) {
    const dayPlateau = stableDayWeight(weather, settings);
    const exposureStrength = settings.generator.lighting.exposureStrength;
    const daylightBoost = weather.daylightRatio > 0 ? 1 + (0.008 + dayPlateau * 0.006) * exposureStrength : 1;
    const cloudLift = 1 + clamp(weather.cloudCover / 100, 0, 0.015 * exposureStrength);
    return {
        r: color.r * daylightBoost * cloudLift,
        g: color.g * daylightBoost * cloudLift,
        b: color.b * daylightBoost * cloudLift
    };
}
function regimeBlend(locationKey, date, windowDays, suffix) {
    const dayIndex = absoluteDayIndex(date);
    const window = Math.max(1, windowDays);
    const leftIndex = Math.floor(dayIndex / window) * window;
    const rightIndex = leftIndex + window;
    const blend = (dayIndex - leftIndex) / window;
    const leftSeed = `${locationKey}:regime:${windowDays}:${leftIndex}:${suffix}`;
    const rightSeed = `${locationKey}:regime:${windowDays}:${rightIndex}:${suffix}`;
    const leftValue = deterministicNoise(leftSeed);
    const rightValue = deterministicNoise(rightSeed);
    return lerp(leftValue, rightValue, blend);
}
function transitionPhaseWindow(weather, edge, settings) {
    return edgeWindowWeight(weather, edge, settings);
}
function transitionVisibility(locationKey, date, edge, weather, settings) {
    const clearFactor = clamp(1 - weather.cloudCover / 100, 0, 1);
    const wetFactor = clamp((weather.precipitation + weather.rain + weather.snowfall) / 3, 0, 1);
    const daySeed = deterministicNoise(bucketSeed(locationKey, date, 1440, `${edge}-visibility`));
    const bandSeed = deterministicNoise(bucketSeed(locationKey, date, 120, `${edge}-band`));
    const coarseBank = deterministicNoise(continuousBucketSeed(locationKey, date, 45, `${edge}-bank-vis`));
    const strength = settings.generator.transition.ambientStrength;
    const baseVisibility = 0.18 + clearFactor * 0.42 - wetFactor * 0.34 + daySeed * 0.28 * strength + bandSeed * 0.16 * strength + coarseBank * 0.14 * strength;
    return clamp(baseVisibility, 0, 1);
}
function transitionTimingSkew(locationKey, date, edge, weather, settings) {
    const cloudFactor = clamp(weather.cloudCover / 100, 0, 1);
    const wetFactor = clamp((weather.precipitation + weather.rain + weather.snowfall) / 3.5, 0, 1);
    const dayDrift = deterministicNoise(bucketSeed(locationKey, date, 1440, `${edge}-timing-day`));
    const frontDrift = deterministicNoise(continuousBucketSeed(locationKey, date, 30, `${edge}-timing-front`));
    const cloudBank = deterministicNoise(continuousBucketSeed(locationKey, date, 60, `${edge}-timing-bank`));
    const magnitude = (0.1 + cloudFactor * 0.32 + wetFactor * 0.22) * settings.generator.transition.dawnDuskJitterStrength;
    return clamp((dayDrift * 0.5 + frontDrift * 0.25 + cloudBank * 0.25) * magnitude, -0.58, 0.58);
}
function transitionFeather(locationKey, date, edge) {
    const coarse = deterministicNoise(bucketSeed(locationKey, date, 60, `${edge}-feather-coarse`));
    const fine = deterministicNoise(bucketSeed(locationKey, date, 15, `${edge}-feather-fine`));
    const minuteWave = Math.sin((totalMinutes(date) / 1440) * Math.PI * 10 + (edge === 'sunrise' ? 0.7 : 2.1));
    return coarse * 0.5 + fine * 0.35 + minuteWave * 0.15;
}
function horizonTransmission(locationKey, date, edge, weather, settings) {
    const clearFactor = clamp(1 - weather.cloudCover / 100, 0, 1);
    const wetFactor = clamp((weather.precipitation + weather.rain + weather.snowfall) / 3.5, 0, 1);
    const dayMask = deterministicNoise(bucketSeed(locationKey, date, 1440, `${edge}-horizon-day`));
    const bandMask = deterministicNoise(continuousBucketSeed(locationKey, date, 20, `${edge}-horizon-band`));
    const coarseMask = deterministicNoise(continuousBucketSeed(locationKey, date, 60, `${edge}-horizon-coarse`));
    const cloudWall = deterministicNoise(continuousBucketSeed(locationKey, date, 90, `${edge}-horizon-wall`));
    const coolStrength = settings.generator.transition.coolStrength;
    const base = 0.24 + clearFactor * 0.42 - wetFactor * 0.34 + dayMask * 0.24 * coolStrength + bandMask * 0.24 * coolStrength + coarseMask * 0.18 * coolStrength + cloudWall * 0.18 * coolStrength;
    return clamp(base, 0, 1);
}
function cloudBankOcclusion(locationKey, date, edge, weather, settings) {
    const cloudFactor = clamp(weather.cloudCover / 100, 0, 1);
    const wetFactor = clamp((weather.precipitation + weather.rain + weather.snowfall) / 3.5, 0, 1);
    const longBank = deterministicNoise(continuousBucketSeed(locationKey, date, 90, `${edge}-occlusion-long`));
    const midBank = deterministicNoise(continuousBucketSeed(locationKey, date, 35, `${edge}-occlusion-mid`));
    const rowBias = deterministicNoise(bucketSeed(locationKey, date, 1440, `${edge}-occlusion-row`));
    const raw = Math.max(0, longBank * 0.55 + midBank * 0.35 + rowBias * 0.1);
    return clamp(raw * (0.2 + cloudFactor * 0.75 + wetFactor * 0.4) * settings.generator.transition.occlusionStrength, 0, 0.9);
}
function transitionAmbientStrength(locationKey, date, edge, weather, settings) {
    const phase = transitionPhaseWindow(weather, edge, settings);
    const rowDrift = deterministicNoise(bucketSeed(locationKey, date, 1440, `${edge}-ambient-row`));
    const bucketDrift = deterministicNoise(continuousBucketSeed(locationKey, date, 15, `${edge}-ambient-bucket`));
    const cloudFactor = clamp(weather.cloudCover / 100, 0, 1);
    const ambient = phase * (0.34 + cloudFactor * 0.26 + rowDrift * 0.08 + bucketDrift * 0.06) * settings.generator.transition.ambientStrength;
    return clamp(ambient, 0, 0.82);
}
function transitionWarmBandStrength(locationKey, date, edge, weather, settings) {
    const phase = transitionPhaseWindow(weather, edge, settings);
    const summerHeat = summerStrength(date);
    const visibility = transitionVisibility(locationKey, date, edge, weather, settings);
    const transmission = horizonTransmission(locationKey, date, edge, weather, settings);
    const notch = deterministicNoise(continuousBucketSeed(locationKey, date, 10, `${edge}-warm-notch`));
    const warmBand = clamp(1 - Math.abs(phase - 0.52) / 0.34, 0, 1);
    const obscured = clamp(0.55 + notch * 0.45, 0, 1);
    return clamp(warmBand * visibility * transmission * obscured * (0.34 + summerHeat * 0.4) * settings.generator.transition.warmthStrength, 0, 0.9);
}
function applySummerMiddayFlattening(color, date, weather, settings) {
    const weight = summerMiddayWeight(date, weather, settings) * settings.generator.lighting.summerDayCoreFlatteningStrength;
    if (weight <= 0.001) {
        return color;
    }
    const cloudFactor = clamp(weather.cloudCover / 100, 0, 1);
    const grayBlueTarget = {
        r: 176 + cloudFactor * 12,
        g: 186 + cloudFactor * 10,
        b: 212 + cloudFactor * 8
    };
    let adjusted = mixColor(color, grayBlueTarget, (0.12 + cloudFactor * 0.08 + weight * 0.18));
    const luminance = averageLuminance(adjusted);
    adjusted = mixColor(adjusted, { r: luminance, g: luminance + 3, b: luminance + 10 }, 0.05 + weight * 0.12);
    return {
        r: adjusted.r * (1 - weight * 0.05),
        g: adjusted.g * (1 - weight * 0.02),
        b: adjusted.b * (1 - weight * 0.015)
    };
}
function applyTransitionFeathers(color, locationKey, date, weather, settings) {
    const sunriseWindow = weather.solarPhase < 0 ? transitionPhaseWindow(weather, 'sunrise', settings) : 0;
    const sunsetWindow = weather.solarPhase >= 0 ? transitionPhaseWindow(weather, 'sunset', settings) : 0;
    const edge = sunriseWindow >= sunsetWindow ? 'sunrise' : 'sunset';
    const phaseWindow = Math.max(sunriseWindow, sunsetWindow);
    if (phaseWindow <= 0.001) {
        return color;
    }
    const feather = transitionFeather(locationKey, date, edge) * settings.generator.transition.featherStrength;
    const summerHeat = summerStrength(date);
    const visibility = transitionVisibility(locationKey, date, edge, weather, settings);
    const transmission = horizonTransmission(locationKey, date, edge, weather, settings);
    const timingSkew = transitionTimingSkew(locationKey, date, edge, weather, settings);
    const bankOcclusion = cloudBankOcclusion(locationKey, date, edge, weather, settings);
    const horizonWarmth = edge === 'sunrise'
        ? { r: 246 + summerHeat * 12, g: 172 + summerHeat * 10, b: 96 - summerHeat * 12 }
        : { r: 242 + summerHeat * 14, g: 150 + summerHeat * 10, b: 88 - summerHeat * 14 };
    const horizonCool = edge === 'sunrise'
        ? { r: 74, g: 110, b: 188 }
        : { r: 70, g: 96, b: 168 };
    const shiftedPhaseWindow = clamp(phaseWindow + timingSkew - bankOcclusion * 0.35, 0, 1);
    const ambientStrength = transitionAmbientStrength(locationKey, date, edge, weather, settings) * shiftedPhaseWindow;
    const warmStrength = transitionWarmBandStrength(locationKey, date, edge, weather, settings) * shiftedPhaseWindow;
    const obscuredStrength = shiftedPhaseWindow * (1 - transmission * (0.72 + (1 - bankOcclusion) * 0.18));
    const ambientGray = edge === 'sunrise'
        ? { r: 138, g: 142, b: 156 }
        : { r: 130, g: 134, b: 150 };
    let varied = mixColor(color, ambientGray, ambientStrength);
    varied = mixColor(varied, horizonWarmth, warmStrength);
    varied = mixColor(varied, horizonCool, clamp((obscuredStrength * 0.48 + Math.max(0, -feather) * 0.1) * settings.generator.transition.coolStrength, 0, 0.5));
    const emberStrength = shiftedPhaseWindow * visibility * transmission * (1 - bankOcclusion * 0.7) * (0.1 + summerHeat * 0.24);
    varied = {
        r: varied.r + emberStrength * (edge === 'sunrise' ? 36 : 42),
        g: varied.g + emberStrength * (edge === 'sunrise' ? 14 : 10),
        b: varied.b - emberStrength * (edge === 'sunrise' ? 16 : 20)
    };
    const streak = deterministicNoise(bucketSeed(locationKey, date, 10, `${edge}-streak`));
    const streakStrength = shiftedPhaseWindow * clamp(Math.max(0, streak), 0, 1) * visibility * transmission * (1 - bankOcclusion * 0.6);
    varied = {
        r: varied.r + streakStrength * (edge === 'sunrise' ? 22 : 18) + summerHeat * streakStrength * 16,
        g: varied.g + streakStrength * 8,
        b: varied.b + Math.max(0, -feather) * shiftedPhaseWindow * (visibility < 0.45 ? 12 : 5) - streakStrength * summerHeat * 10
    };
    const occlusionDark = shiftedPhaseWindow * ((1 - transmission) * 0.52 + (1 - visibility) * 0.22 + bankOcclusion * 0.42 + Math.max(0, timingSkew) * 0.16);
    const centerDim = 1 - shiftedPhaseWindow * 0.08 - ambientStrength * 0.05 - occlusionDark;
    const depth = visibility < 0.2 ? 1 - phaseWindow * 0.22 : centerDim;
    return {
        r: varied.r * depth,
        g: varied.g * depth,
        b: varied.b * (depth + (edge === 'sunset' ? 0.02 : 0))
    };
}
function applyOrganicVariation(color, locationKey, timestamp, date, weather) {
    const clearFactor = clamp((1 - weather.cloudCover / 100) * (weather.visibility / 16000), 0, 1);
    const wetFactor = clamp((weather.precipitation + weather.rain + weather.snowfall) / 4, 0, 1);
    const dayExposure = deterministicNoise(bucketSeed(locationKey, date, 1440, 'exposure')) * 0.08;
    const frontShift = deterministicNoise(continuousBucketSeed(locationKey, date, 180, 'front')) * 0.12;
    const localShift = deterministicNoise(continuousBucketSeed(locationKey, date, 45, 'local')) * 0.08;
    const blueDrift = deterministicNoise(continuousBucketSeed(locationKey, date, 90, 'blue'));
    const anomaly = deterministicNoise(`${locationKey}:${timestamp}:anomaly`);
    const threeDayGloom = regimeBlend(locationKey, date, 3, 'gloom');
    const fourDayGloom = regimeBlend(locationKey, date, 4, 'gloom');
    const gloomRegime = clamp((threeDayGloom * 0.55 + fourDayGloom * 0.45 + 1) / 2, 0, 1);
    const gloomStrength = clamp((gloomRegime - 0.58) / 0.42, 0, 1);
    const cameraDrift = regimeBlend(locationKey, date, 2, 'camera-drift');
    const hazeDrift = deterministicNoise(continuousBucketSeed(locationKey, date, 360, 'haze'));
    const dayPhaseWave = Math.sin((absoluteMinuteIndex(date) / 1440) * Math.PI * 2 * 0.37 + regimeBlend(locationKey, date, 5, 'phase') * 1.8);
    let varied = {
        r: color.r * (1 + dayExposure + frontShift * 0.35 + cameraDrift * 0.03),
        g: color.g * (1 + dayExposure * 0.8 + localShift * 0.18 + cameraDrift * 0.018),
        b: color.b * (1 + dayExposure * 0.7 + blueDrift * 0.08 + frontShift * 0.1 - cameraDrift * 0.02)
    };
    if (weather.daylightRatio > 0) {
        varied = {
            r: varied.r - clearFactor * 4,
            g: varied.g + clearFactor * 2,
            b: varied.b + clearFactor * 10
        };
        const overcastDayFactor = clamp((weather.cloudCover - 72) / 28, 0, 1) * (0.45 + gloomStrength * 0.55);
        if (overcastDayFactor > 0) {
            const overcastWhite = { r: 228, g: 230, b: 236 };
            varied = mixColor(varied, overcastWhite, overcastDayFactor * 0.58);
            varied = {
                r: varied.r + overcastDayFactor * 10,
                g: varied.g + overcastDayFactor * 11,
                b: varied.b + overcastDayFactor * 5 - overcastDayFactor * 12
            };
        }
        const blueSuppression = clamp(gloomStrength * (0.55 + weather.cloudCover / 200 + wetFactor * 0.35), 0, 0.92);
        if (blueSuppression > 0) {
            const gloomCloud = { r: 222, g: 226, b: 230 };
            varied = mixColor(varied, gloomCloud, blueSuppression * 0.42);
            varied = {
                r: varied.r + blueSuppression * 8,
                g: varied.g + blueSuppression * 7,
                b: varied.b * (1 - blueSuppression * 0.42)
            };
        }
        const hazeLift = clamp((weather.humidity ?? 0) / 100, 0, 1) * Math.max(0, hazeDrift) * 0.08;
        varied = {
            r: varied.r * (1 + hazeLift),
            g: varied.g * (1 + hazeLift),
            b: varied.b * (1 - hazeLift * 0.18)
        };
    }
    if (weather.daylightRatio === 0) {
        const clearNightFactor = clamp((1 - weather.cloudCover / 100) * (1 - wetFactor), 0, 1);
        const darkness = 1 - clearNightFactor * 0.28;
        varied = {
            r: varied.r * darkness,
            g: varied.g * darkness,
            b: varied.b * (1 - clearNightFactor * 0.18)
        };
    }
    const cloudEdgeFactor = weather.daylightRatio > 0 && weather.cloudCover > 18 && weather.cloudCover < 78
        ? clamp(weather.shortwaveRadiation / 700, 0, 0.65)
        : 0;
    const cloudEdgeLift = Math.max(0, anomaly) * cloudEdgeFactor * 24;
    varied = {
        r: varied.r + cloudEdgeLift * 0.85,
        g: varied.g + cloudEdgeLift,
        b: varied.b + cloudEdgeLift * 1.15
    };
    const columnBreaker = clamp((dayPhaseWave + 1) / 2, 0, 1) * 0.06 + Math.max(0, hazeDrift) * 0.03;
    varied = {
        r: varied.r * (1 + columnBreaker * 0.12),
        g: varied.g * (1 + columnBreaker * 0.08),
        b: varied.b * (1 - columnBreaker * 0.04)
    };
    const oddCastFactor = Math.max(0, deterministicNoise(bucketSeed(locationKey, date, 720, 'cast'))) * 0.05;
    varied = {
        r: varied.r * (1 + oddCastFactor * (wetFactor > 0.1 ? 0.8 : 0.25)),
        g: varied.g * (1 - oddCastFactor * 0.2),
        b: varied.b * (1 + oddCastFactor * (clearFactor > 0.3 ? 0.7 : 0.35))
    };
    return varied;
}
function classifyColorRegime(weather, settings) {
    if (weather.daylightRatio === 0) {
        return Math.max(edgeWindowWeight(weather, 'sunrise', settings), edgeWindowWeight(weather, 'sunset', settings)) > 0.001 ? 'twilight' : 'night';
    }
    if (weather.minutesFromSunrise < transitionMinutes(settings) || weather.minutesToSunset < transitionMinutes(settings)) {
        return 'twilight';
    }
    if (weather.cloudCover >= 80) {
        return 'overcast';
    }
    if (weather.cloudCover <= 35) {
        return 'clear';
    }
    return 'mid';
}
function fitColorToRatios(color, targetRb, targetGb) {
    const luminance = Math.max(averageLuminance(color), 1);
    const denominator = Math.max(0.2126 * targetRb + 0.7152 * targetGb + 0.0722, 0.01);
    const blue = luminance / denominator;
    return {
        r: blue * targetRb,
        g: blue * targetGb,
        b: blue
    };
}
function applySeasonalWhiteBalance(color, locationKey, date, weather) {
    const seasonAngle = seasonalPosition(date) * Math.PI * 2;
    const winterBias = (1 - Math.cos(seasonAngle)) / 2;
    const summerBias = 1 - winterBias;
    const seasonalSeed = deterministicNoise(`${locationKey}:${date.year}:${Math.floor((date.month - 1) / 3)}:white-balance`);
    const cloudFactor = clamp(weather.cloudCover / 100, 0, 1);
    const daylightFactor = clamp(weather.daylightRatio > 0 ? 0.45 + weather.daylightRatio * 0.55 : 0.35, 0, 1);
    const redScale = 1 - winterBias * 0.035 + summerBias * 0.012 + seasonalSeed * 0.006;
    const greenScale = 1 - winterBias * 0.012 + seasonalSeed * 0.004;
    const blueScale = 1 + winterBias * 0.055 + cloudFactor * 0.015 - summerBias * 0.008 - seasonalSeed * 0.004;
    return {
        r: color.r * lerp(1, redScale, daylightFactor),
        g: color.g * lerp(1, greenScale, daylightFactor),
        b: color.b * lerp(1, blueScale, daylightFactor)
    };
}
function applyRegimeRatioFit(color, date, weather, settings) {
    const regime = classifyColorRegime(weather, settings);
    const summerMidday = summerMiddayWeight(date, weather, settings);
    if (regime === 'night') {
        return color;
    }
    if (summerMidday > 0.001) {
        let adjusted = mixColor(color, fitColorToRatios(color, 0.763, 0.831), 0.24 + summerMidday * 0.24);
        adjusted = mixColor(adjusted, { r: 170, g: 181, b: 216 }, (0.08 + clamp(weather.cloudCover / 100, 0, 1) * 0.06) * summerMidday);
        adjusted = {
            r: adjusted.r * (1 - summerMidday * 0.015),
            g: adjusted.g * (1 - summerMidday * 0.01),
            b: adjusted.b * (1 - summerMidday * 0.025)
        };
        color = mixColor(color, adjusted, summerMidday);
    }
    if (regime === 'clear') {
        let adjusted = mixColor(color, fitColorToRatios(color, 0.6525, 0.7772), 0.36);
        adjusted = {
            r: adjusted.r * 0.96,
            g: adjusted.g * 0.99,
            b: adjusted.b * 1.03
        };
        return adjusted;
    }
    if (regime === 'overcast') {
        let adjusted = mixColor(color, fitColorToRatios(color, 0.8584, 0.8956), 0.5);
        adjusted = mixColor(adjusted, { r: 186, g: 194, b: 216 }, 0.14);
        return adjusted;
    }
    if (regime === 'twilight') {
        let adjusted = mixColor(color, fitColorToRatios(color, 0.7644, 0.8352), 0.58);
        adjusted = {
            r: adjusted.r * 0.97,
            g: adjusted.g * 0.985,
            b: adjusted.b * 1.06
        };
        return adjusted;
    }
    const cloudBlend = clamp((weather.cloudCover - 35) / 45, 0, 1);
    let adjusted = mixColor(color, fitColorToRatios(color, lerp(0.6525, 0.8584, cloudBlend), lerp(0.7772, 0.8956, cloudBlend)), 0.42);
    adjusted = {
        r: adjusted.r * 0.965,
        g: adjusted.g * 0.99,
        b: adjusted.b * 1.025
    };
    return adjusted;
}
function applyRealCameraBalance(color, weather, settings) {
    const cloudFactor = clamp(weather.cloudCover / 100, 0, 1);
    const daylight = clamp(weather.daylightRatio, 0, 1);
    const twilight = transitionStrength(weather, settings);
    const yellowExcess = Math.max(0, (color.r + color.g) * 0.5 - color.b);
    const dayCoolStrength = daylight > 0 ? (0.08 + cloudFactor * 0.08) * settings.generator.camera.dayCoolStrength : 0;
    const twilightCoolStrength = twilight > 0 ? (0.14 + cloudFactor * 0.08) * settings.generator.camera.twilightCoolStrength : 0;
    const grayCloudStrength = daylight > 0 ? clamp((cloudFactor - 0.62) / 0.38, 0, 1) * 0.22 * settings.generator.camera.grayCloudStrength : 0;
    let adjusted = color;
    if (yellowExcess > 0) {
        const correction = clamp(yellowExcess / 80, 0, 1);
        adjusted = {
            r: adjusted.r - correction * (7 + dayCoolStrength * 20 + twilightCoolStrength * 18),
            g: adjusted.g - correction * (4 + dayCoolStrength * 12 + twilightCoolStrength * 10),
            b: adjusted.b + correction * (10 + dayCoolStrength * 20 + twilightCoolStrength * 18)
        };
    }
    if (daylight > 0) {
        adjusted = {
            r: adjusted.r * (1 - dayCoolStrength * 0.1),
            g: adjusted.g * (1 - dayCoolStrength * 0.04),
            b: adjusted.b * (1 + dayCoolStrength * 0.05)
        };
    }
    if (twilight > 0) {
        adjusted = {
            r: adjusted.r * (1 - twilightCoolStrength * 0.12),
            g: adjusted.g * (1 - twilightCoolStrength * 0.05),
            b: adjusted.b * (1 + twilightCoolStrength * 0.1)
        };
    }
    if (grayCloudStrength > 0) {
        adjusted = mixColor(adjusted, { r: 206, g: 214, b: 228 }, grayCloudStrength);
    }
    return adjusted;
}
function transitionStrength(weather, settings) {
    return Math.max(edgeWindowWeight(weather, 'sunrise', settings), edgeWindowWeight(weather, 'sunset', settings));
}
function applyWebcamResponse(color, locationKey, timestamp, date, weather, settings) {
    const twilight = transitionStrength(weather, settings);
    const fullNight = weather.daylightRatio === 0
        ? clamp((Math.abs(weather.solarPhase) - 0.42) / 0.38, 0, 1)
        : 0;
    const sensorNoise = deterministicNoise(bucketSeed(locationKey, date, 20, 'sensor'));
    const sensorDrop = Math.max(0, deterministicNoise(bucketSeed(locationKey, date, 30, 'drop')));
    const bandingNoise = deterministicNoise(bucketSeed(locationKey, date, 10, 'band'));
    const wetFactor = clamp((weather.precipitation + weather.rain + weather.snowfall) / 4, 0, 1);
    let adjusted = color;
    if (twilight > 0) {
        const gray = averageLuminance(adjusted) * (0.88 + Math.max(0, bandingNoise) * 0.08);
        const smear = 0.18 + twilight * 0.2 + Math.max(0, sensorNoise) * 0.05;
        adjusted = mixColor(adjusted, { r: gray, g: gray, b: gray + twilight * 6 }, clamp(smear, 0, 0.62));
        const rowExposure = deterministicNoise(bucketSeed(locationKey, date, 1440, 'twilight-row-exposure'));
        const lagBand = deterministicNoise(continuousBucketSeed(locationKey, date, 20, 'twilight-lag'));
        const rowStripe = deterministicNoise(bucketSeed(locationKey, date, 1440, 'twilight-row-stripe'));
        const lagLift = twilight * (0.02 + Math.max(0, rowExposure) * 0.035 + Math.max(0, lagBand) * 0.03);
        adjusted = {
            r: adjusted.r * (1 - lagLift * 0.1),
            g: adjusted.g * (1 - lagLift * 0.06),
            b: adjusted.b * (1 - lagLift * 0.03)
        };
        const stripeStrength = twilight * (0.005 + Math.max(0, rowStripe) * 0.015 + Math.max(0, lagBand) * 0.012);
        adjusted = {
            r: adjusted.r + stripeStrength * 4,
            g: adjusted.g + stripeStrength * 5,
            b: adjusted.b + stripeStrength * 8
        };
        const compression = 1 - twilight * (0.08 + sensorDrop * 0.22);
        adjusted = {
            r: adjusted.r * compression,
            g: adjusted.g * compression,
            b: adjusted.b * compression
        };
        const quantizeStep = 1 + Math.round(twilight * 2 + Math.max(0, sensorNoise) * 1.2);
        adjusted = {
            r: Math.round(adjusted.r / quantizeStep) * quantizeStep,
            g: Math.round(adjusted.g / quantizeStep) * quantizeStep,
            b: Math.round(adjusted.b / quantizeStep) * quantizeStep
        };
    }
    if (fullNight > 0) {
        const illumination = moonIllumination(date);
        const moonPresence = clamp(0.48 + deterministicNoise(bucketSeed(locationKey, date, 1440, 'moon-presence')) * 0.34, 0, 1);
        const moonAltitude = clamp(0.34 + deterministicNoise(continuousBucketSeed(locationKey, date, 180, 'moon-altitude')) * 0.62, 0, 1);
        const moonClarity = clamp((1 - weather.cloudCover / 100) * (1 - wetFactor * 0.65), 0, 1);
        const moonBrightness = clamp((illumination - 0.08) / 0.92, 0, 1);
        const moonStrength = moonBrightness * moonPresence * (0.45 + moonAltitude * 0.55) * (0.22 + moonClarity * 0.78) * settings.generator.moon.brightness;
        const moonTint = {
            r: 6 + moonStrength * 24,
            g: 10 + moonStrength * 34,
            b: 18 + moonStrength * 78 * settings.generator.moon.blueBoost
        };
        const blackBase = { r: 0, g: 0, b: 0 };
        const nightBase = mixColor(blackBase, moonTint, clamp(moonStrength * 1.35, 0, 1));
        adjusted = mixColor(adjusted, nightBase, 0.84 * fullNight + 0.08);
        const moonLift = moonStrength * fullNight;
        adjusted = {
            r: adjusted.r + moonLift * 16,
            g: adjusted.g + moonLift * 24,
            b: adjusted.b + moonLift * 52
        };
        adjusted = {
            r: adjusted.r * (1 - moonLift * 0.12),
            g: adjusted.g * (1 - moonLift * 0.05),
            b: adjusted.b * (1 + moonLift * 0.14)
        };
        const horizonFactor = clamp(1 - Math.abs(moonAltitude - 0.1) / 0.11, 0, 1);
        const flareChance = clamp((Math.max(0, deterministicNoise(continuousBucketSeed(locationKey, date, 90, 'moon-flare'))) - 0.94) / 0.06, 0, 1);
        const flareStrength = clamp((illumination - 0.82) / 0.18, 0, 1) * horizonFactor * flareChance * (0.3 + moonClarity * 0.7) * settings.generator.moon.flareStrength;
        if (flareStrength > 0) {
            const flareGray = averageLuminance(adjusted) + flareStrength * 46;
            adjusted = mixColor(adjusted, { r: flareGray - 2, g: flareGray + 6, b: flareGray + 28 }, 0.22 + flareStrength * 0.32);
            adjusted = {
                r: adjusted.r + flareStrength * 20,
                g: adjusted.g + flareStrength * 34,
                b: adjusted.b + flareStrength * 76
            };
        }
        const blackout = 1 - fullNight * (0.31 + Math.max(0, sensorDrop) * 0.18) + moonLift * 0.26 + flareStrength * 0.22;
        adjusted = {
            r: adjusted.r * blackout,
            g: adjusted.g * blackout,
            b: adjusted.b * blackout
        };
        const nightStep = moonStrength > 0.1 || flareStrength > 0 ? 2 : 1;
        adjusted = {
            r: Math.round(adjusted.r / nightStep) * nightStep,
            g: Math.round(adjusted.g / nightStep) * nightStep,
            b: Math.round(adjusted.b / nightStep) * nightStep
        };
    }
    const lowLightJitter = twilight > 0 || fullNight > 0
        ? (1 + Math.max(0, sensorNoise) * 2) * settings.generator.camera.lowLightJitterStrength
        : 0;
    return {
        r: adjusted.r + deterministicNoise(`${locationKey}:${timestamp}:cam-r`) * lowLightJitter,
        g: adjusted.g + deterministicNoise(`${locationKey}:${timestamp}:cam-g`) * lowLightJitter,
        b: adjusted.b + deterministicNoise(`${locationKey}:${timestamp}:cam-b`) * lowLightJitter
    };
}
function weatherCodePenalty(weatherCode) {
    if (weatherCode >= 95)
        return 0.36;
    if (weatherCode >= 80)
        return 0.26;
    if (weatherCode >= 70)
        return 0.18;
    if (weatherCode >= 60)
        return 0.22;
    if (weatherCode >= 45)
        return 0.16;
    if (weatherCode >= 3)
        return 0.08;
    return 0;
}
function generateSkyColor(locationKey, timestamp, date, weather, settings) {
    let color = basePalette(weather, settings);
    color = applyTransitionFeathers(color, locationKey, date, weather, settings);
    color = applyRadiation(color, weather, settings);
    color = applyClouds(color, weather, settings);
    color = applyMoisture(color, weather, settings);
    color = applySnow(color, weather);
    color = applyTemperature(color, weather);
    color = applyExposure(color, weather, settings);
    color = applyOrganicVariation(color, locationKey, timestamp, date, weather);
    color = applySummerMiddayFlattening(color, date, weather, settings);
    color = applySeasonalWhiteBalance(color, locationKey, date, weather);
    color = applyRegimeRatioFit(color, date, weather, settings);
    color = applyRealCameraBalance(color, weather, settings);
    color = applyWebcamResponse(color, locationKey, timestamp, date, weather, settings);
    const jitterBase = (2 + clamp(weather.cloudCover / 30, 0, 4) + clamp(weather.precipitation, 0, 3)) * settings.generator.noise.daylightJitterStrength;
    const jitterScale = weather.daylightRatio === 0 ? jitterBase * settings.generator.noise.nightJitterMultiplier : jitterBase;
    color = {
        r: color.r + deterministicNoise(`${locationKey}:${timestamp}:r`) * jitterScale,
        g: color.g + deterministicNoise(`${locationKey}:${timestamp}:g`) * jitterScale,
        b: color.b + deterministicNoise(`${locationKey}:${timestamp}:b`) * jitterScale
    };
    const seasonalSaturation = settings.generator.lighting.seasonalSaturationBase + clamp(Math.cos((date.month - 1) / 12 * Math.PI * 2) * settings.generator.lighting.seasonalSaturationAmplitude, -settings.generator.lighting.seasonalSaturationAmplitude, settings.generator.lighting.seasonalSaturationAmplitude);
    color = {
        r: color.r * seasonalSaturation,
        g: color.g * seasonalSaturation,
        b: color.b * seasonalSaturation
    };
    const confidenceBase = 0.92 - weatherCodePenalty(weather.weatherCode) - clamp(weather.cloudCover / 100, 0, 0.24) - clamp(weather.precipitation / 8, 0, 0.12);
    const confidence = clamp(confidenceBase, settings.generator.confidence.min, settings.generator.confidence.max);
    return {
        average: roundColor(color),
        confidence: Number(confidence.toFixed(2))
    };
}
