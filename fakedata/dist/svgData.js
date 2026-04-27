"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGeneratedRecord = validateGeneratedRecord;
exports.loadGeneratedRecords = loadGeneratedRecords;
exports.recordDateKey = recordDateKey;
exports.buildSvgTitle = buildSvgTitle;
exports.escapeXml = escapeXml;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
function validateGeneratedRecord(record, index) {
    if (!record?.timestamp || !record?.average) {
        throw new Error(`Invalid record at index ${index}`);
    }
    if (!Number.isFinite(record.average.r) || !Number.isFinite(record.average.g) || !Number.isFinite(record.average.b)) {
        throw new Error(`Record ${index} has an invalid average color.`);
    }
}
async function loadGeneratedRecords(inputFile) {
    const inputPath = path_1.default.resolve(inputFile);
    const raw = JSON.parse(await promises_1.default.readFile(inputPath, 'utf-8'));
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error('Input JSON must be a non-empty array of generated records.');
    }
    raw.forEach(validateGeneratedRecord);
    return { inputPath, records: raw };
}
function recordDateKey(timestamp) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp)) {
        throw new Error(`Invalid timestamp format: ${timestamp}`);
    }
    return timestamp.slice(0, 10);
}
function buildSvgTitle(inputPath, suffix) {
    const base = path_1.default.basename(inputPath, path_1.default.extname(inputPath));
    return `${base} ${suffix}`;
}
function escapeXml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
