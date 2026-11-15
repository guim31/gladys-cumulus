// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and a fake web
// server answering as Cumulus MX or serving the weather files.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_URL,
  CLIENTRAW_URL,
  FIXTURES,
  MX_URL,
  REALTIME_URL,
  addStation,
  apiAnswer,
  createWorld,
  featureId,
  mockTime,
  realtimeLine,
} from './helpers/world.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const LANGS = ['en', 'fr', 'de', 'es'];

async function apiWorld(t, options = {}) {
  const advance = mockTime(t);
  const world = await createWorld({
    config: { source: 'cumulusmx', url: MX_URL, ...options.config },
    devices: options.devices,
    prepare: options.prepare,
  });
  t.after(() => world.app.stop());
  return { ...world, advance };
}

async function realtimeWorld(t, options = {}) {
  const advance = mockTime(t, options.start);
  const world = await createWorld({
    config: { source: 'realtime', url: REALTIME_URL, interval: 30 },
    prepare: options.prepare,
  });
  t.after(() => world.app.stop());
  return { ...world, advance };
}

const keysOf = (device) => device.features.map((f) => f.external_id.split(':').pop());

test('not configured: Gladys says what to enter, in every language', async (t) => {
  const world = await apiWorld(t, { config: { url: '' } });
  const status = world.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.deepEqual(Object.keys(status.message).sort(), [...LANGS].sort());
  assert.match(status.message.en, /Cumulus MX/);
  assert.equal(world.server.requests.length, 0);
  assert.deepEqual(world.gladys.fake.discoveredDevices, []);
});

test('Cumulus MX: the station is discovered with the features it measures', async (t) => {
  const world = await apiWorld(t);
  assert.equal(world.server.requests[0].url, API_URL);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  const [device] = world.gladys.fake.discoveredDevices;
  assert.equal(device.name, 'Station "Les Pins"');
  assert.equal(device.model, 'Cumulus MX');
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
  assert.deepEqual(keysOf(device), [
    'temperature',
    'feels_like',
    'dew_point',
    'humidity',
    'indoor_temperature',
    'indoor_humidity',
    'pressure_sea_level',
    'pressure_trend',
    'wind_speed',
    'wind_gust',
    'wind_direction',
    'rain_rate',
    'rain_today',
    'raining',
    'uv',
    'solar_radiation',
    'battery_low',
    'reachable',
    'data_age',
  ]);
  // French names by default.
  assert.equal(device.features[0].name, 'Température');
  assert.ok(device.features.every((feature) => feature.read_only));
});

test('states: everything when the station is added, then only changes, read by the container', async (t) => {
  const world = await apiWorld(t);
  await world.advance(20 * SECOND);
  // Not added yet: nothing published.
  assert.equal(world.gladys.fake.states.length, 0);

  await addStation(world);
  const last = (key) => world.gladys.fake.lastState(featureId(world.gladys, key));
  assert.equal(last('temperature'), 9.8);
  assert.equal(last('pressure_trend'), -1.2);
  assert.equal(last('rain_today'), 3.2);
  assert.equal(last('raining'), 1);
  assert.equal(last('reachable'), 1);
  assert.equal(last('data_age'), 0);
  assert.equal(world.gladys.fake.widgetRefreshes.length, 1);
  const published = world.gladys.fake.states.length;

  // The container reads Cumulus on its own timer (no onPoll from the core).
  world.server.files[API_URL] = apiAnswer({ temp: '10.4' });
  const reads = world.server.requests.length;
  await world.advance(30 * SECOND);
  assert.equal(world.server.requests.length, reads + 1);
  await world.advance(15 * SECOND);
  assert.equal(last('temperature'), 10.4);
  const changed = world.gladys.fake.states
    .slice(published)
    .map((s) => s.device_feature_external_id);
  assert.deepEqual(changed, [featureId(world.gladys, 'temperature')]);
});

