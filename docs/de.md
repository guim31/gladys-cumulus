# Cumulus & Weather Display

Bringt deine Wetterstation über **Cumulus MX** (oder Cumulus 1) oder **Weather Display** in
Gladys, egal welche Marke (Davis, Ecowitt, Fine Offset, Oregon Scientific, La Crosse…):
Temperatur, Luftfeuchtigkeit, Luftdruck und seine Tendenz, Wind, Regen, UV, Sonneneinstrahlung und
mehr, so wie die Software sie misst.

> Ohne die Hardware entwickelt: Rückmeldungen sind willkommen. Die Integration folgt dem
> Quellcode von Cumulus MX, der realtime.txt-Dokumentation des Cumulus-Wikis und einer echten
> clientraw.txt einer Weather-Display-Station im Netz, wurde aber noch nicht mit einem echten
> Cumulus MX ausprobiert. Deine Rückmeldungen sind im GitHub-Repository willkommen.

Diese Integration ist weder mit Cumulus (Sandaysoft) noch mit Weather Display verbunden.

## Überblick

Die Integration liest eine von drei Quellen, in deinem lokalen Netzwerk:

- **Cumulus MX (API)**: die Oberfläche von Cumulus MX, auf Port 8998, live. Empfohlen mit Cumulus
  MX.
- **realtime.txt**: die einzeilige Datei, die Cumulus 1 und Cumulus MX in ihrem Echtzeit-Intervall
  schreiben, von einem Webserver ausgeliefert.
- **clientraw.txt**: die einzeilige Datei von Weather Display, von einem Webserver ausgeliefert.

Du erhältst ein Gladys-Gerät für die Station, vier Szenen-Auslöser, eine Szenen-Aktion und ein
Dashboard-Widget. Alles ist nur lesend und bleibt in deinem lokalen Netzwerk: kein Konto, keine
Cloud.

Die Einheiten werden aus der Quelle gelesen (°F, mph, Knoten, inHg, Zoll…): Gladys erhält °C, km/h,
hPa und mm und rechnet sie nach deinen Vorlieben um, wo es kann.

## Voraussetzungen

- Gladys 5.1 oder neuer.
- Cumulus MX, Cumulus 1 oder Weather Display, von Gladys aus über das Netzwerk erreichbar.

### Cumulus MX

Nichts zu installieren: Die Oberfläche von Cumulus MX (`http://adresse:8998`) antwortet bereits.
Seine Station muss gestartet sein. Gladys führt die Integration in einem Container aus: `localhost`
ist der Container selbst, nimm die Adresse des Rechners, auf dem Cumulus MX läuft.

### realtime.txt

Aktiviere in Cumulus die Echtzeit-Datei (**Internet settings → Interval settings → Real time**,
dann die Datei realtime.txt in der Liste der Echtzeit-Dateien) und lass sie in einen Ordner
kopieren, den ein Webserver ausliefert. Öffne ihre Adresse zuerst im Browser: Du musst eine Zeile
mit Zahlen sehen.

### clientraw.txt

Aktiviere in Weather Display das Erzeugen von clientraw.txt (eigene Web-Dateien) und lass sie von
einem Webserver ausliefern. Öffne ihre Adresse zuerst im Browser: Die Zeile beginnt mit `12345`.

## Konfiguration

Öffne in Gladys **Integrationen → Cumulus & Weather Display → Konfiguration**:

| Feld              | Was einzugeben ist                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Quelle            | Cumulus MX (API), Datei realtime.txt (Cumulus) oder Datei clientraw.txt (Weather Display).           |
| Adresse           | Cumulus MX: `http://adresse:8998`. Eine Datei: ihre vollständige Adresse. `benutzer:passwort@` geht. |
| Leseintervall (s) | Standardmäßig 30, mindestens 10.                                                                     |
| Sprache der Texte | Namen der Funktionen (beim Hinzufügen festgelegt), Szenen-Satz und Meldungen der Aktionen.           |

Speichere und klicke dann auf **Quelle prüfen**: Die Schaltfläche zeigt, ob die Quelle antwortet,
welche Software in welcher Version, und wie viele Werte sie geliefert hat. Öffne dann den Tab
**Erkennung** und füge die Station hinzu.

