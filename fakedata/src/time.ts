import { LocalDateTime } from './types';

export const INTERVAL_MINUTES = 5;

export function parseIsoMinute(value: string): LocalDateTime {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5])
  };
}

export function toTick(value: LocalDateTime): number {
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, 0, 0);
}

export function fromTick(tick: number): LocalDateTime {
  const date = new Date(tick);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes()
  };
}

export function addMinutes(value: LocalDateTime, minutes: number): LocalDateTime {
  return fromTick(toTick(value) + minutes * 60 * 1000);
}

export function formatLocalMinute(value: LocalDateTime): string {
  const year = `${value.year}`.padStart(4, '0');
  const month = `${value.month}`.padStart(2, '0');
  const day = `${value.day}`.padStart(2, '0');
  const hour = `${value.hour}`.padStart(2, '0');
  const minute = `${value.minute}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function formatLocalDate(value: LocalDateTime): string {
  return formatLocalMinute({ ...value, hour: 0, minute: 0 }).slice(0, 10);
}

export function startOfYear(year: number): LocalDateTime {
  return { year, month: 1, day: 1, hour: 0, minute: 0 };
}

export function endOfYear(year: number): LocalDateTime {
  return { year, month: 12, day: 31, hour: 23, minute: 55 };
}

export function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

export function expectedIntervals(year: number): number {
  return (isLeapYear(year) ? 366 : 365) * 24 * (60 / INTERVAL_MINUTES);
}