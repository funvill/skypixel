"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLocalMinute = exports.loadMergedEntries = exports.loadBackfillRecords = exports.loadObservedRecords = exports.parseOutputFileDate = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
function parseTimestampParts(value) {
    var _a;
    const match = (_a = value.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/)) !== null && _a !== void 0 ? _a : value.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match)
        return null;
    const [, year, month, day, hour, minute] = match;
    return new Date(+year, +month - 1, +day, +hour, +minute, 0, 0);
}
function parseOutputFileDate(file) {
    return parseTimestampParts(file);
}
exports.parseOutputFileDate = parseOutputFileDate;
async function loadObservedRecords(folder) {
    const outputPath = path_1.default.join(folder, 'output.json');
    const exists = await promises_1.default.stat(outputPath).then(() => true).catch(() => false);
    if (!exists)
        return [];
    const raw = JSON.parse(await promises_1.default.readFile(outputPath, 'utf-8'));
    return raw.filter(record => !!parseOutputFileDate(record.file));
}
exports.loadObservedRecords = loadObservedRecords;
async function loadBackfillRecords(folder) {
    const backfillPath = path_1.default.join(folder, 'backfill.json');
    const exists = await promises_1.default.stat(backfillPath).then(() => true).catch(() => false);
    if (!exists)
        return [];
    const raw = JSON.parse(await promises_1.default.readFile(backfillPath, 'utf-8'));
    return raw.filter(record => !!parseTimestampParts(record.timestamp));
}
exports.loadBackfillRecords = loadBackfillRecords;
async function loadMergedEntries(folder) {
    const observed = await loadObservedRecords(folder);
    const synthetic = await loadBackfillRecords(folder);
    const merged = new Map();
    for (const record of synthetic) {
        const date = parseTimestampParts(record.timestamp);
        if (!date)
            continue;
        merged.set(record.timestamp, {
            date,
            average: record.average,
            source: 'weather-backfill',
            confidence: record.confidence
        });
    }
    for (const record of observed) {
        const date = parseOutputFileDate(record.file);
        if (!date)
            continue;
        merged.set(formatLocalMinute(date), {
            date,
            average: record.average,
            source: 'observed'
        });
    }
    return [...merged.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
}
exports.loadMergedEntries = loadMergedEntries;
function formatLocalMinute(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
}
exports.formatLocalMinute = formatLocalMinute;
