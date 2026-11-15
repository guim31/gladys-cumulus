// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake web server answering
// as Cumulus MX or serving the weather files, and the integration wired on
// top through registerHandlers — the same wiring as index.js.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { API_TAGS } from '../../src/cumulus/parse.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

const fixture = (name) =>
  readFileSync(new URL(`../fixtures/cumulus/${name}`, import.meta.url), 'utf8');

/** The answers of the sources, see test/fixtures/cumulus/README.md. */
export const FIXTURES = {
  apiMetric: fixture('api-metric.json'),
  apiUs: fixture('api-us.json'),
  realtimeMx: fixture('realtime-mx.txt'),
  realtimeWiki: fixture('realtime-wiki.txt'),
  clientraw: fixture('clientraw.txt'),
};

export const MX_URL = 'http://cumulus.example:8998';
export const API_URL = `${MX_URL}/api/tags/process.json?${API_TAGS.join('&')}`;
export const REALTIME_URL = 'http://meteo.example/realtime.txt';
export const CLIENTRAW_URL = 'http://meteo.example/clientraw.txt';

// 15/11/2026 12:30:05 local time: the date of realtime-mx.txt.
export const REALTIME_TIME_MS = new Date(2026, 10, 15, 12, 30, 5).getTime();

let readCount = 0;

/**
 * The API answer with some tags changed: a new reading of the station
 * (LastDataReadT changed) unless LastDataReadT is given.
 */
export function apiAnswer(values = {}, base = FIXTURES.apiMetric) {
  let body = base;
  readCount += 1;
  const all = { LastDataReadT: `15/11/2026 12:30:05 #${readCount}`, ...values };
  for (const [key, value] of Object.entries(all)) {
    body = body.replace(new RegExp(`"${key}":"[^"]*"`), `"${key}":"${value}"`);
  }
  return body;
}

/** realtime-mx.txt at another time, with some fields (1-based) changed. */
export function realtimeLine(secondsAfter = 0, fields = {}) {
  const parts = FIXTURES.realtimeMx.trim().split(' ');
  const date = new Date(REALTIME_TIME_MS + secondsAfter * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  parts[0] = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${pad(date.getFullYear() % 100)}`;
  parts[1] = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  for (const [n, value] of Object.entries(fields)) {
    parts[Number(n) - 1] = String(value);
  }
  return `${parts.join(' ')}\r\n`;
}

/** A fake web server: Cumulus MX and the files. */
export function createFakeServer() {
  const server = {
    files: {
      [API_URL]: FIXTURES.apiMetric,
      [REALTIME_URL]: FIXTURES.realtimeMx,
      [CLIENTRAW_URL]: FIXTURES.clientraw,
    },
    failure: null,
    requests: [],
    async fetch(url, options = {}) {
      server.requests.push({ url, headers: options.headers });
      if (server.failure === 'down') {
        const err = new TypeError('fetch failed');
        err.cause = { code: 'ECONNREFUSED' };
        throw err;
      }
      if (typeof server.failure === 'number') {
        return new Response('error', { status: server.failure });
      }
      const body = server.files[url];
      if (body === undefined) {
        return new Response('not found', { status: 404 });
      }
      return new Response(body, { status: 200 });
    },
  };
  return server;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array<object>} [options.devices] devices already created in Gladys
 * @param {boolean} [options.connect]
 * @param {object} [options.timings]
 * @param {Function} [options.prepare] called with the server before connecting
 */
export async function createWorld({
  config = { source: 'cumulusmx', url: MX_URL },
  devices = [],
  connect = true,
  timings,
  prepare,
} = {}) {
  const server = createFakeServer();
  prepare?.(server);
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, { fetch: server.fetch, timings });
  if (connect) {
    await gladys.connect();
  }
  return { gladys, server, app, hub: app.hub };
}

/** Create the discovered station in Gladys, as the user would. */
export async function addStation(world) {
  const [device] = world.gladys.fake.discoveredDevices;
  if (!device) {
    throw new Error('the station was not discovered');
  }
  await world.gladys.fake.deviceCreated(device);
  return device;
}

/** A feature external id of the station. */
export const featureId = (gladys, key) => gladys.externalIds('station', 'cumulus').feature(key);

/** Let the pending promise callbacks run. */
export const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Mock the clock and the timers. */
export function mockTime(t, start = REALTIME_TIME_MS) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: start });
  return async (ms) => {
    t.mock.timers.tick(ms);
    for (let i = 0; i < 5; i += 1) {
      await flush();
    }
  };
}
