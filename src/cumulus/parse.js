// -----------------------------------------------------------------------------
// The three sources, turned into one reading.
//
//   - Cumulus MX API: `GET /api/tags/process.json?rc&temp&hum…` on the
//     interface port of Cumulus MX (8998). It answers the named web tags as a
//     JSON object of strings (Api.cs, ApiTagProcessor.cs). `rc` first asks for
//     plain numbers (no thousands separator, a dot for the decimals). It
//     carries no measurement date: the reading is live, dated on arrival.
//   - realtime.txt: one line of space-separated fields written by Cumulus 1
//     and Cumulus MX (format on the Cumulus wiki, CreateRealtimeFileString in
//     Cumulus.cs). Date dd/mm/yy (the separator follows the Windows locale),
//     time hh:mm:ss, units in fields 14 to 17.
//   - clientraw.txt: one line of space-separated fields written by Weather
//     Display, starting with `12345`. Fixed units: knots, °C, hPa, mm, rain
//     rate in mm per minute.
//
// A reading has the measurements in °C, km/h, hPa, mm and mm/h, null when the
// source does not carry them. Both text files write 0 for a sensor the station
// does not have (indoor, UV, solar): `maybeAbsent` lists those values, a 0
// there does not prove the sensor exists.
// -----------------------------------------------------------------------------

import { convert, knownUnit, toNumber } from './units.js';

export const SOURCES = {
  CUMULUS_MX: 'cumulusmx',
  REALTIME: 'realtime',
  CLIENTRAW: 'clientraw',
};

// The web tags asked to Cumulus MX. `rc` must come first (ApiTagProcessor).
export const API_TAGS = [
  'rc',
  'temp',
  'feelslike',
  'dew',
  'hum',
  'intemp',
  'inhum',
  'press',
  'presstrendval',
  'wspeed',
  'wgust',
  'avgbearing',
  'rrate',
  'rfall',
  'IsRaining',
  'UV',
  'SolarRad',
  'LowBatteryList',
  'DataStopped',
  'tempunitnodeg',
  'windunit',
  'pressunit',
  'rainunit',
  'version',
  'build',
  // Last: free text, the only value that could break the JSON (see parseTagJson).
  'location',
];

const EMPTY = {
  time: null,
  stamp: null,
  stationName: null,
  software: null,
  temperature: null,
  feelsLike: null,
  dewPoint: null,
  humidity: null,
  indoorTemperature: null,
  indoorHumidity: null,
  pressure: null,
  pressureTrend: null,
  windSpeed: null,
  windGust: null,
  windDirection: null,
  rainRate: null,
  rainToday: null,
  raining: null,
  uv: null,
  radiation: null,
  batteryLow: null,
  stopped: false,
  contactLost: false,
  maybeAbsent: [],
};

const percent = (value) => (value !== null && value >= 0 && value <= 100 ? value : null);
const degrees = (value) => (value !== null && value >= 0 && value <= 360 ? value % 360 : null);
const positive = (value) => (value !== null && value >= 0 ? value : null);

/**
 * The JSON of the tag API, read leniently: Cumulus MX writes the values as
 * they are, without escaping, so a quote in the station name breaks
 * JSON.parse. The keys are known tag names.
 * @returns {Record<string, string>|null}
 */
export function parseTagJson(body) {
  try {
    const json = JSON.parse(body);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      return Object.fromEntries(Object.entries(json).map(([key, value]) => [key, String(value)]));
    }
    return null;
  } catch {
    const text = String(body).trim();
    if (!text.startsWith('{"') || !text.endsWith('"}')) {
      return null;
    }
    const values = {};
    const pattern = /"([A-Za-z0-9_]+)":"(.*?)"(?=,"[A-Za-z0-9_]+":"|}$)/gs;
    for (const [, key, value] of text.matchAll(pattern)) {
      values[key] = value;
    }
    return Object.keys(values).length > 0 ? values : null;
  }
}