## Das Stationsgerät

Die Station erhält nur die Funktionen, die sie misst. Beide Textdateien schreiben 0 für einen
fehlenden Sensor: Innen, UV und Sonneneinstrahlung erscheinen erst nach einem Wert ungleich null.
Ein später hinzugefügter Sensor erscheint im Tab Erkennung, der dann anbietet, das Gerät zu
aktualisieren.

| Funktion                  | Einheit | Tag Cumulus MX / Feld realtime.txt / Feld clientraw.txt  |
| ------------------------- | ------- | -------------------------------------------------------- |
| Temperatur                | °C      | `temp` / 3 / 4                                           |
| Gefühlte Temperatur       | °C      | `feelslike` / 59 / —                                     |
| Taupunkt                  | °C      | `dew` / 5 / 72                                           |
| Luftfeuchtigkeit          | %       | `hum` / 4 / 5                                            |
| Innentemperatur           | °C      | `intemp` / 23 / 12                                       |
| Luftfeuchtigkeit innen    | %       | `inhum` / 24 / 13                                        |
| Luftdruck (Meereshöhe)    | hPa     | `press` / 11 / 6                                         |
| Luftdrucktendenz (3 h)    | hPa     | `presstrendval` × 3 / 19 × 3 / —                         |
| Mittlerer Wind / Windböen | km/h    | `wspeed`, `wgust` / 6, 41 / 1, 2                         |
| Windrichtung              | °       | `avgbearing` / 47 / 3                                    |
| Regenintensität           | mm/h    | `rrate` / 9 / 10 × 60                                    |
| Regen heute               | mm      | `rfall` / 10 / 7                                         |
| Es regnet                 | ja/nein | `IsRaining` oder eine Regenintensität ungleich null      |
| UV-Index                  |         | `UV` / 44 / 79                                           |
| Sonneneinstrahlung (W/m²) |         | `SolarRad` / 46 / 127                                    |
| Batterie schwach          | ja/nein | `LowBatteryList` nicht leer (nur Cumulus MX)             |
| Station erreichbar        | ja/nein | die Quelle antwortet und eine neue Messung in 15 Minuten |
| Letzte Messung            | min     | Minuten seit der letzten neuen Messung                   |

**Regen heute** ist der der Software: ab ihrer Tageswechsel-Stunde (Mitternacht oder 9 Uhr in
Cumulus). **Station erreichbar** wird zu nein, wenn die Quelle nicht antwortet, wenn Cumulus MX
meldet, dass seine Station keine Daten mehr sendet, wenn realtime.txt den Verlust des
Sensorkontakts meldet, oder nach 15 Minuten ohne neue Messung. **Letzte Messung** zählt nach der
Uhr von Gladys.

## Widget

**Wetterstation** zeigt die aktuellen Bedingungen: Live-Kacheln (Temperatur, Luftfeuchtigkeit,
Wind, Regen heute, Luftdruck, die die Station misst), dann die gefühlte Temperatur, den Wind mit
Richtung und Böen, den Regen, den UV-Index, die Innenkonsole und eine schwache Batterie, und seit
wann die letzte Messung da ist. Die Werte folgen deiner metrischen oder imperialen Vorliebe. Die
Einstellung **Details anzeigen** blendet die Liste unter den Kacheln aus.

## Szenen-Auslöser

- **Es beginnt zu regnen**: Die Station misst Regen nach mindestens 30 Minuten ohne. Einmal pro
  Regenepisode, egal welche Schauer dazwischen. Variable: Name der Station.
- **Der Regen hört auf**: kein Regen mehr seit der gewählten Dauer (15, 30, 60 oder 120 Minuten),
  nach Regen. Einmal pro Trockenphase. Variablen: Regen heute (mm), Name der Station.
- **Starke Windböe**: eine Böe über der gewählten Geschwindigkeit (30 bis 120 km/h), die erste seit
  30 Minuten. Variablen: Böe (km/h), Name der Station.
