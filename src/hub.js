// -----------------------------------------------------------------------------
// The state of the integration: the configured source, the latest reading of
// the station, and what is published to Gladys.
//
// The source is read on the container's own timer (every `interval`
// seconds). The states are published at most once per publishMinMs, and only
// those that changed: the core caps an integration at 300 states a minute and
// re-evaluates the scenes at each one. The triggers see every new reading.
//
// A new measurement: the Cumulus MX API is live (a new reading at every read,
// unless Cumulus says its station stopped sending); a file is new when its
// date changed. A one-minute clock in the container ages the last
// measurement, fires the "dry for N minutes" and "silent for N minutes"
// triggers and sends the heartbeat.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isConfigured, safeUrl } from './config.js';
import { SOURCES, countValues } from './cumulus/parse.js';
import { readSource } from './cumulus/source.js';
import { buildDevice, buildStates, featureKeyOf, featuresOf, stationIds } from './devices.js';
import { MESSAGES, REPORT_TEXT, relativeTime } from './i18n.js';
import { createIssueLog } from './issues.js';
import { TRIGGER, createTriggerTracker } from './triggers.js';

const logger = createLogger({ name: 'cumulus' });

export const WIDGET_KEY = 'station';

export const DEFAULT_TIMINGS = {
  publishMinMs: 15 * 1000,
  tickMs: 60 * 1000,
  // Republish an unchanged value at least this often, or the front shows "no
  // recent value" after 48 h.
  heartbeatMs: 6 * 60 * 60 * 1000,
};

const LANGS = ['en', 'fr', 'de', 'es'];

// Silence after which the station counts as unreachable (and the logs say so).
export const LOST_AFTER_MINUTES = 15;

// The date of the first file read is trusted within these bounds (a file
// left behind by a stopped Cumulus is old; a clock ahead is not trusted).
const FIRST_DATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const SOURCE_NAMES = {
  [SOURCES.CUMULUS_MX]: 'the Cumulus MX API',
  [SOURCES.REALTIME]: 'realtime.txt',
  [SOURCES.CLIENTRAW]: 'clientraw.txt',
};

export class CumulusHub {
  /**
   * @param {object} options
   * @param {object} options.gladys
   * @param {() => number} [options.now]
   * @param {typeof fetch} [options.fetch] test seam
   * @param {object} [options.timings]
   */
  constructor({ gladys, now = () => Date.now(), fetch, timings = {} }) {
    this.gladys = gladys;
    this.now = now;
    this.fetch = fetch;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.issues = createIssueLog(logger);
    this.config = null;
    this.reading = null;
    this.stamp = null;
    this.stopped = false;
    this.stationName = null;
    this.software = null;
    this.seen = new Set();
    this.triggers = createTriggerTracker({ now });
    this.lastNewDataAt = null;
    this.lost = false;
    this.http = { state: null, error: null };
    this.pollTimer = null;
    this.tickTimer = null;
    this.publishTimer = null;
    this.lastPublishAt = 0;
    this.status = null;
    this.generation = 0;
  }

  // --- Configuration and source ----------------------------------------------

  /** (Re)start everything with a configuration. */
  async configure(config) {
    this.stopSources();
    this.generation += 1;
    const sourceChanged =
      this.config !== null &&
      (this.config.source !== config.source || this.config.url !== config.url);
    this.config = config;
    // Sent again after a reconnection: Gladys may have restarted.
    this.status = null;
    this.http = { state: null, error: null };
    if (sourceChanged) {
      this.stamp = null;
      this.stopped = false;
    }
    this.triggers.resetSilence();
    if (!isConfigured(config)) {
      logger.warn('No source configured: waiting for the address of Cumulus or of the file');
      await this.updateStatus();
      return;
    }
    logger.info(
      `Reading ${SOURCE_NAMES[config.source]} at ${safeUrl(config.url)} every ${config.interval} s`,
    );
    this.startTick();
    await this.poll();
  }

  /** Read the source once, then schedule the next read. */
  async poll() {
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
    const { config } = this;
    if (!isConfigured(config)) {
      return;
    }
    const generation = this.generation;
    const url = safeUrl(config.url);
    try {
      const reading = await readSource(config, { fetch: this.fetch });
      if (generation !== this.generation) {
        return;
      }
      const softwareChanged = this.software !== reading.software;
      if (softwareChanged) {
        logger.info(`${url} read (${reading.software})`);
        this.software = reading.software;
      }
      this.http = { state: 'ok', error: null };
      this.issues.ok('source', `${url} readable again`);
      const published = await this.onReading(reading);
      // Another program behind the address: the model of the station follows.
      if (softwareChanged && !published && this.seen.size > 0) {
        await this.publishDiscovery();
      }
    } catch (err) {
      if (generation !== this.generation) {
        return;
      }
      this.http = { state: err.kind ?? 'unreachable', error: err.message };
      this.issues.fail('source', `Reading ${url} failed (${err.message})`);
      this.schedulePublish();
    }
    await this.updateStatus();
    if (generation === this.generation && this.tickTimer !== null) {
      this.pollTimer = setTimeout(() => this.poll(), config.interval * 1000);
      this.pollTimer.unref?.();
    }
  }