/**
 * A reading of the Cumulus MX tag API.
 * @param {Record<string, string>} tags
 * @returns {object|null} null when it is not an answer of Cumulus MX
 */
export function parseApiTags(tags) {
  if (!tags || tags.temp === undefined || tags.tempunitnodeg === undefined) {
    return null;
  }
  const temperatureUnit = tags.tempunitnodeg;
  const t = (key) => convert(toNumber(tags[key]), 'temperature', temperatureUnit);
  const speed = (key) => positive(convert(toNumber(tags[key]), 'speed', tags.windunit));
  const rain = (key) => positive(convert(toNumber(tags[key]), 'rain', tags.rainunit));
  const pressureTrend = convert(toNumber(tags.presstrendval), 'pressure', tags.pressunit);
  const rainRate = rain('rrate');
  const lowBattery = typeof tags.LowBatteryList === 'string' ? tags.LowBatteryList.trim() : null;
  const name = typeof tags.location === 'string' ? tags.location.trim() : '';
  const version = [tags.version, tags.build].filter((part) => part && part !== '-').join(' b');
  return {
    ...EMPTY,
    stationName: name || null,
    software: version ? `Cumulus MX ${version}` : 'Cumulus MX',
    temperature: t('temp'),
    feelsLike: t('feelslike'),
    dewPoint: t('dew'),
    humidity: percent(toNumber(tags.hum)),
    indoorTemperature: t('intemp'),
    indoorHumidity: percent(toNumber(tags.inhum)),
    pressure: convert(toNumber(tags.press), 'pressure', tags.pressunit),
    // Cumulus gives the change per hour, averaged over 3 hours: published as
    // the change over 3 hours, the usual barometric tendency.
    pressureTrend: pressureTrend === null ? null : pressureTrend * 3,
    windSpeed: speed('wspeed'),
    windGust: speed('wgust'),
    windDirection: degrees(toNumber(tags.avgbearing)),
    rainRate,
    rainToday: rain('rfall'),
    raining: tags.IsRaining === '1' ? true : rainRate === null ? null : rainRate > 0 ? true : false,
    uv: positive(toNumber(tags.UV)),
    radiation: positive(toNumber(tags.SolarRad)),
    batteryLow: lowBattery === null ? null : lowBattery !== '',
    stopped: tags.DataStopped === '1',
  };
}

/** Local date and time, in the container's time zone (Gladys injects TZ). */
function localTime(year, month, day, hours, minutes, seconds) {
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day, hours, minutes, seconds);
  return date.getMonth() === month - 1 && date.getDate() === day ? date.getTime() : null;
}

/**
 * A reading of realtime.txt.
 * @param {string} text the whole file
 * @returns {object|null} null when it is not a realtime.txt line
 */
