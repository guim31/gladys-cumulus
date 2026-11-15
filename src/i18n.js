// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish says "usted" (house rule, enforced by
// test/i18n.test.js). Vocabulary follows the Gladys front translations.
//
// An integration of type "device" does not receive the user's language: the
// feature names, the scene action outputs and the action messages follow the
// `language` field of the configuration (French by default). Widgets get the
// viewer's language with every request.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Pick the text of a language, English as the fallback. */
export function pick(texts, language) {
  return texts[LANGUAGES.includes(language) ? language : 'en'] ?? texts.en;
}

// Feature names, by feature key (src/devices.js). Frozen at device creation
// in Gladys: changing one only affects stations added afterwards.
export const FEATURE_NAMES = {
  en: {
    temperature: 'Temperature',
    feels_like: 'Feels like',
    dew_point: 'Dew point',
    humidity: 'Humidity',
    indoor_temperature: 'Indoor temperature',
    indoor_humidity: 'Indoor humidity',
    pressure_sea_level: 'Sea-level pressure',
    pressure_trend: 'Pressure trend (3 h)',
    wind_speed: 'Average wind',
    wind_gust: 'Wind gusts',
    wind_direction: 'Wind direction',
    rain_rate: 'Rain intensity',
    rain_today: 'Rain today',
    raining: 'Raining',
    uv: 'UV index',
    solar_radiation: 'Solar radiation (W/m²)',
    battery_low: 'Low battery',
    reachable: 'Station reachable',
    data_age: 'Last measurement',
  },
  fr: {
    temperature: 'Température',
    feels_like: 'Ressenti',
    dew_point: 'Point de rosée',
    humidity: 'Humidité',
    indoor_temperature: 'Température intérieure',
    indoor_humidity: 'Humidité intérieure',
    pressure_sea_level: 'Pression (niveau de la mer)',
    pressure_trend: 'Tendance de pression (3 h)',
    wind_speed: 'Vent moyen',
    wind_gust: 'Rafales',
    wind_direction: 'Direction du vent',
    rain_rate: 'Intensité de pluie',
    rain_today: 'Pluie du jour',
    raining: 'Il pleut',
    uv: 'Indice UV',
    solar_radiation: 'Rayonnement solaire (W/m²)',
    battery_low: 'Batterie faible',
    reachable: 'Station joignable',
    data_age: 'Dernière mesure',
  },
  de: {
    temperature: 'Temperatur',
    feels_like: 'Gefühlte Temperatur',
    dew_point: 'Taupunkt',
    humidity: 'Luftfeuchtigkeit',
    indoor_temperature: 'Innentemperatur',
    indoor_humidity: 'Luftfeuchtigkeit innen',
    pressure_sea_level: 'Luftdruck (Meereshöhe)',
    pressure_trend: 'Luftdrucktendenz (3 h)',
    wind_speed: 'Mittlerer Wind',
    wind_gust: 'Windböen',
    wind_direction: 'Windrichtung',
    rain_rate: 'Regenintensität',
    rain_today: 'Regen heute',
    raining: 'Es regnet',
    uv: 'UV-Index',
    solar_radiation: 'Sonneneinstrahlung (W/m²)',
    battery_low: 'Batterie schwach',
    reachable: 'Station erreichbar',
    data_age: 'Letzte Messung',
  },
  es: {
    temperature: 'Temperatura',
    feels_like: 'Sensación térmica',
    dew_point: 'Punto de rocío',
    humidity: 'Humedad',
    indoor_temperature: 'Temperatura interior',
    indoor_humidity: 'Humedad interior',
    pressure_sea_level: 'Presión (nivel del mar)',
    pressure_trend: 'Tendencia de presión (3 h)',
    wind_speed: 'Viento medio',
    wind_gust: 'Ráfagas',
    wind_direction: 'Dirección del viento',
    rain_rate: 'Intensidad de lluvia',
    rain_today: 'Lluvia de hoy',
    raining: 'Está lloviendo',
    uv: 'Índice UV',
    solar_radiation: 'Radiación solar (W/m²)',
    battery_low: 'Batería baja',
    reachable: 'Estación accesible',
    data_age: 'Última medición',
  },
};