test('Cumulus MX says its station stopped: unreachable, with a message, then back', async (t) => {
  const world = await apiWorld(t);
  await addStation(world);
  world.server.files[API_URL] = apiAnswer({ DataStopped: '1', temp: '-40' });
  await world.advance(30 * SECOND);
  await world.advance(15 * SECOND);
  const last = (key) => world.gladys.fake.lastState(featureId(world.gladys, key));
  assert.equal(last('reachable'), 0);
  // The stale values of a stopped station are not taken.
  assert.equal(last('temperature'), 9.8);
  const status = world.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.fr, /n’envoie plus/);

  world.server.files[API_URL] = apiAnswer({ temp: '11' });
  await world.advance(30 * SECOND);
  await world.advance(15 * SECOND);
  assert.equal(last('reachable'), 1);
  assert.equal(last('temperature'), 11);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
});

test('Cumulus MX down: a status in every language, the station unreachable', async (t) => {
  const world = await apiWorld(t);
  await addStation(world);
  world.server.failure = 'down';
  await world.advance(30 * SECOND);
  await world.advance(15 * SECOND);
  const status = world.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.deepEqual(Object.keys(status.message).sort(), [...LANGS].sort());
  assert.match(status.message.en, /port 8998/);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'reachable')), 0);

  world.server.failure = null;
  await world.advance(30 * SECOND);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
});

test('a wrong address: the format message of the chosen source', async (t) => {
  const world = await apiWorld(t, {
    prepare(server) {
      server.files[API_URL] = '<html>hello</html>';
    },
  });
  assert.match(world.gladys.fake.connectionStatus.message.en, /does not answer like Cumulus MX/);
  assert.deepEqual(world.gladys.fake.discoveredDevices, []);
});

test('realtime.txt: an unchanged file is no new measurement; silence makes it unreachable', async (t) => {
  const world = await realtimeWorld(t);
  const [device] = world.gladys.fake.discoveredDevices;
  assert.equal(device.model, 'Cumulus');
  // Indoor, UV and solar values are there (non-zero): their features too.
  assert.ok(keysOf(device).includes('uv'));
  await addStation(world);
  const last = (key) => world.gladys.fake.lastState(featureId(world.gladys, key));
  assert.equal(last('reachable'), 1);

  // The file keeps its date: the measurement ages.
  await world.advance(10 * MINUTE);
  assert.equal(last('data_age'), 10);
  assert.equal(last('reachable'), 1);
  await world.advance(5 * MINUTE);
  assert.equal(last('reachable'), 0);
  const silent = world.gladys.fake.sceneEvents
    .filter((e) => e.key === 'station_silent')
    .map((e) => e.data.after_minutes);
  assert.deepEqual(silent, ['5', '10', '15']);

  // Rewritten: reachable again, age back to 0.
  world.server.files[REALTIME_URL] = realtimeLine(16 * 60);
  await world.advance(30 * SECOND);
  await world.advance(15 * SECOND);
  assert.equal(last('reachable'), 1);
  assert.equal(last('data_age'), 0);
});

test('realtime.txt: zeros of absent sensors create no feature', async (t) => {
  const world = await realtimeWorld(t, {
    prepare(server) {
      server.files[REALTIME_URL] = realtimeLine(0, { 23: '0.0', 24: '0', 44: '0.0', 46: '0' });
    },
  });
  const keys = keysOf(world.gladys.fake.discoveredDevices[0]);
  for (const key of ['indoor_temperature', 'indoor_humidity', 'uv', 'solar_radiation']) {
    assert.ok(!keys.includes(key), key);
  }
  // A sun rising later: the feature appears.
  world.server.files[REALTIME_URL] = realtimeLine(60, { 23: '0.0', 24: '0', 44: '0.0', 46: '35' });
  await world.advance(30 * SECOND);
  assert.ok(keysOf(world.gladys.fake.discoveredDevices[0]).includes('solar_radiation'));
});

test('a file found already old: its age, unreachable, and no trigger fired', async (t) => {
  const world = await realtimeWorld(t, { start: Date.UTC(2026, 10, 15, 18, 0, 0) });
  await addStation(world);
  const age = world.gladys.fake.lastState(featureId(world.gladys, 'data_age'));
  assert.ok(age > 60, `age ${age}`);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'reachable')), 0);
});

test('the features of an added device never leave it', async (t) => {
  const first = await apiWorld(t);
  const added = first.gladys.fake.discoveredDevices[0];
  first.app.stop();
  const world = await createWorld({
    config: { source: 'cumulusmx', url: MX_URL },
    devices: [added],
    prepare(server) {
      server.files[API_URL] = apiAnswer({ UV: '-', SolarRad: '-', intemp: '-', inhum: '-' });
    },
  });
  t.after(() => world.app.stop());
  assert.equal(world.gladys.fake.discoveredDevices[0].features.length, added.features.length);
});

