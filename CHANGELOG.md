# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-15

### Added

- Your weather station in Gladys through Cumulus MX (its API on port 8998),
  a realtime.txt file of Cumulus 1 or MX, or a clientraw.txt file of Weather
  Display: temperature, feels like, dew point, humidity, indoor console,
  pressure and its 3-hour trend, wind, gusts and direction, rain intensity,
  rain today, raining, UV, solar radiation, low battery, station reachable
  and last measurement, converted from the units of the source.
- Scene triggers: it starts raining, the rain stops, strong wind gust,
  station silent.
- Scene action: current conditions, as a sentence and its numbers.
- Dashboard widget: the current conditions of the station.
- "Check the source" action in the configuration.
- English, French, German and Spanish everywhere.

[Unreleased]: https://github.com/guim31/gladys-cumulus/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-cumulus/releases/tag/v1.0.0
