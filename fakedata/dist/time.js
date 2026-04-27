"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERVAL_MINUTES = void 0;
exports.parseIsoMinute = parseIsoMinute;
exports.toTick = toTick;
exports.fromTick = fromTick;
exports.addMinutes = addMinutes;
exports.formatLocalMinute = formatLocalMinute;
exports.formatLocalDate = formatLocalDate;
exports.startOfYear = startOfYear;
exports.endOfYear = endOfYear;
exports.isLeapYear = isLeapYear;
exports.expectedIntervals = expectedIntervals;
exports.INTERVAL_MINUTES = 5;
function parseIsoMinute(value) {
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
function toTick(value) {
    return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, 0, 0);
}
function fromTick(tick) {
    const date = new Date(tick);
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes()
    };
}
function addMinutes(value, minutes) {
    return fromTick(toTick(value) + minutes * 60 * 1000);
}
function formatLocalMinute(value) {
    const year = `${value.year}`.padStart(4, '0');
    const month = `${value.month}`.padStart(2, '0');
    const day = `${value.day}`.padStart(2, '0');
    const hour = `${value.hour}`.padStart(2, '0');
    const minute = `${value.minute}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
}
function formatLocalDate(value) {
    return formatLocalMinute({ ...value, hour: 0, minute: 0 }).slice(0, 10);
}
function startOfYear(year) {
    return { year, month: 1, day: 1, hour: 0, minute: 0 };
}
function endOfYear(year) {
    return { year, month: 12, day: 31, hour: 23, minute: 55 };
}
function isLeapYear(year) {
    return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}
function expectedIntervals(year) {
    return (isLeapYear(year) ? 366 : 365) * 24 * (60 / exports.INTERVAL_MINUTES);
}
