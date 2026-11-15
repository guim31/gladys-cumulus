// -----------------------------------------------------------------------------
// Quiet logs: nothing at info level for a normal cycle, one line when a
// failure starts and one when it ends, never a password.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_URL,
  MX_URL,
  REALTIME_URL,
  addStation,
  apiAnswer,
  createWorld,
  flush,
} from './helpers/world.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Capture every log line at the given level and above. */
function captureLogs(t, level = 'debug') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => lines.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}

const atLevel = (lines, level) => lines.filter((line) => line.includes(`[${level}]`));

async function tick(t, ms) {
  t.mock.timers.tick(ms);
  for (let i = 0; i < 5; i += 1) {
    await flush();
  }
}

test('a normal cycle writes nothing at info level', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() });
  const world = await createWorld({ config: { source: 'cumulusmx', url: MX_URL, interval: 10 } });
  t.after(() => world.app.stop());
  await addStation(world);
  const lines = captureLogs(t, 'info');
  for (let i = 1; i <= 30; i += 1) {
    world.server.files[API_URL] = apiAnswer({ temp: String(10 + i / 10) });
    await tick(t, 10 * SECOND);
  }
  await tick(t, 2 * MINUTE);
  // Log lines only (Node 22 also prints an ExperimentalWarning for MockTimers).
  assert.deepEqual(
    lines.filter((line) => /\[(INFO|WARN|ERROR)\]/.test(line)),
    [],
  );
});

test('a failure is told once, its end once, the rest goes to debug', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() });
  const world = await createWorld({
    config: { source: 'realtime', url: REALTIME_URL, interval: 60 },
  });
  t.after(() => world.app.stop());
  const lines = captureLogs(t, 'info');
  world.server.failure = 'down';
  for (let i = 0; i < 4; i += 1) {
    await tick(t, MINUTE);
  }
  assert.equal(atLevel(lines, 'WARN').length, 1);
  world.server.failure = null;
  await tick(t, MINUTE);
  const info = atLevel(lines, 'INFO');
  assert.equal(info.length, 1, info.join('\n'));
  assert.match(info[0], /readable again/);
});

test('the passwords never appear in the logs, at any level', async (t) => {
  const lines = captureLogs(t, 'debug');
  const world = await createWorld({
    config: {
      source: 'cumulusmx',
      url: 'http://alice:url-secret@cumulus.example:8998/?key=query-secret',
    },
  });
  world.server.failure = 'down';
  await world.gladys.fake.action('check_source', {});
  world.server.failure = null;
  await world.gladys.fake.configUpdated({
    source: 'clientraw',
    url: 'http://bob:http-secret@meteo.example/clientraw.txt?key=query-secret',
  });
  await world.gladys.fake.action('check_source', {});
  await flush();
  world.app.stop();
  assert.ok(lines.length > 5, 'the scenario logs something');
  for (const line of lines) {
    for (const secret of ['url-secret', 'http-secret', 'query-secret']) {
      assert.ok(!line.includes(secret), `${secret} in: ${line}`);
    }
  }
});