export function parseRealtime(text) {
  const fields = String(text).trim().split(/\s+/);
  if (fields.length < 40) {
    return null;
  }
  const date = /^(\d{1,2})\D(\d{1,2})\D(\d{2,4})$/.exec(fields[0]);
  const clock = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(fields[1]);
  if (!date || !clock) {
    return null;
  }
  const [windUnit, temperatureUnit, pressureUnit, rainUnit] = fields.slice(13, 17);
  if (
    !knownUnit('speed', windUnit) ||
    !knownUnit('temperature', temperatureUnit) ||
    !knownUnit('pressure', pressureUnit) ||
    !knownUnit('rain', rainUnit)
  ) {
    return null;
  }
  // Field n of the documentation is fields[n - 1].
  const f = (n) => toNumber(fields[n - 1]);
  const t = (n) => convert(f(n), 'temperature', temperatureUnit);
  const speed = (n) => positive(convert(f(n), 'speed', windUnit));
  const rain = (n) => positive(convert(f(n), 'rain', rainUnit));
  const pressureTrend = convert(f(19), 'pressure', pressureUnit);
  const rainRate = rain(9);
  const indoorHumidity = percent(f(24));
  return {
    ...EMPTY,
    time: localTime(
      Number(date[3]),
      Number(date[2]),
      Number(date[1]),
      Number(clock[1]),
      Number(clock[2]),
      Number(clock[3]),
    ),
    stamp: `${fields[0]} ${fields[1]}`,
    software: `Cumulus ${fields[38]}${fields[39] ? ` b${fields[39]}` : ''}`,
    temperature: t(3),
    humidity: percent(f(4)),
    dewPoint: t(5),
    windSpeed: speed(6),
    // The 10-minute high gust (field 41), the latest wind speed on files
    // written before it existed.
    windGust: fields.length >= 41 ? speed(41) : speed(7),
    // Average bearing (field 47) when present, else the current one.
    windDirection: degrees(fields.length >= 47 ? f(47) : f(8)),
    rainRate,
    rainToday: rain(10),
    raining: rainRate === null ? null : rainRate > 0,
    pressure: convert(f(11), 'pressure', pressureUnit),
    pressureTrend: pressureTrend === null ? null : pressureTrend * 3,
    indoorTemperature: t(23),
    indoorHumidity,
    uv: fields.length >= 44 ? positive(f(44)) : null,
    radiation: fields.length >= 46 ? positive(f(46)) : null,
    // The console lost its outdoor sensors: values kept, station unreachable.
    contactLost: fields[50] === '1',
    feelsLike: fields.length >= 59 ? t(59) : null,
    maybeAbsent: ['indoorTemperature', 'indoorHumidity', 'uv', 'radiation'],
  };
}

/**
 * A reading of clientraw.txt.
 * @param {string} text the whole file
 * @returns {object|null} null when it is not a clientraw.txt line
 */
export function parseClientraw(text) {
  const fields = String(text).trim().split(/\s+/);
  if (fields[0] !== '12345' || fields.length < 80) {
    return null;
  }
  const f = (n) => toNumber(fields[n]);
  const knots = (n) => positive(convert(f(n), 'speed', 'kts'));
  const rate = positive(f(10));
  // Field 32: the station name, followed by "-" and the time of the file.
  const name = (fields[32] ?? '')
    .replace(/-\d{1,2}:\d{2}(:\d{2})?(_?[AP]M)?$/i, '')
    .replace(/_/g, ' ')
    .trim();
  const version = /^!!C?([\w.]+)!!$/.exec(fields[fields.length - 1] ?? '');
  const year = fields.length > 141 ? f(141) : null;
  const [hours, minutes, seconds, day, month] = [29, 30, 31, 35, 36].map(f);
  const time =
    year !== null && [hours, minutes, seconds, day, month].every((value) => value !== null)
      ? localTime(year, month, day, hours, minutes, seconds)
      : null;
  return {
    ...EMPTY,
    time,
    stamp: [29, 30, 31, 35, 36, 141].map((n) => fields[n]).join(' '),
    stationName: name || null,
    software: version ? `Weather Display ${version[1]}` : 'Weather Display',
    windSpeed: knots(1),
    windGust: knots(2),
    windDirection: degrees(f(3)),
    temperature: f(4),
    humidity: percent(f(5)),
    pressure: f(6),
    rainToday: positive(f(7)),
    rainRate: rate === null ? null : rate * 60,
    raining: rate === null ? null : rate > 0,
    indoorTemperature: f(12),
    indoorHumidity: percent(f(13)),
    dewPoint: f(72),
    uv: positive(f(79)),
    radiation: fields.length > 127 ? positive(f(127)) : null,
    maybeAbsent: ['indoorTemperature', 'indoorHumidity', 'uv', 'radiation'],
  };
}

/** How many measurements a reading carries, for the "check" action. */
export function countValues(reading) {
  const skip = new Set([
    'time',
    'stamp',
    'stationName',
    'software',
    'stopped',
    'contactLost',
    'maybeAbsent',
  ]);
  return Object.entries(reading).filter(
    ([key, value]) => !skip.has(key) && value !== null && value !== undefined,
  ).length;
}