// Connection status messages (Gladys shows them on the integration page) and
// errors of the actions.
const SOURCE_FAILED = {
  cumulusmx: {
    en: 'Cumulus MX does not answer: check its address (port 8998) and that its station is started.',
    fr: 'Cumulus MX ne répond pas : vérifiez son adresse (port 8998) et que sa station est démarrée.',
    de: 'Cumulus MX antwortet nicht: Prüfe seine Adresse (Port 8998) und ob seine Station gestartet ist.',
    es: 'Cumulus MX no responde: compruebe su dirección (puerto 8998) y que su estación esté iniciada.',
  },
  realtime: {
    en: 'The realtime.txt file cannot be read: check its address.',
    fr: 'Le fichier realtime.txt est illisible : vérifiez son adresse.',
    de: 'Die Datei realtime.txt kann nicht gelesen werden: Prüfe ihre Adresse.',
    es: 'No se puede leer el archivo realtime.txt: compruebe su dirección.',
  },
  clientraw: {
    en: 'The clientraw.txt file cannot be read: check its address.',
    fr: 'Le fichier clientraw.txt est illisible : vérifiez son adresse.',
    de: 'Die Datei clientraw.txt kann nicht gelesen werden: Prüfe ihre Adresse.',
    es: 'No se puede leer el archivo clientraw.txt: compruebe su dirección.',
  },
};

const UNKNOWN_FORMAT = {
  cumulusmx: {
    en: 'This address does not answer like Cumulus MX: give the address of its interface (port 8998).',
    fr: "Cette adresse ne répond pas comme Cumulus MX : indiquez l'adresse de son interface (port 8998).",
    de: 'Diese Adresse antwortet nicht wie Cumulus MX: Gib die Adresse seiner Oberfläche an (Port 8998).',
    es: 'Esta dirección no responde como Cumulus MX: indique la dirección de su interfaz (puerto 8998).',
  },
  realtime: {
    en: 'The file is not a realtime.txt of Cumulus: check the address and the source chosen.',
    fr: "Le fichier n'est pas un realtime.txt de Cumulus : vérifiez l'adresse et la source choisie.",
    de: 'Die Datei ist keine realtime.txt von Cumulus: Prüfe die Adresse und die gewählte Quelle.',
    es: 'El archivo no es un realtime.txt de Cumulus: compruebe la dirección y la fuente elegida.',
  },
  clientraw: {
    en: 'The file is not a clientraw.txt of Weather Display: check the address and the source chosen.',
    fr: "Le fichier n'est pas un clientraw.txt de Weather Display : vérifiez l'adresse et la source choisie.",
    de: 'Die Datei ist keine clientraw.txt von Weather Display: Prüfe die Adresse und die gewählte Quelle.',
    es: 'El archivo no es un clientraw.txt de Weather Display: compruebe la dirección y la fuente elegida.',
  },
};

export const MESSAGES = {
  notConfigured: {
    en: 'Enter the address of Cumulus MX or of the realtime.txt or clientraw.txt file in the configuration.',
    fr: "Saisissez l'adresse de Cumulus MX ou du fichier realtime.txt ou clientraw.txt dans la configuration.",
    de: 'Gib die Adresse von Cumulus MX oder der Datei realtime.txt oder clientraw.txt in der Konfiguration ein.',
    es: 'Introduzca la dirección de Cumulus MX o del archivo realtime.txt o clientraw.txt en la configuración.',
  },
  sourceFailed: SOURCE_FAILED,
  unknownFormat: UNKNOWN_FORMAT,
  stationStopped: {
    en: 'Cumulus answers, but its station stopped sending data: check the station and its console.',
    fr: 'Cumulus répond, mais sa station n’envoie plus de données : vérifiez la station et sa console.',
    de: 'Cumulus antwortet, aber seine Station sendet keine Daten mehr: Prüfe die Station und ihre Konsole.',
    es: 'Cumulus responde, pero su estación ya no envía datos: compruebe la estación y su consola.',
  },
  publishFailed: {
    en: 'Gladys refused the station: see the integration logs.',
    fr: "Gladys a refusé la station : consultez les journaux de l'intégration.",
    de: 'Gladys hat die Station abgelehnt: Sieh dir die Protokolle der Integration an.',
    es: 'Gladys rechazó la estación: consulte los registros de la integración.',
  },
};

// The eight points of the compass, from the north, clockwise.
export const COMPASS = {
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  fr: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  de: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
  es: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
};

