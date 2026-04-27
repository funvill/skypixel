import fs from 'fs/promises';
import path from 'path';

import { GeneratedRecord } from './types';

export function validateGeneratedRecord(record: GeneratedRecord, index: number): void {
  if (!record?.timestamp || !record?.average) {
    throw new Error(`Invalid record at index ${index}`);
  }

  if (!Number.isFinite(record.average.r) || !Number.isFinite(record.average.g) || !Number.isFinite(record.average.b)) {
    throw new Error(`Record ${index} has an invalid average color.`);
  }
}

export async function loadGeneratedRecords(inputFile: string): Promise<{ inputPath: string; records: GeneratedRecord[] }> {
  const inputPath = path.resolve(inputFile);
  const raw = JSON.parse(await fs.readFile(inputPath, 'utf-8')) as GeneratedRecord[];

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Input JSON must be a non-empty array of generated records.');
  }

  raw.forEach(validateGeneratedRecord);
  return { inputPath, records: raw };
}

export function recordDateKey(timestamp: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp)) {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }

  return timestamp.slice(0, 10);
}

export function buildSvgTitle(inputPath: string, suffix: string): string {
  const base = path.basename(inputPath, path.extname(inputPath));
  return `${base} ${suffix}`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}