test('triggers: rain starting after a dry spell, then stopping; a strong gust', async (t) => {
  const world = await apiWorld(t, {
    prepare(server) {
      server.files[API_URL] = apiAnswer({ rrate: '0.0', IsRaining: '0', wgust: '10' });
    },
  });
  await addStation(world);
  const events = (key) => world.gladys.fake.sceneEvents.filter((e) => e.key === key);

  world.server.files[API_URL] = apiAnswer({ rrate: '1.2', IsRaining: '1', wgust: '55' });
  await world.advance(30 * SECOND);
  assert.equal(events('rain_started').length, 1);
  assert.deepEqual(
    events('gust_above').map((e) => e.data.above_kmh),
    ['30', '40', '50'],
  );
  assert.equal(events('rain_started')[0].data.station, 'Station "Les Pins"');

  world.server.files[API_URL] = apiAnswer({ rrate: '0.0', IsRaining: '0', wgust: '10' });
  await world.advance(16 * MINUTE);
  assert.deepEqual(
    events('rain_stopped').map((e) => e.data.after_minutes),
    ['15'],
  );
  assert.equal(events('rain_stopped')[0].data.rain_today_mm, 3.2);
});

test('clientraw.txt: Weather Display station, named after its file', async (t) => {
  mockTime(t, new Date(2026, 10, 15, 5, 25, 0).getTime());
  const world = await createWorld({ config: { source: 'clientraw', url: CLIENTRAW_URL } });
  t.after(() => world.app.stop());
  const [device] = world.gladys.fake.discoveredDevices;
  assert.equal(device.name, 'mystation');
  assert.equal(device.model, 'Weather Display');
  assert.ok(!keysOf(device).includes('uv'));
  await addStation(world);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'temperature')), -5.8);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'reachable')), 1);
});

test('check_source action: what the source gives, in every language', async (t) => {
  const world = await apiWorld(t);
  const ack = await world.gladys.fake.action('check_source', {});
  assert.equal(ack.success, true, ack.error);
  const result = ack.data.message;
  assert.deepEqual(Object.keys(result).sort(), [...LANGS].sort());
  assert.match(result.en, /cumulus\.example:8998\/api\/tags\/process\.json|cumulus\.example:8998/);
  assert.match(result.en, /Cumulus MX 4\.6\.0/);
  assert.match(result.fr, /17 valeurs/);

  world.server.failure = 'down';
  const down = (await world.gladys.fake.action('check_source', {})).data.message;
  assert.match(down.en, /failed \(ECONNREFUSED\)/);
});

test('scene action current_conditions: a sentence and its numbers', async (t) => {
  const world = await apiWorld(t, { config: { language: 'en' } });
  const ack = await world.gladys.fake.sceneAction('current_conditions', {});
  assert.equal(ack.success, true, ack.error);
  const result = ack.data.outputs;
  assert.equal(result.temperature, 9.8);
  assert.equal(result.rain_today, 3.2);
  assert.equal(result.raining, true);
  assert.match(result.summary, /^9\.8 °C, feels like 8 °C, humidity 87 %, wind SW 12 km\/h/);
});

test('a changed configuration reads the new source at once', async (t) => {
  const world = await apiWorld(t);
  await world.gladys.fake.configUpdated({ source: 'realtime', url: REALTIME_URL });
  assert.equal(world.server.requests.at(-1).url, REALTIME_URL);
  assert.equal(world.gladys.fake.discoveredDevices[0].model, 'Cumulus');
});

test('credentials in the address become a basic auth header, never a URL', async (t) => {
  mockTime(t);
  const world = await createWorld({
    config: { source: 'realtime', url: 'http://user:p%40ss@meteo.example/realtime.txt' },
  });
  t.after(() => world.app.stop());
  const [request] = world.server.requests;
  assert.equal(request.url, REALTIME_URL);
  assert.equal(
    request.headers.authorization,
    `Basic ${Buffer.from('user:p@ss').toString('base64')}`,
  );
  assert.ok(FIXTURES.realtimeMx);
});
