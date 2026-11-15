// -----------------------------------------------------------------------------
// Reading the configured source once, over HTTP.
//
// Cumulus MX answers its tag API live. realtime.txt and clientraw.txt are
// rewritten by Cumulus or Weather Display every few seconds to minutes
// (their "realtime" interval), usually served by a web server of the user.
// -----------------------------------------------------------------------------

import {
  API_TAGS,
  SOURCES,
  parseApiTags,
  parseClientraw,
  parseRealtime,
  parseTagJson,
} from './parse.js';

export const HTTP_TIMEOUT_MS = 10 * 1000;
// The three answers are a few hundred bytes to a few KB.
const MAX_BYTES = 256 * 1024;

export class SourceError extends Error {
  /** @param {'unreachable'|'format'} kind */
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

/**
 * The address actually requested: the tag API under the address of Cumulus
 * MX (whatever path the user pasted after it), the file address as is.
 * @param {string} source one of SOURCES
 * @param {string} address
 */
export function requestUrl(source, address) {
  const url = new URL(address);
  if (source !== SOURCES.CUMULUS_MX) {
    return url;
  }
  // http://host:8998, http://host:8998/, http://host:8998/now.html,
  // http://host:8998/api/…, or a reverse proxy prefix (http://host/cumulus/).
  const apiAt = url.pathname.indexOf('/api/');
  let prefix = apiAt >= 0 ? url.pathname.slice(0, apiAt) : url.pathname;
  if (apiAt < 0 && /\.[a-z0-9]+$/i.test(prefix)) {
    prefix = prefix.slice(0, prefix.lastIndexOf('/'));
  }
  url.pathname = `${prefix.replace(/\/+$/, '')}/api/tags/process.json`;
  url.search = `?${API_TAGS.join('&')}`;
  url.hash = '';
  return url;
}

/**
 * Read the source once.
 * @param {{ source: string, url: string }} config
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @returns {Promise<object>} the reading
 * @throws {SourceError}
 */
export async function readSource(
  { source, url: address },
  { fetch: fetchFn = globalThis.fetch } = {},
) {
  const url = requestUrl(source, address);
  const headers = {};
  // fetch() refuses a URL with credentials: they become a basic auth header
  // (a web server or a reverse proxy protecting the files).
  if (url.username || url.password) {
    const decode = (value) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };
    const credentials = `${decode(url.username)}:${decode(url.password)}`;
    headers.authorization = `Basic ${Buffer.from(credentials).toString('base64')}`;
    url.username = '';
    url.password = '';
  }
  // Ask the web servers and the proxies not to serve an old copy.
  headers['cache-control'] = 'no-cache';
  let response;
  try {
    response = await fetchFn(url.toString(), {
      headers,
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err?.message);
    throw new SourceError('unreachable', String(reason));
  }
  if (!response.ok) {
    // 503: Cumulus MX runs, but its station is not started yet.
    throw new SourceError('unreachable', `HTTP ${response.status}`);
  }
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BYTES) {
    throw new SourceError('format', 'answer too large');
  }
  const body = await response.text();
  if (body.length > MAX_BYTES) {
    throw new SourceError('format', 'answer too large');
  }
  const reading =
    source === SOURCES.CUMULUS_MX
      ? parseApiTags(parseTagJson(body))
      : source === SOURCES.CLIENTRAW
        ? parseClientraw(body)
        : parseRealtime(body);
  if (!reading) {
    throw new SourceError('format', 'unknown format');
  }
  return reading;
}