  startTick() {
    clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => {
      this.tick().catch((err) => logger.error(`Clock tick failed: ${err.message}`));
    }, this.timings.tickMs);
    this.tickTimer.unref?.();
  }

  stopSources() {
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  stop() {
    this.stopSources();
    clearTimeout(this.publishTimer);
    this.publishTimer = null;
  }

  /** The connection status shown by Gladys, sent when it changes. */
  async updateStatus() {
    const { config } = this;
    let message = null;
    if (!isConfigured(config)) {
      message = MESSAGES.notConfigured;
    } else if (this.http.state === 'format') {
      message = MESSAGES.unknownFormat[config.source];
    } else if (this.http.state === 'unreachable') {
      message = MESSAGES.sourceFailed[config.source];
    } else if (this.stopped) {
      message = MESSAGES.stationStopped;
    }
    const status = message === null ? 'ok' : message.en;
    if (status === this.status) {
      return;
    }
    this.status = status;
    // The core wants every language ({ en, fr, de, es }) and answers 400 to a
    // plain string: Gladys picks the user's language itself.
    await this.gladys
      .setConnectionStatus(message === null, message === null ? undefined : message)
      .catch(() => {});
  }

  // --- Measurements ----------------------------------------------------------

  /**
   * A reading of the source.
   * @returns {Promise<boolean>} whether the discovery was published
   */
  async onReading(reading) {
    if (reading.stationName) {
      this.stationName = reading.stationName;
    }
    // A file is new when its date changed, the API when Cumulus MX read its
    // station again (no date: every answer is new).
    const isNew = reading.stamp === null || reading.stamp !== this.stamp;
    this.stamp = reading.stamp;
    // Cumulus MX keeps its "data stopped" alarm latched for a while after the
    // data is back: a new reading wins over it.
    const wasStopped = this.stopped;
    this.stopped = reading.stopped && (reading.stamp === null || !isNew);
    if (this.stopped && !wasStopped) {
      logger.warn(`${this.software ?? 'Cumulus'} says the station stopped sending data`);
    } else if (!this.stopped && wasStopped) {
      logger.info('The station sends data again');
    }
    if (this.stopped || !isNew) {
      this.schedulePublish();
      return false;
    }
    this.reading = reading;
    if (this.lastNewDataAt === null) {
      logger.info(`First measurement received (${reading.software})`);
      this.lastNewDataAt = this.firstDate(reading);
    } else {
      this.lastNewDataAt = this.now();
    }
    if (this.lost && this.ageMinutes() < LOST_AFTER_MINUTES) {
      this.lost = false;
      logger.info('Measurements are back');
    }

    const before = this.seen.size;
    for (const key of featuresOf(reading)) {
      this.seen.add(key);
    }
    const grown = this.seen.size !== before;
    if (grown) {
      await this.publishDiscovery();
    }
    // A first file found already old says nothing about now.
    if (this.ageMinutes() < LOST_AFTER_MINUTES) {
      await this.fireObservationTriggers(reading);
    }
    this.schedulePublish();
    return grown;
  }

  /** The time of the first measurement: the file's date when credible. */
  firstDate(reading) {
    const now = this.now();
    if (
      reading.time === null ||
      reading.time > now + FUTURE_TOLERANCE_MS ||
      reading.time < now - FIRST_DATE_MAX_AGE_MS
    ) {
      return now;
    }
    return Math.min(reading.time, now);
  }

  ageMinutes() {
    return this.lastNewDataAt === null
      ? null
      : Math.max(0, Math.floor((this.now() - this.lastNewDataAt) / 60000));
  }

  /** The source answers, the station feeds it, and the measurements are fresh. */
  isReachable() {
    if (this.http.state === null) {
      return null;
    }
    const age = this.ageMinutes();
    return (
      this.http.state === 'ok' &&
      !this.stopped &&
      !this.reading?.contactLost &&
      age !== null &&
      age < LOST_AFTER_MINUTES
    );
  }

  /** The data the features and the widget read. */
  data() {
    return {
      reading: this.reading,
      reachable: this.isReachable(),
      ageMinutes: this.ageMinutes(),
    };
  }

  /** The clock: age, dry spells, silences, heartbeat. */
  async tick() {
    const { dry, silent, silentMinutes } = this.triggers.onTick();
    for (const minutes of dry) {
      await this.fireScene(TRIGGER.RAIN_STOPPED, {
        after_minutes: String(minutes),
        rain_today_mm: roundOrNull(this.reading?.rainToday, 1),
      });
    }
    for (const minutes of silent) {
      if (minutes === LOST_AFTER_MINUTES && !this.lost) {
        this.lost = true;
        logger.info(`No new measurement for ${silentMinutes} minutes`);
      }
      await this.fireScene(TRIGGER.STATION_SILENT, {
        after_minutes: String(minutes),
        minutes: silentMinutes,
      });
    }
    this.schedulePublish();
  }

  // --- Gladys side -------------------------------------------------------------

  /** The device of the station as Gladys knows it, if added. */
  addedDevice() {
    const externalId = stationIds(this.gladys).device;
    return (this.gladys.devices ?? []).find((device) => device.external_id === externalId) ?? null;
  }

  /** The discovered devices: the station, once it sent something. */
  discoveredDevices() {
    const features = new Set(this.seen);
    for (const feature of this.addedDevice()?.features ?? []) {
      const key = featureKeyOf(this.gladys, feature.external_id);
      if (key !== null) {
        features.add(key);
      }
    }
    if (features.size === 0) {
      return [];
    }
    return [
      buildDevice(this.gladys, {
        name: this.stationName,
        model: this.software?.replace(/ [\d.]+.*$/, ''),
        features,
        language: this.config?.language ?? 'fr',
      }),
    ];
  }

  async publishDiscovery() {
    try {
      await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
      this.issues.ok('discovery', 'Gladys accepts the station again');
      if (this.status === 'publish-failed') {
        this.status = null;
        await this.updateStatus();
      }
    } catch (err) {
      this.issues.fail('discovery', `Publishing the station failed: ${err.message}`);
      await this.gladys.setConnectionStatus(false, MESSAGES.publishFailed).catch(() => {});
      this.status = 'publish-failed';
    }
  }

  /** Publish soon: at most once per publishMinMs. */
  schedulePublish() {
    if (this.publishTimer !== null) {
      return;
    }
    const wait = Math.max(0, this.lastPublishAt + this.timings.publishMinMs - this.now());
    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      this.publish().catch((err) => logger.error(`Publishing failed: ${err.message}`));
    }, wait);
    this.publishTimer.unref?.();
  }

  /** Publish the changed states now (the device just added: everything). */
  async publish() {
    const device = this.addedDevice();
    if (!device || this.reading === null) {
      return;
    }
    this.lastPublishAt = this.now();
    // Only the features of the device as added: the core drops the others
    // (a 0 of an absent sensor, a feature seen since but not updated yet).
    const added = new Set(
      (device.features ?? []).map((feature) => featureKeyOf(this.gladys, feature.external_id)),
    );
    const states = buildStates(this.gladys, this.data(), (key) => added.has(key));
    if (states.length === 0) {
      return;
    }
    try {
      const { count } = await this.gladys.publishChangedStates(states, {
        heartbeat: this.timings.heartbeatMs,
      });
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
      }
      this.issues.ok('publish', 'Gladys accepts the states again');
    } catch (err) {
      this.issues.fail('publish', `Publishing the states failed: ${err.message}`);
    }
  }

  async fireObservationTriggers(reading) {
    const { rainStarted, gusts } = this.triggers.onObservation({
      raining: reading.raining,
      gust: reading.windGust,
    });
    if (rainStarted) {
      await this.fireScene(TRIGGER.RAIN_STARTED, {});
    }
    for (const threshold of gusts) {
      await this.fireScene(TRIGGER.GUST_ABOVE, {
        above_kmh: String(threshold),
        gust_kmh: roundOrNull(reading.windGust, 0),
      });
    }
  }

  async fireScene(key, extra) {
    const device = this.addedDevice();
    if (!device) {
      return;
    }
    try {
      await this.gladys.publishSceneEvent(key, {
        device: device.external_id,
        station: device.name ?? this.stationName ?? 'Cumulus',
        ...extra,
      });
      logger.debug(`Scene event ${key} fired`);
      this.issues.ok('scene', 'Gladys accepts the scene events again');
    } catch (err) {
      this.issues.fail('scene', `Firing the scene event ${key} failed: ${err.message}`);
    }
  }

  /** Fire-and-forget nudge: the dashboards re-pull the widget content. */
  requestWidgetRefresh() {
    try {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } catch (err) {
      logger.debug(`Widget refresh not sent: ${err.message}`);
    }
  }

  // --- "Check the source" action ----------------------------------------------

  /**
   * What the source gives right now, in the four languages.
   * @returns {Promise<Record<string, string>>}
   */
  async checkSource() {
    const { config } = this;
    if (!isConfigured(config)) {
      throw new Error(
        MESSAGES.notConfigured[config?.language ?? 'en'] ?? MESSAGES.notConfigured.en,
      );
    }
    await this.poll();
    const url = safeUrl(config.url);
    const lines = Object.fromEntries(LANGS.map((lang) => [lang, []]));
    const add = (fn) => {
      for (const lang of LANGS) {
        lines[lang].push(fn(REPORT_TEXT[lang], lang));
      }
    };
    if (this.http.state === 'ok') {
      add((text) => text.sourceOk(url, this.software ?? '?'));
    } else {
      add((text) => text.sourceDown(url, this.http.error ?? '?'));
    }
    if (this.stopped) {
      add((text) => text.stopped);
    }
    if (this.reading && this.lastNewDataAt !== null) {
      const seconds = (this.now() - this.lastNewDataAt) / 1000;
      add((text, lang) => text.received(countValues(this.reading), relativeTime(seconds, lang)));
    }
    return Object.fromEntries(LANGS.map((lang) => [lang, lines[lang].join(' ')]));
  }
}

function roundOrNull(value, decimals) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
