import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, isConfigured, normalizeConfig, safeUrl } from '../src/config.js';

test('an empty configuration is the defaults, not configured', () => {
  assert.deepEqual(normalizeConfig({}), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
  assert.equal(isConfigured(normalizeConfig({})), false);
});

test('the address gets its scheme; anything else than http(s) is refused', () => {
  assert.equal(normalizeConfig({ url: ' 192.0.2.10:8998 ' }).url, 'http://192.0.2.10:8998');
  assert.equal(normalizeConfig({ url: 'https://h/realtime.txt' }).url, 'https://h/realtime.txt');
  assert.equal(normalizeConfig({ url: 'ftp://h/realtime.txt' }).url, '');
  assert.equal(isConfigured(normalizeConfig({ url: 'http://h/clientraw.txt' })), true);
});

test('the source, the interval and the language are bounded', () => {
  assert.equal(normalizeConfig({ source: 'clientraw' }).source, 'clientraw');
  assert.equal(normalizeConfig({ source: 'weewx' }).source, 'cumulusmx');
  assert.equal(normalizeConfig({ interval: '5' }).interval, 10);
  assert.equal(normalizeConfig({ interval: 99999 }).interval, 3600);
  assert.equal(normalizeConfig({ interval: 'abc' }).interval, 30);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
  assert.equal(normalizeConfig({ language: 'de' }).language, 'de');
});

test('addresses are logged without credentials nor query string', () => {
  assert.equal(safeUrl('http://user:pass@192.0.2.10:8998'), 'http://192.0.2.10:8998');
  assert.equal(safeUrl('http://u:p@h/realtime.txt?token=x'), 'http://h/realtime.txt');
});
