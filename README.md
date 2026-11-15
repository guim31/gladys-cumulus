# Cumulus & Weather Display for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for the weather stations run by
**[Cumulus MX](https://cumulus.hosiene.co.uk)** (or Cumulus 1) or **Weather Display**: the
measurements of your station, whatever its brand (Davis, Ecowitt, Fine Offset, Oregon Scientific,
La Crosse…), read locally.

> **Developed without the hardware: feedback welcome.** The parsers follow the source code of
> Cumulus MX (its tag API and its realtime.txt writer), the realtime.txt example of the Cumulus wiki
> and a real clientraw.txt of a Weather Display station online (see `test/fixtures/cumulus/`).
> Running Cumulus MX with its simulated station was not possible here: it has not been tried
> against a running Cumulus MX yet. Please open an issue with what you see.

## Features

- **Three sources**, one at a time:
  - **Cumulus MX (API)**: `GET /api/tags/process.json` on its interface (port 8998), live;
  - **realtime.txt** of Cumulus 1 or MX, served by a web server;
  - **clientraw.txt** of Weather Display, served by a web server.
- Units read from the source (°C/°F, m/s, mph, km/h, knots, mb, hPa, inHg, kPa, mm, in): Gladys
  receives °C, km/h, hPa, mm and mm/h.
- **One device for the station**, with the features it measures: temperature, feels like, dew
  point, humidity, indoor temperature and humidity, sea-level pressure and its 3-hour trend,
  average wind, gusts, direction, rain intensity, rain today, raining, UV index, solar radiation,
  low battery, station reachable, minutes since the last new measurement.
- **Scene triggers**: it starts raining (once per episode), the rain stops (after 15 to 120 dry
  minutes), strong wind gust (30 to 120 km/h), station silent (5 to 120 minutes).
- **Scene action**: current conditions, as a ready-made sentence plus its numbers.
- **Dashboard widget**: the current conditions, with live tiles.
- English, French, German and Spanish.

## Requirements

- Gladys 5.1.0 or later.
- Cumulus MX reachable from Gladys on its interface port, or a realtime.txt / clientraw.txt file
  served over HTTP.

## Installation

In Gladys: **Integrations → Install from GitHub**, with this repository's URL
(`https://github.com/guim31/gladys-cumulus`), or from the store once published. Choose the source
and its address in the Configuration tab, click **Check the source**, then add the station from
the Discovery tab. The user documentation is in [`docs/`](docs/en.md) (English, French, German,
Spanish).

## Limitations

- Developed without the hardware nor a running Cumulus MX (see above).
- One source, hence one station, per integration.
- Extra sensors (extra temperatures, soil, leaf, lightning, air quality…) are not read yet.
- realtime.txt and clientraw.txt carry no battery state, and write 0 for a missing sensor: indoor,
  UV and solar features only appear once a non-zero value was read.
- The dates of the files are read in the time zone of Gladys.
- Feature names are frozen when the station is added in Gladys.

## Development

Node.js 22+, ESM, no build step. One runtime dependency:
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js); HTTP
uses the `fetch` built into Node.

```bash
npm install
npm test              # node --test, on the SDK's fake Gladys and a fake web server
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .   # store validator
```

```
index.js                  SDK wiring (src/app.js registers the handlers)
src/app.js                handlers: discovery, action, scene action, widget, configuration
src/hub.js                source reading timer, latest reading, throttled states, scene events, clock
src/devices.js            the station device, its features and states
src/triggers.js           rain episodes, dry spells, gust thresholds, silences
src/scenes.js             "current conditions" scene action
src/widgets.js            "Weather station" dashboard widget
src/i18n.js               every text, in en/fr/de/es
src/cumulus/units.js      units of Cumulus and Weather Display -> °C, km/h, hPa, mm
src/cumulus/parse.js      tag API, realtime.txt and clientraw.txt -> readings
src/cumulus/source.js     HTTP reader (basic auth from the URL, size cap)
test/                     node --test; source answers in test/fixtures/cumulus/
```

`test/gladys-rules.test.js` checks every discovered device against the category/type table
extracted from the Gladys core.

To run the integration outside Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="cumulus" \
npm start
```

Releases are made by the **Release** workflow (Actions → Release); never edit the versions by
hand. A hand-pushed `vX.Y.Z` tag also builds the image and the GitHub Release, but then `version`
in `package.json` and in the manifest (with the `docker_image` tag) must be bumped and committed
before tagging. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [Cumulus MX](https://github.com/cumulusmx/CumulusMX) by Sandaysoft (Steve Loft) and Mark Crossley
  (GPL-3.0): the tag API, the web tag names, the unit texts and the realtime.txt format, read in its
  source code; the [Cumulus wiki](https://www.cumuluswiki.org) for the realtime.txt documentation
  and its example line.
- Weather Display by Brian Hamilton: the clientraw.txt format. Field positions cross-checked with
  [homeassistant-clientraw](https://github.com/pilotak/homeassistant-clientraw) by Pavel Slama
  (Apache-2.0).
- The scene triggers, widget and overall structure come from the sibling integration
  [gladys-weewx](https://github.com/guim31/gladys-weewx).
- Cover: the official Cumulus MX logo (`webfiles/images/CumulusMX-Logo.png` of the Cumulus MX
  distribution, GPL-3.0), upscaled on a sky gradient.
- No code of these projects is included.

## Disclaimer

This project is not affiliated with, endorsed or sponsored by Sandaysoft, the Cumulus MX project or
Weather Display. "Cumulus" and "Weather Display" are the names of their owners' software.

## License

[Apache-2.0](LICENSE)
