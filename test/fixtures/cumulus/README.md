# Source fixtures

Not formatted by Prettier on purpose: each file is the exact bytes a source serves.

| File                | Origin                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientraw.txt`     | A real clientraw.txt of a Weather Display station online (Weather Display 10.37S build 153), fetched on 15/11/2026. Station name already generic (`mystation`); its latitude and longitude (fields 160 and 161) replaced by invented values.            |
| `realtime-wiki.txt` | The example line of the realtime.txt page of the Cumulus wiki (Cumulus 1.8.2, mph, mb, mm; its field 51 says "sensor contact lost").                                                                                                                  |
| `realtime-mx.txt`   | Written by hand, field by field, after `CreateRealtimeFileString` in `Cumulus.cs` of Cumulus MX (60 fields, metric, CRLF ending). Values invented.                                                                                                     |
| `api-metric.json`   | Written by hand after `ApiTagProcessor.ProcessJson` of Cumulus MX: the answer of `GET /api/tags/process.json?rc&…` (values as strings, not escaped: the quote in the station name is what Cumulus MX really writes). Values invented.                  |
| `api-us.json`       | Same, in °F, mph, inHg and in, without indoor, UV nor solar sensor (`-`), with a low battery.                                                                                                                                                         |

Cumulus MX (build 5026) could not be run here, so the API and MX realtime.txt answers are
reconstructed from its source code rather than captured.
