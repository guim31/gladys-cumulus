// -----------------------------------------------------------------------------
// The station widget: valid against the core vocabulary and budget, bound to
// features of the added device, localized, with readable empty states.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { API_URL, MX_URL, addStation, apiAnswer, createWorld } from './helpers/world.js';

async function liveWorld(t, answer) {
  const world = await createWorld({
    config: { source: 'cumulusmx', url: MX_URL },
    prepare(server) {
      if (answer) {
        server.files[API_URL] = answer;
      }
    },
  });
  t.after(() => world.app.stop());
  return world;
}

const stationDevice = (gladys) => gladys.externalIds('station', 'cumulus').device;

async function content(world, request) {
  const ack = await world.gladys.fake.widgetGet('station', request);
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
}

const bodyText = (widget) => widget.components[0].text;

for (const [language, units] of [
  ['en', 'metric'],
  ['fr', 'metric'],
  ['de', 'metric'],
  ['es', 'metric'],
  ['en', 'us'],
]) {
  test(`the content is valid and bound to real features (${language}, ${units})`, async (t) => {
    const world = await liveWorld(
      t,
      apiAnswer({
        wspeed: '18',
        wgust: '35',
        avgbearing: '225',
        rrate: '2.5',
        UV: '6.4',
        LowBatteryList: 'WH65',
      }),
    );
    const device = await addStation(world);
    const widget = await content(world, {
      settings: { device: stationDevice(world.gladys) },
      language,
      units,
    });
    assert.deepEqual(validateWidgetContent(widget), []);
    const features = new Set(device.features.map((f) => f.external_id));
    const tiles = widget.components.filter((c) => c.device_feature);
    assert.equal(tiles.length, 5);
    for (const tile of tiles) {
      assert.ok(features.has(tile.device_feature), tile.device_feature);
    }
    const status = widget.components.find((c) => c.type === 'status');
    const wind = status.items.find((item) => item.icon === 'navigation');
    assert.match(wind.value, units === 'us' ? /11 mph.*22 mph/ : /18 km\/h.*35 km\/h/);
    assert.ok(
      status.items.some((item) => item.icon === 'battery'),
      'the low battery is shown',
    );
    const rain = status.items.find((item) => item.icon === 'cloud-rain');
    assert.match(rain.value, units === 'us' ? /0[.,]1 in\/h/ : /2[.,]5 mm\/h/);
    const caption = widget.components.find((c) => c.type === 'text');
    assert.ok(caption.text.length > 0);
  });
}

test('a station without wind or pressure sensor gets only the tiles it can fill', async (t) => {
  const world = await liveWorld(
    t,
    '{"temp":"8","hum":"90","tempunitnodeg":"C","windunit":"km/h","pressunit":"hPa","rainunit":"mm"}',
  );
  await addStation(world);
  const widget = await content(world, {
    settings: { device: stationDevice(world.gladys) },
    language: 'en',
  });
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.deepEqual(
    widget.components.filter((c) => c.device_feature).map((c) => c.label),
    ['Temperature', 'Humidity'],
  );
});

test('empty states: not configured, no station picked, station not added', async (t) => {
  const bare = await createWorld({ config: {} });
  t.after(() => bare.app.stop());
  assert.match(bodyText(await content(bare, { settings: {}, language: 'en' })), /Cumulus MX/);

  const world = await liveWorld(t);
  assert.match(bodyText(await content(world, { settings: {}, language: 'fr' })), /Choisissez/);
  assert.match(
    bodyText(
      await content(world, { settings: { device: stationDevice(world.gladys) }, language: 'de' }),
    ),
    /Erkennung/,
  );
});

test('the details can be hidden', async (t) => {
  const world = await liveWorld(t);
  await addStation(world);
  const widget = await content(world, {
    settings: { device: stationDevice(world.gladys), show_details: false },
    language: 'en',
  });
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.equal(
    widget.components.find((c) => c.type === 'status'),
    undefined,
  );
});

test('the caption warns when the station is silent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() });
  const world = await liveWorld(t);
  await addStation(world);
  // Cumulus MX goes down: no new measurement for 20 minutes.
  world.server.failure = 'down';
  t.mock.timers.tick(20 * 60 * 1000);
  await new Promise((resolve) => setImmediate(resolve));
  const widget = await content(world, {
    settings: { device: stationDevice(world.gladys) },
    language: 'en',
  });
  const caption = widget.components.find((c) => c.type === 'text');
  assert.match(caption.text, /Station silent: last measurement 20 minutes ago/);
});
