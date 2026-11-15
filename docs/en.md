# Cumulus & Weather Display

Brings your weather station into Gladys through **Cumulus MX** (or Cumulus 1) or **Weather
Display**, whatever its brand (Davis, Ecowitt, Fine Offset, Oregon Scientific, La Crosse…):
temperature, humidity, pressure and its trend, wind, rain, UV, solar radiation and more, as the
software measures them.

> Developed without the hardware: feedback welcome. The integration follows the source code of
> Cumulus MX (build 4107 era), the realtime.txt documentation of the Cumulus wiki and a real
> clientraw.txt of a Weather Display station online, but it has not been tried yet with a real
> Cumulus MX. Your feedback is welcome on the GitHub repository.

This integration is not affiliated with Cumulus (Sandaysoft) nor with Weather Display.

## Overview

The integration reads one of three sources, over your local network:

- **Cumulus MX (API)**: the interface of Cumulus MX, on port 8998, live. Recommended for Cumulus MX.
- **realtime.txt**: the one-line file Cumulus 1 and Cumulus MX write at their realtime interval,
  served by a web server.
- **clientraw.txt**: the one-line file Weather Display writes, served by a web server.

You get one Gladys device for the station, four scene triggers, one scene action and one
dashboard widget. Everything is read-only and stays on your local network: no account, no cloud.

The units are read from the source (°F, mph, knots, inHg, inches…): Gladys receives °C, km/h, hPa
and mm, and converts them to your preferences where it can.

## Requirements

- Gladys 5.1 or later.
- Cumulus MX, Cumulus 1 or Weather Display, reachable over the network from Gladys.

### Cumulus MX

Nothing to install: the interface of Cumulus MX (`http://address:8998`) already answers. Its
station must be started. Gladys runs the integration in a container: `localhost` is the container
itself, use the address of the machine running Cumulus MX.

### realtime.txt

In Cumulus, enable the realtime file (**Internet settings → Interval settings → Real time**, then
the realtime.txt file in the realtime files list) and have it copied to a folder served by a web
server. Open its address in a browser first: you must see one line of numbers.

### clientraw.txt

In Weather Display, enable the creation of clientraw.txt (custom web files) and have it served by
a web server. Open its address in a browser first: the line starts with `12345`.

## Configuration

In Gladys, open **Integrations → Cumulus & Weather Display → Configuration**:

| Field                | What to enter                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Source               | Cumulus MX (API), realtime.txt file (Cumulus) or clientraw.txt file (Weather Display).     |
| Address              | Cumulus MX: `http://address:8998`. A file: its full address. `user:password@` is accepted. |
| Reading interval (s) | 30 by default, 10 at least.                                                                |
| Language of texts    | Feature names (set when the station is added), scene sentence and action messages.         |

Save, then click **Check the source**: the button tells whether the source answers, which program
and version, and how many values it gave. Then open the **Discovery** tab and add the station.

## The station device

The station only gets the features it measures. Both text files write 0 for a sensor the station
does not have: indoor, UV and solar radiation only appear once a non-zero value was read. A sensor
added later appears in the Discovery tab, which then offers to update the device.

| Feature                   | Unit   | Cumulus MX tag / realtime.txt field / clientraw.txt field |
| ------------------------- | ------ | --------------------------------------------------------- |
| Temperature               | °C     | `temp` / 3 / 4                                            |
| Feels like                | °C     | `feelslike` / 59 / —                                      |
| Dew point                 | °C     | `dew` / 5 / 72                                            |
| Humidity                  | %      | `hum` / 4 / 5                                             |
| Indoor temperature        | °C     | `intemp` / 23 / 12                                        |
| Indoor humidity           | %      | `inhum` / 24 / 13                                         |
| Sea-level pressure        | hPa    | `press` / 11 / 6                                          |
| Pressure trend (3 h)      | hPa    | `presstrendval` × 3 / 19 × 3 / —                          |
| Average wind / Wind gusts | km/h   | `wspeed`, `wgust` / 6, 41 / 1, 2                          |
| Wind direction            | °      | `avgbearing` / 47 / 3                                     |
| Rain intensity            | mm/h   | `rrate` / 9 / 10 × 60                                     |
| Rain today                | mm     | `rfall` / 10 / 7                                          |
| Raining                   | yes/no | `IsRaining`, or a non-zero rain intensity                 |
| UV index                  |        | `UV` / 44 / 79                                            |
| Solar radiation (W/m²)    |        | `SolarRad` / 46 / 127                                     |
| Low battery               | yes/no | `LowBatteryList` not empty (Cumulus MX only)              |
| Station reachable         | yes/no | the source answers and a new measurement in 15 minutes    |
| Last measurement          | min    | minutes since the last new measurement                    |

