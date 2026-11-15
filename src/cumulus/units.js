// -----------------------------------------------------------------------------
// Units of Cumulus and Weather Display, turned into the ones the integration
// publishes: °C, km/h, hPa, mm and mm/h.
//
// Cumulus (MX and 1) works in the units of its settings and names them with
// fixed texts (Cumulus.cs, `Units.*Text`): temperature `C`/`F`, wind `m/s`,
// `mph`, `km/h`, `kts`, pressure `mb`, `hPa`, `in`, `kPa`, rain `mm`, `in`.
// Weather Display writes clientraw.txt in fixed units whatever its display
// settings: °C, knots, hPa, mm (rain rate in mm per minute).
// A unit this module does not know drops the value: a wrong number is worse
// than none.
// -----------------------------------------------------------------------------

const CONVERT = {
  temperature: {
    c: (v) => v,
    f: (v) => ((v - 32) * 5) / 9,
  },
  speed: {
    'km/h': (v) => v,
    kph: (v) => v,
    'm/s': (v) => v * 3.6,
    mph: (v) => v * 1.609344,
    kts: (v) => v * 1.852,
    knots: (v) => v * 1.852,
    kn: (v) => v * 1.852,
  },
  pressure: {
    mb: (v) => v,
    mbar: (v) => v,
    hpa: (v) => v,
    in: (v) => v * 33.8638866667,
    inhg: (v) => v * 33.8638866667,
    kpa: (v) => v * 10,
  },
  rain: {
    mm: (v) => v,
    in: (v) => v * 25.4,
  },
};

/** The lower-cased unit text, without spaces nor degree sign. */
function canonical(label) {
  return typeof label === 'string' ? label.replace(/[\s°]/g, '').toLowerCase() : null;
}

/**
 * Convert a value to the published unit of its group.
 * @param {number|null} value
 * @param {'temperature'|'speed'|'pressure'|'rain'} group rain also converts rain rates (per hour)
 * @param {string|null} label the unit text of the source
 * @returns {number|null} null when the value or the unit is unknown
 */
export function convert(value, group, label) {
  if (value === null || value === undefined) {
    return null;
  }
  const fn = CONVERT[group]?.[canonical(label)];
  return fn ? fn(value) : null;
}

/** True when the unit of a group is one this module converts. */
export const knownUnit = (group, label) => CONVERT[group]?.[canonical(label)] !== undefined;

/**
 * A number from a text field: "12.5", "-0.7", "+0.1", "1,5" (some locales).
 * "-", "--", "---", "N/A" and the like are no value.
 * @returns {number|null}
 */
export function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(text)) {
    return null;
  }
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}