- **Station stumm**: keine neue Messung seit der gewählten Dauer (5 bis 120 Minuten): Die Software,
  die Station oder das Netzwerk ist ausgefallen. Einmal pro Stille. Variablen: Minuten ohne
  Messung, Name der Station.

Nach einem Neustart der Integration dient die erste Messung als Referenz: Bereits fallender Regen
oder bereits starker Wind löst nichts aus.

## Szenen-Aktion

**Aktuelle Bedingungen** gibt die letzten Messwerte als Satz für eine Nachricht zurück — zum
Beispiel `12,4 °C, gefühlt 10 °C, Luftfeuchtigkeit 81 %, Wind SW 15 km/h, Böen 32 km/h.` — und als
Werte: Temperatur, Luftfeuchtigkeit, mittlerer Wind, Böen, Regen heute, es regnet, Minuten seit der
Messung. Der Satz folgt der Sprache der Konfiguration.

## Szenen-Beispiele

- _Morgennachricht_: um 7 Uhr **Aktuelle Bedingungen**, dann eine Nachricht senden
  `Wetter zu Hause: {{summary}}`.
- _Markise einfahren_: **Starke Windböe** über 50 km/h → Markise schließen und eine Nachricht mit
  der Böe senden.
- _Wäsche draußen_: **Es beginnt zu regnen** → eine Nachricht „Wäsche reinholen“ senden.
- _Bewässerung_: **Der Regen hört auf** seit 120 Minuten, mit der Bedingung „Regen heute unter
  2 mm“ → Bewässerung starten.
- _Stationsüberwachung_: **Station stumm** seit 60 Minuten → eine Nachricht senden.

## Aktualisierung und Datennutzung

- Die Quelle wird von der Integration selbst im gewählten Intervall gelesen. Die Zustände gehen
  höchstens alle 15 Sekunden an Gladys, und nur die geänderten. Die Auslöser sehen jede neue
  Messung.
- Cumulus MX antwortet live; die Dateien ändern sich nur, wenn die Software sie neu schreibt (ihr
  Echtzeit-Intervall): Öfter zu lesen bringt nichts.
- Ein Wert, der sich nicht ändert, wird alle 6 Stunden erneut gesendet, damit Gladys ihn nie als
  veraltet anzeigt.
- Nichts verlässt dein lokales Netzwerk.

## Fehlerbehebung

- **Keine Station im Tab Erkennung**: Es wurde noch nichts gelesen. Klicke auf **Quelle prüfen**.
- **„Cumulus MX antwortet nicht“**: falsche Adresse oder falscher Port, Cumulus MX gestoppt, oder
  seine Station noch nicht gestartet (Cumulus MX antwortet dann 503). Nimm nicht `localhost`.
- **„Diese Adresse antwortet nicht wie Cumulus MX“**: Die Adresse zeigt auf eine andere Software,
  oder die gewählte Quelle ist nicht die richtige.
- **„Die Datei ist keine realtime.txt von Cumulus“** (oder clientraw.txt): Die Adresse zeigt eine
  Webseite, eine Fehlerseite oder eine andere Datei. Öffne sie im Browser.
- **Station erreichbar bleibt mit einer Datei auf nein**: Die Datei wird nicht mehr neu
  geschrieben (prüfe den Echtzeit-Upload der Software), oder ihr Datum ist älter als 15 Minuten.
- **Station stumm löst mit einer Datei zu oft aus**: Die Datei wird nur im Echtzeit-Intervall der
  Software neu geschrieben; wähle eine längere Dauer.
- **Protokolle**: Setze `LOG_LEVEL=debug` am Container für die Details jedes Zyklus.

## Grenzen

- Eine Quelle, also eine Station, pro Integration.
- Die Zusatzsensoren (weitere Temperaturen, Boden, Blatt, Blitz, Luftqualität…) werden noch nicht
  gelesen.
- realtime.txt und clientraw.txt tragen keinen Batteriezustand; clientraw.txt hat weder gefühlte
  Temperatur noch Luftdrucktendenz.
- Die Daten der Dateien werden in der Zeitzone von Gladys gelesen: Die Software muss in derselben
  laufen.
- Ohne die Hardware und ohne laufendes Cumulus MX entwickelt.
