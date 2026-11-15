// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with blanks, strings or `undefined`.
//
// One source, read over HTTP: the tag API of Cumulus MX, a realtime.txt file
// (Cumulus 1 or MX) or a clientraw.txt file (Weather Display).
// -----------------------------------------------------------------------------

import { SOURCES } from './cumulus/parse.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const INTERVAL_MIN_S = 10;
export const INTERVAL_MAX_S = 3600;

export const DEFAULT_CONFIG = {
  source: SOURCES.CUMULUS_MX,
  url: '',
  interval: 30,
  language: 'fr',
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * The address of the source: http(s) only. A bare `192.0.2.10:8998` gets
 * its scheme.
 * @returns {string} '' when absent or not an http(s) URL
 */
export function normalizeUrl(value) {
  const raw = text(value);
  if (raw === '') {
    return '';
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const url = new URL(withScheme);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? withScheme : '';
  } catch {
    return '';
  }
}

/**
 * @param {object} [raw] the values received from Gladys
 */
export function normalizeConfig(raw = {}) {
  const source = raw ?? {};
  const interval = Number(source.interval);
  return {
    source: Object.values(SOURCES).includes(source.source) ? source.source : DEFAULT_CONFIG.source,
    url: normalizeUrl(source.url),
    interval: Number.isFinite(interval)
      ? Math.min(INTERVAL_MAX_S, Math.max(INTERVAL_MIN_S, Math.round(interval)))
      : DEFAULT_CONFIG.interval,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}

/** The source address is set. */
export const isConfigured = (config) => Boolean(config?.url);

/**
 * An address safe for the logs and the messages: no user name, no password,
 * no query string (a token may hide there).
 */
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return '(invalid address)';
  }
}