**Rain today** is the one of the software: from its rollover hour (midnight or 9 am in Cumulus).
**Station reachable** turns to no when the source does not answer, when Cumulus MX says its
station stopped sending data, when realtime.txt says the sensor contact is lost, or after 15
minutes without a new measurement. **Last measurement** counts with the clock of Gladys.

## Widget

**Weather station** shows the current conditions: live tiles (temperature, humidity, wind, rain
today, pressure, those the station measures), then the feels-like temperature, the wind with its
direction and gusts, the rain, the UV index, the indoor console and a low battery, and how long ago
the last measurement arrived. The values follow your metric or imperial preference. The **Show the
details** setting hides the list under the tiles.

## Scene triggers

- **It starts raining**: the station measures rain after at least 30 minutes without any. Once per
  rain episode, whatever the showers in between. Variable: station name.
- **The rain stops**: no rain for the chosen time (15, 30, 60 or 120 minutes) after rain. Once per
  dry spell. Variables: rain today (mm), station name.
- **Strong wind gust**: a gust above the chosen speed (30 to 120 km/h), the first one for 30
  minutes. Variables: gust (km/h), station name.
- **Station silent**: no new measurement for the chosen time (5 to 120 minutes): the software, the
  station or the network is down. Once per silence. Variables: minutes without measurement, station
  name.

After a restart of the integration, the first measurement is the baseline: rain already falling or
a wind already strong fires nothing.

## Scene action

**Current conditions** returns the latest measurements as a sentence ready for a message — for
example `12.4 °C, feels like 10 °C, humidity 81 %, wind SW 15 km/h, gusts 32 km/h.` — and as
numbers: temperature, humidity, average wind, gusts, rain today, raining, minutes since the
measurement. The sentence follows the language of the configuration.

## Scene examples

- _Morning message_: at 7 am, **Current conditions**, then send a message
  `Weather at home: {{summary}}`.
- _Retract the awning_: **Strong wind gust** above 50 km/h → close the awning and send a message
  with the gust.
- _Laundry outside_: **It starts raining** → send a message "bring the laundry in".
- _Watering_: **The rain stops** for 120 minutes, with the condition "Rain today below 2 mm" →
  start the watering.
- _Station monitoring_: **Station silent** for 60 minutes → send a message.

## Refresh and data use

- The source is read at the chosen interval by the integration itself. The states go to Gladys at
  most every 15 seconds, and only those that changed. The triggers see every new measurement.
- Cumulus MX answers live; the files only change when the software rewrites them (its realtime
  interval): reading them more often than that is useless.
- A value that does not change is sent again every 6 hours, so that Gladys never shows it as
  outdated.
- Nothing leaves your local network.

## Troubleshooting

- **No station in the Discovery tab**: nothing was read yet. Click **Check the source**.
- **"Cumulus MX does not answer"**: wrong address or port, Cumulus MX stopped, or its station not
  started yet (Cumulus MX answers 503 then). Do not use `localhost`.
- **"This address does not answer like Cumulus MX"**: the address points to another program, or
  the source chosen is not the right one.
- **"The file is not a realtime.txt of Cumulus"** (or clientraw.txt): the address shows a web page,
  an error page or another file. Open it in a browser.
- **Station reachable stays at no with a file**: the file is not rewritten any more (check the
  realtime upload of the software), or its date is more than 15 minutes old.
- **Station silent fires too often with a file**: the file is only rewritten at the realtime
  interval of the software; choose a longer time.
- **Logs**: set `LOG_LEVEL=debug` on the container for the detail of each cycle.

## Limits

- One source, hence one station, per integration.
- The extra sensors (extra temperatures, soil, leaf, lightning, air quality…) are not read yet.
- realtime.txt and clientraw.txt carry no battery state; clientraw.txt has no feels-like
  temperature nor pressure trend.
- The dates of the files are read in the time zone of Gladys: the software must run in the same one.
- Developed without the hardware nor a running Cumulus MX.
