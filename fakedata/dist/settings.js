"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDefaultProjectSettings = buildDefaultProjectSettings;
exports.loadProjectSettings = loadProjectSettings;
exports.saveProjectSettings = saveProjectSettings;
exports.inferProjectFolderFromInput = inferProjectFolderFromInput;
exports.getDefaultProjectSettings = getDefaultProjectSettings;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const DEFAULT_LOCATION = {
    title: 'Location',
    latitude: 0,
    longitude: 0,
    timezone: 'UTC',
    year: 2025
};
const DEFAULT_PROJECT_SETTINGS = {
    location: DEFAULT_LOCATION,
    generator: {
        weather: {
            cachePolicy: 'prefer-cache',
            apiBaseUrl: 'https://archive-api.open-meteo.com/v1/archive',
            transitionMinutes: 20,
            visibilityFallbackMeters: 16000
        },
        palette: {
            preDawn: { r: 18, g: 28, b: 48 },
            dawnGray: { r: 88, g: 100, b: 128 },
            sunriseWarm: { r: 228, g: 176, b: 122 },
            dayBlue: { r: 126, g: 184, b: 236 },
            dusk: { r: 214, g: 156, b: 120 },
            twilightGray: { r: 104, g: 110, b: 130 },
            night: { r: 12, g: 20, b: 36 }
        },
        lighting: {
            radiationStrength: 1,
            cloudDarkeningStrength: 1,
            moistureDarkeningStrength: 1,
            exposureStrength: 1,
            summerDayCoreFlatteningStrength: 1,
            rendererDayCoreDarkeningStrength: 1,
            seasonalSaturationBase: 0.98,
            seasonalSaturationAmplitude: 0.03
        },
        transition: {
            dawnDuskJitterStrength: 1,
            warmthStrength: 1,
            coolStrength: 1,
            featherStrength: 1,
            occlusionStrength: 1,
            ambientStrength: 1
        },
        camera: {
            dayCoolStrength: 1,
            twilightCoolStrength: 1,
            grayCloudStrength: 1,
            lowLightJitterStrength: 1
        },
        moon: {
            brightness: 1,
            blueBoost: 1,
            flareStrength: 1
        },
        noise: {
            daylightJitterStrength: 1,
            nightJitterMultiplier: 0.18
        },
        confidence: {
            min: 0.45,
            max: 0.95
        }
    },
    render: {
        dayGrid: {
            boxSize: 4,
            exportPng: true,
            leftMarginScale: 10,
            topMarginScale: 5,
            mirrorLegendBorder: true,
            edgeShiftEarlyColumns: -1,
            edgeShiftLateColumns: 2,
            edgeJitterStrength: 1,
            sunriseGlowIntensity: 1,
            sunsetGlowIntensity: 1,
            sunriseGlowColor: { r: 236, g: 178, b: 114 },
            sunsetGlowColor: { r: 244, g: 166, b: 96 },
            sunriseGlowHighlightColor: { r: 246, g: 224, b: 204 },
            sunsetGlowHighlightColor: { r: 252, g: 230, b: 208 },
            sunriseGrayColor: { r: 108, g: 114, b: 128 },
            sunsetGrayColor: { r: 84, g: 96, b: 118 },
            sunsetGrayAmount: 1,
            sunsetGrayBlueStrength: 1,
            sunsetAfterglowIntensity: 2.35,
            sunsetAfterglowCenterColumns: 4.5,
            sunsetAfterglowReachColumns: 4.5,
            sunsetAfterglowColor: { r: 92, g: 110, b: 146 }
        },
        spiral: {
            defaultPattern: 'even',
            even: {
                circleRadius: 5,
                strokeWidth: 1,
                strokeColor: '#ccc',
                backgroundColor: 'black',
                b: 2,
                maxThetaStep: 1,
                chord: 10
            },
            vogel: {
                circleRadius: 5,
                strokeWidth: 1,
                strokeColor: '#ccc',
                backgroundColor: 'black',
                spacingFactor: 0.9,
                goldenAngle: Math.PI * (3 - Math.sqrt(5))
            }
        }
    }
};
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function deepMerge(base, override) {
    if (override === undefined) {
        if (Array.isArray(base)) {
            return [...base];
        }
        if (isPlainObject(base)) {
            const clone = {};
            for (const [key, value] of Object.entries(base)) {
                clone[key] = deepMerge(value);
            }
            return clone;
        }
        return base;
    }
    if (Array.isArray(base) || Array.isArray(override)) {
        return override;
    }
    if (isPlainObject(base) && isPlainObject(override)) {
        const merged = {};
        const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
        for (const key of keys) {
            const baseValue = base[key];
            const overrideValue = override[key];
            if (overrideValue === undefined) {
                merged[key] = deepMerge(baseValue);
            }
            else if (baseValue === undefined) {
                merged[key] = overrideValue;
            }
            else {
                merged[key] = deepMerge(baseValue, overrideValue);
            }
        }
        return merged;
    }
    return override;
}
function normalizeLegacySettings(raw) {
    const normalized = { ...raw };
    const legacyLocationKeys = ['title', 'latitude', 'longitude', 'timezone', 'year'];
    const location = isPlainObject(raw.location) ? { ...raw.location } : {};
    for (const key of legacyLocationKeys) {
        if (normalized[key] !== undefined && location[key] === undefined) {
            location[key] = normalized[key];
        }
        delete normalized[key];
    }
    delete normalized.source;
    if (Object.keys(location).length) {
        normalized.location = location;
    }
    return normalized;
}
function buildDefaultProjectSettings(location) {
    return deepMerge(DEFAULT_PROJECT_SETTINGS, location ? { location } : undefined);
}
async function loadProjectSettings(projectFolder, locationDefaults) {
    const settingsPath = path_1.default.join(projectFolder, 'settings.json');
    const defaults = buildDefaultProjectSettings(locationDefaults);
    const exists = await promises_1.default.stat(settingsPath).then(() => true).catch(() => false);
    if (!exists) {
        return { settings: defaults, settingsPath, exists: false };
    }
    const raw = normalizeLegacySettings(JSON.parse(await promises_1.default.readFile(settingsPath, 'utf-8')));
    return {
        settings: deepMerge(defaults, raw),
        settingsPath,
        exists: true
    };
}
async function saveProjectSettings(projectFolder, settings) {
    const settingsPath = path_1.default.join(projectFolder, 'settings.json');
    await promises_1.default.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    return settingsPath;
}
function inferProjectFolderFromInput(inputFile) {
    return path_1.default.dirname(path_1.default.resolve(inputFile));
}
function getDefaultProjectSettings() {
    return buildDefaultProjectSettings();
}
