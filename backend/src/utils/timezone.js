const HttpError = require('../errors/HttpError');

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Milliseconds the given zone is ahead of UTC at a given instant.
function zoneOffsetMs(utcMs, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value])
  );
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asIfUtc - Math.floor(utcMs / 1000) * 1000;
}

// The UTC instant at which the wall clock in `timeZone` reads the given
// local date/time. Two passes so it stays correct across a DST change.
function zonedTimeToUtc(y, m, d, h, mi, s, ms, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h, mi, s, ms);
  const first = guess - zoneOffsetMs(guess, timeZone);
  return new Date(guess - zoneOffsetMs(first, timeZone));
}

function parseDateOnly(value, label) {
  const match = DATE_ONLY.exec(String(value));
  if (!match) throw new HttpError(400, `${label} must be a date in YYYY-MM-DD format`);
  const [, y, m, d] = match.map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new HttpError(400, `${label} is not a real calendar date`);
  }
  return { y, m, d };
}

// Turns an optional from/to pair of calendar dates (as picked in an admin
// date field) into an inclusive createdAt range covering those whole days in
// the business timezone. Returns null when neither bound is given.
function businessDayRange({ from, to }, timeZone) {
  const range = {};
  if (from) {
    const { y, m, d } = parseDateOnly(from, 'from');
    range.gte = zonedTimeToUtc(y, m, d, 0, 0, 0, 0, timeZone);
  }
  if (to) {
    const { y, m, d } = parseDateOnly(to, 'to');
    range.lte = zonedTimeToUtc(y, m, d, 23, 59, 59, 999, timeZone);
  }
  if (range.gte && range.lte && range.gte > range.lte) {
    throw new HttpError(400, '"from" date cannot be after the "to" date');
  }
  return Object.keys(range).length ? range : null;
}

module.exports = { businessDayRange, zonedTimeToUtc };