/** The compass point of a direction in degrees. */
export function compassPoint(degrees, language) {
  const points = pick(COMPASS, language);
  return points[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

// The "check the source" action report and the scene sentence.
export const REPORT_TEXT = {
  en: {
    sourceOk: (url, software) => `${url} read (${software}).`,
    sourceDown: (url, error) => `${url} failed (${error}).`,
    stopped: 'The station stopped sending data to Cumulus.',
    received: (count, ago) => `${count} values, last new measurement ${ago}.`,
  },
  fr: {
    sourceOk: (url, software) => `${url} lu (${software}).`,
    sourceDown: (url, error) => `Échec sur ${url} (${error}).`,
    stopped: "La station n'envoie plus de données à Cumulus.",
    received: (count, ago) => `${count} valeurs, dernière nouvelle mesure ${ago}.`,
  },
  de: {
    sourceOk: (url, software) => `${url} gelesen (${software}).`,
    sourceDown: (url, error) => `${url} fehlgeschlagen (${error}).`,
    stopped: 'Die Station sendet keine Daten mehr an Cumulus.',
    received: (count, ago) => `${count} Werte, letzte neue Messung ${ago}.`,
  },
  es: {
    sourceOk: (url, software) => `${url} leído (${software}).`,
    sourceDown: (url, error) => `Fallo en ${url} (${error}).`,
    stopped: 'La estación ya no envía datos a Cumulus.',
    received: (count, ago) => `${count} valores, última medición nueva ${ago}.`,
  },
};

export const SUMMARY_TEXT = {
  en: {
    temperature: (t) => `${t} °C`,
    feelsLike: (t) => `feels like ${t} °C`,
    humidity: (h) => `humidity ${h} %`,
    wind: (point, speed) => `wind ${point}${speed} km/h`,
    gusts: (speed) => `gusts ${speed} km/h`,
    raining: 'raining',
    rainToday: (mm) => `${mm} mm of rain today`,
    noData: 'No measurement from the station yet.',
  },
  fr: {
    temperature: (t) => `${t} °C`,
    feelsLike: (t) => `ressenti ${t} °C`,
    humidity: (h) => `humidité ${h} %`,
    wind: (point, speed) => `vent ${point}${speed} km/h`,
    gusts: (speed) => `rafales ${speed} km/h`,
    raining: 'il pleut',
    rainToday: (mm) => `${mm} mm de pluie aujourd'hui`,
    noData: 'Aucune mesure de la station pour le moment.',
  },
  de: {
    temperature: (t) => `${t} °C`,
    feelsLike: (t) => `gefühlt ${t} °C`,
    humidity: (h) => `Luftfeuchtigkeit ${h} %`,
    wind: (point, speed) => `Wind ${point}${speed} km/h`,
    gusts: (speed) => `Böen ${speed} km/h`,
    raining: 'es regnet',
    rainToday: (mm) => `${mm} mm Regen heute`,
    noData: 'Noch keine Messung der Station.',
  },
  es: {
    temperature: (t) => `${t} °C`,
    feelsLike: (t) => `sensación ${t} °C`,
    humidity: (h) => `humedad ${h} %`,
    wind: (point, speed) => `viento ${point}${speed} km/h`,
    gusts: (speed) => `ráfagas ${speed} km/h`,
    raining: 'está lloviendo',
    rainToday: (mm) => `${mm} mm de lluvia hoy`,
    noData: 'Todavía no hay mediciones de la estación.',
  },
};

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

export const locale = (language) => LOCALES[language] ?? LOCALES.en;

/** "3 minutes ago", in the language. */
export function relativeTime(seconds, language) {
  const format = new Intl.RelativeTimeFormat(locale(language), { numeric: 'auto' });
  const abs = Math.max(0, seconds);
  if (abs < 60) {
    return format.format(-Math.round(abs), 'second');
  }
  if (abs < 3600) {
    return format.format(-Math.round(abs / 60), 'minute');
  }
  if (abs < 86400) {
    return format.format(-Math.round(abs / 3600), 'hour');
  }
  return format.format(-Math.round(abs / 86400), 'day');
}

/** A number with the decimal separator of the language. */
export function formatNumber(value, language, decimals = 0) {
  return new Intl.NumberFormat(locale(language), {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * The current conditions as one sentence: "12 °C, feels like 10 °C, humidity
 * 80 %, wind SW 15 km/h, gusts 32 km/h, 3.2 mm of rain today."
 * @param {object|null} reading
 * @param {string} language
 */
export function conditionsSentence(reading, language) {
  const text = pick(SUMMARY_TEXT, language);
  if (!reading) {
    return text.noData;
  }
  const { rainToday, raining } = reading;
  const n = (value, decimals = 0) => formatNumber(value, language, decimals);
  const parts = [];
  if (reading.temperature !== null) {
    parts.push(text.temperature(n(reading.temperature, 1)));
  }
  if (
    reading.feelsLike !== null &&
    reading.temperature !== null &&
    Math.abs(reading.feelsLike - reading.temperature) >= 1
  ) {
    parts.push(text.feelsLike(n(reading.feelsLike)));
  }
  if (reading.humidity !== null) {
    parts.push(text.humidity(n(reading.humidity)));
  }
  if (reading.windSpeed !== null) {
    const point =
      reading.windDirection === null || reading.windSpeed < 1
        ? ''
        : `${compassPoint(reading.windDirection, language)} `;
    parts.push(text.wind(point, n(reading.windSpeed)));
  }
  if (reading.windGust !== null && reading.windGust >= 1) {
    parts.push(text.gusts(n(reading.windGust)));
  }
  if (raining) {
    parts.push(text.raining);
  }
  if (rainToday !== null && rainToday > 0) {
    parts.push(text.rainToday(n(rainToday, 1)));
  }
  if (parts.length === 0) {
    return text.noData;
  }
  const sentence = parts.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
