// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake
// Gladys), so index.js stays a few lines and the tests drive the very same
// wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { stationIds } from './devices.js';
import { CumulusHub } from './hub.js';
import { MESSAGES } from './i18n.js';
import { SCENE_ACTION, currentConditions } from './scenes.js';
import { WIDGET, getStationWidget } from './widgets.js';

const logger = createLogger({ name: 'cumulus-app' });

export const ACTION = {
  CHECK_SOURCE: 'check_source',
};

/**
 * @param {object} gladys
 * @param {object} [options] test seams: fetch, now, timings
 * @returns {{ hub: CumulusHub, stop: () => void }}
 */
export function registerHandlers(gladys, options = {}) {
  const hub = new CumulusHub({
    gladys,
    now: options.now,
    fetch: options.fetch,
    timings: options.timings,
  });

  const isStation = (device) => device?.external_id === stationIds(gladys).device;

  // --- Discovery: the station, once the source answered ---------------------
  gladys.onScanRequest(async () => {
    logger.info('Scan requested');
    await hub.publishDiscovery();
  });

  // --- Read-only device ----------------------------------------------------------
  gladys.onSetValue(async (device, feature) => {
    throw new Error(`${feature.external_id} is read-only`);
  });

  // No poll: the source is read on the container's own timer. Registered
  // anyway, should the core ever poll the device: nothing to do.
  gladys.onPoll(async () => {});

  // The station just added (or updated) in Gladys: the SDK forgot what it
  // had published and the core dropped the states sent before it existed.
  // Send everything now, and refresh the open widgets.
  const onStationChanged = async (device) => {
    if (!isStation(device)) {
      return;
    }
    await hub.publish();
    hub.requestWidgetRefresh();
  };
  gladys.onDeviceCreated(onStationChanged);
  gladys.onDeviceUpdated(onStationChanged);
  // The widget shows the name given in Gladys, or asks to add the station.
  gladys.onDeviceDeleted(async (device) => {
    if (isStation(device)) {
      hub.requestWidgetRefresh();
    }
  });

  // --- Configuration screen action ----------------------------------------------
  gladys.onAction(ACTION.CHECK_SOURCE, async () => {
    logger.info('Action check_source');
    return hub.checkSource();
  });

  // --- Scene action ---------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTION.CURRENT_CONDITIONS, () => currentConditions(hub));

  // --- Dashboard widget -----------------------------------------------------------
  gladys.onWidgetGet(WIDGET.STATION, (request) => getStationWidget(hub, request));

  // --- Configuration -------------------------------------------------------------
  gladys.onConfigUpdated(async (raw) => {
    logger.info('Configuration updated');
    await hub.configure(normalizeConfig(raw));
  });

  // --- Connection lifecycle (the SDK logs the Gladys link itself) -------------
  gladys.on('connected', async () => {
    try {
      await hub.configure(normalizeConfig(await gladys.getConfig()));
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, MESSAGES.publishFailed).catch(() => {});
    }
  });

  return {
    hub,
    stop() {
      hub.stop();
    },
  };
}
