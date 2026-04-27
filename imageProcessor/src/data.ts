import fs from 'fs/promises';
import path from 'path';

export interface AverageColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface OutputRecord {
  file: string;
  average: AverageColor;
}

export interface BackfillRecord {
  timestamp: string;
  average: AverageColor;
  source: 'weather-backfill';
  confidence: number;
  weather?: Record<string, number | string | null>;
}

export interface VisualEntry {
  date: Date;
  average: AverageColor;
  source: 'observed' | 'weather-backfill';
  confidence?: number;
}

function parseTimestampParts(value: string): Date | null {
  const match = value.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/) ?? value.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  return new Date(+year, +month - 1, +day, +hour, +minute, 0, 0);
}

export function parseOutputFileDate(file: string): Date | null {
  return parseTimestampParts(file);
}

export async function loadObservedRecords(folder: string): Promise<OutputRecord[]> {
  const outputPath = path.join(folder, 'output.json');
  const exists = await fs.stat(outputPath).then(() => true).catch(() => false);
  if (!exists) return [];

  const raw = JSON.parse(await fs.readFile(outputPath, 'utf-8')) as OutputRecord[];
  return raw.filter(record => !!parseOutputFileDate(record.file));
}

export async function loadBackfillRecords(folder: string): Promise<BackfillRecord[]> {
  const backfillPath = path.join(folder, 'backfill.json');
  const exists = await fs.stat(backfillPath).then(() => true).catch(() => false);
  if (!exists) return [];

  const raw = JSON.parse(await fs.readFile(backfillPath, 'utf-8')) as BackfillRecord[];
  return raw.filter(record => !!parseTimestampParts(record.timestamp));
}

export async function loadMergedEntries(folder: string): Promise<VisualEntry[]> {
  const observed = await loadObservedRecords(folder);
  const synthetic = await loadBackfillRecords(folder);

  const merged = new Map<string, VisualEntry>();

  for (const record of synthetic) {
    const date = parseTimestampParts(record.timestamp);
    if (!date) continue;

    merged.set(record.timestamp, {
      date,
      average: record.average,
      source: 'weather-backfill',
      confidence: record.confidence
    });
  }

  for (const record of observed) {
    const date = parseOutputFileDate(record.file);
    if (!date) continue;

    merged.set(formatLocalMinute(date), {
      date,
      average: record.average,
      source: 'observed'
    });
  }

  return [...merged.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
}

export function formatLocalMinute(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
