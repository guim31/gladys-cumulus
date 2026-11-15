// -----------------------------------------------------------------------------
// The three sources, parsed from their fixtures (test/fixtures/cumulus).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_TAGS,
  countValues,
  parseApiTags,
  parseClientraw,
  parseRealtime,
  parseTagJson,
} from '../src/cumulus/parse.js';
import { requestUrl } from '../src/cumulus/source.js';
import { FIXTURES, REALTIME_TIME_MS, apiAnswer } from './helpers/world.js';

const close = (actual, expected, digits = 2) =>
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} is not close to ${expected}`);

test('API: the tags are asked with rc first, under the address of Cumulus MX', () => {
  assert.equal(API_TAGS[0], 'rc');
  const query = `?${API_TAGS.join('&')}`;
  for (const address of [
    'http://192.0.2.10:8998',
    'http://192.0.2.10:8998/',
    'http://192.0.2.10:8998/now.html',
    'http://192.0.2.10:8998/api/data/currentdata',
  ]) {
    const url = requestUrl('cumulusmx', address);
    assert.equal(url.pathname, '/api/tags/process.json', address);
    assert.equal(url.search, query);
  }
  assert.equal(
    requestUrl('cumulusmx', 'https://meteo.example/cumulus/').pathname,
    '/cumulus/api/tags/process.json',
  );
  assert.equal(
    requestUrl('realtime', 'http://h/realtime.txt?x=1').toString(),
    'http://h/realtime.txt?x=1',
  );
});

test('API: an unescaped quote in the station name does not lose the answer', () => {
  assert.throws(() => JSON.parse(FIXTURES.apiMetric));
  const tags = parseTagJson(FIXTURES.apiMetric);
  assert.equal(tags.location, 'Station "Les Pins"');
  assert.equal(tags.temp, '9.8');
  assert.equal(parseTagJson('<html>not found</html>'), null);
});

test('API: metric answer', () => {
  const reading = parseApiTags(parseTagJson(FIXTURES.apiMetric));
  assert.equal(reading.time, null);
  assert.equal(reading.stationName, 'Station "Les Pins"');
  assert.equal(reading.software, 'Cumulus MX 4.6.0 b4107');
  assert.equal(reading.temperature, 9.8);
  assert.equal(reading.feelsLike, 7.5);
  assert.equal(reading.humidity, 87);
  assert.equal(reading.indoorTemperature, 20.9);
  assert.equal(reading.pressure, 1012.4);
  // -0.4 hPa per hour over 3 hours.
  close(reading.pressureTrend, -1.2);
  assert.equal(reading.windSpeed, 12.4);
  assert.equal(reading.windGust, 29.2);
  assert.equal(reading.windDirection, 230);
  assert.equal(reading.rainToday, 3.2);
  assert.equal(reading.raining, true);
  assert.equal(reading.uv, 1);
  assert.equal(reading.radiation, 182);
  assert.equal(reading.batteryLow, false);
  assert.equal(reading.stopped, false);
  assert.equal(countValues(reading), 17);
});

test('API: US units are converted, missing sensors are null', () => {
  const reading = parseApiTags(parseTagJson(FIXTURES.apiUs));
  close(reading.temperature, 9);
  close(reading.dewPoint, 5);
  close(reading.pressure, 1013.21);
  close(reading.windSpeed, 8.05);
  close(reading.rainToday, 3.05);
  assert.equal(reading.indoorTemperature, null);
  assert.equal(reading.uv, null);
  assert.equal(reading.radiation, null);
  assert.equal(reading.batteryLow, true);
  assert.equal(reading.raining, false);
});

test('API: stopped data, unknown units and foreign answers', () => {
  assert.equal(parseApiTags(parseTagJson(apiAnswer({ DataStopped: '1' }))).stopped, true);
  // An unknown wind unit drops the speeds, not the rest.
  const odd = parseApiTags(parseTagJson(apiAnswer({ windunit: 'furlong/fortnight' })));
  assert.equal(odd.windSpeed, null);
  assert.equal(odd.temperature, 9.8);
  assert.equal(parseApiTags({ foo: 'bar' }), null);
  assert.equal(parseApiTags(null), null);
});

test('realtime.txt of Cumulus MX: values, local date, zeros of absent sensors', () => {
  const reading = parseRealtime(FIXTURES.realtimeMx);
  assert.equal(reading.time, REALTIME_TIME_MS);
  assert.equal(reading.stamp, '15/11/26 12:30:05');
  assert.equal(reading.software, 'Cumulus 4.1.3 b4107');
  assert.equal(reading.temperature, 9.8);
  assert.equal(reading.windSpeed, 12.4);
  // The 10-minute high gust, the average bearing.
  assert.equal(reading.windGust, 29.2);
  assert.equal(reading.windDirection, 230);
  assert.equal(reading.rainRate, 0.6);
  assert.equal(reading.rainToday, 3.2);
  assert.equal(reading.feelsLike, 7.5);
  assert.equal(reading.contactLost, false);
  assert.deepEqual(reading.maybeAbsent, ['indoorTemperature', 'indoorHumidity', 'uv', 'radiation']);
});

test('realtime.txt of the Cumulus wiki: mph, mb, and a lost sensor contact', () => {
  const reading = parseRealtime(FIXTURES.realtimeWiki);
  assert.equal(reading.time, new Date(2008, 9, 18, 16, 3, 45).getTime());
  close(reading.windSpeed, 38.95);
  close(reading.windGust, 57.94);
  assert.equal(reading.pressure, 999.7);
  assert.equal(reading.contactLost, true);
});

test('realtime.txt: other date separators, garbage refused', () => {
  const dotted = FIXTURES.realtimeMx.replace('15/11/26', '15.11.26');
  assert.equal(parseRealtime(dotted).time, REALTIME_TIME_MS);
  assert.equal(parseRealtime('hello world'), null);
  assert.equal(parseRealtime(FIXTURES.clientraw), null);
  assert.equal(parseRealtime(FIXTURES.realtimeMx.replace(' km/h ', ' parsec ')), null);
});

test('clientraw.txt of Weather Display: knots, mm per minute, name and date', () => {
  const reading = parseClientraw(FIXTURES.clientraw);
  assert.equal(reading.stationName, 'mystation');
  assert.equal(reading.software, 'Weather Display 10.37S153');
  assert.equal(reading.time, new Date(2026, 10, 15, 5, 24, 58).getTime());
  assert.equal(reading.temperature, -5.8);
  assert.equal(reading.humidity, 99);
  assert.equal(reading.pressure, 1028.7);
  close(reading.windSpeed, 1.6 * 1.852);
  close(reading.windGust, 2.3 * 1.852);
  assert.equal(reading.windDirection, 306);
  assert.equal(reading.dewPoint, -5.9);
  assert.equal(reading.rainRate, 0);
  assert.equal(reading.raining, false);
  assert.equal(reading.indoorTemperature, 22);
  const wet = FIXTURES.clientraw.replace(/^12345 ((?:\S+ ){9})0\.00/, '12345 $10.05');
  assert.equal(parseClientraw(wet).rainRate, 3);
  assert.equal(parseClientraw(wet).raining, true);
  assert.equal(parseClientraw(FIXTURES.realtimeMx), null);
});
