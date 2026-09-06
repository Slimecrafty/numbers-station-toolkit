# Zahlensender-Toolkit

[![Live-Demo](https://img.shields.io/badge/Live--Demo-GitHub%20Pages-5ee08c)](https://Slimecrafty.github.io/numbers-station-toolkit/)

**Live:** https://Slimecrafty.github.io/numbers-station-toolkit/
*(Sobald GitHub Pages für dieses Repo aktiviert ist — siehe Abschnitt "Auf
GitHub veröffentlichen" unten. Passwortschutz siehe unten — der Link allein
reicht niemandem zum Reinkommen.)*

Ein browserbasierter Encoder/Decoder für selbstgebaute, "Zahlensender"-artige
Ton-Formate — für CB-Funk / Kurzwellen-Experimente über AM, FM und (geplant) SSB.

Die Formate sind lose an die realen ENIGMA-Katalog-Klassifizierungen der
"Russian 7"-Stationsfamilie angelehnt (E07, V07, M12, XPA2, XPB, P07) — siehe
Quellen unten. **Dies ist kein Nachbau realer Sendeinhalte**, sondern nutzt nur
die strukturellen Ideen (3-Ton-Ruf, ID-Vorspann, ton-kodierte Zahlengruppen,
Sync-Töne) für ein eigenes Format.

## Struktur

```
index.html      Startseite / Navigation (Passwort-Gate)
encode.html     Encoder: erzeugt & exportiert die Ton-Sequenz
decode.html     Decoder: Mikrofon oder Datei-Upload, inkl. Schwachsignal-Modus
js/engine.js    Gemeinsame Format-Definitionen + DSP (Goertzel, Sequenzaufbau, OTP)
js/auth.js      Client-seitiges Passwort-Gate
css/style.css   Gemeinsames Erscheinungsbild
```

## Auf GitHub veröffentlichen (mit Live-Link)

1. Neues Repo auf GitHub anlegen, Name: **`numbers-station-toolkit`**
   (so passt der Live-Link oben ohne Anpassung, außer dem Benutzernamen).
2. Diesen Ordner hochladen/pushen (`git init`, `git add .`, `git commit -m "init"`,
   `git remote add origin ...`, `git push`).
3. Im Repo unter **Settings → Pages** als Quelle den `main`-Branch (Ordner `/root`)
   wählen. GitHub zeigt dir danach die fertige URL an — sollte
   `https://Slimecrafty.github.io/numbers-station-toolkit/` sein, passend zum
   Link oben.
4. **Vor dem Push:** eigenes Passwort in `js/auth.js` setzen (siehe unten) —
   der Platzhalter-Hash lässt sonst niemanden rein, auch dich nicht.

GitHub Pages liefert automatisch über HTTPS aus — das ist wichtig, weil
Mikrofonzugriff (`getUserMedia`) in Browsern nur über HTTPS oder `localhost`
erlaubt ist.

## Nutzung

Einfach lokal öffnen oder über einen simplen Webserver bereitstellen (nötig für
manche Browser, damit Mikrofonzugriff funktioniert):

```bash
python3 -m http.server 8000
# dann im Browser: http://localhost:8000
```

## Formate

| Stil   | Ton-Raster            | Sync                     | Angelehnt an |
|--------|-----------------------|--------------------------|--------------|
| simple | 150 Hz Abstand        | fester Extra-Ton         | eigene, robuste Variante |
| xpa2   | 15,625 Hz Abstand (eng, exakter Katalogwert) | alle 5 Ziffern, 15,625 Hz unter Null | XPA2 (USB, 14-Ton-MFSK, 7,8125 Bd, Moskau/Russland) |
| xpb    | 175 Hz Abstand (weit) | fester Extra-Ton         | XPB (USB, 16-Ton-MFSK, ~65,79 Bd) |
| p07    | 125 Hz Abstand        | fester Extra-Ton         | P07 (nur FSK-Ebene; real: 8-Ton-OFDM/QPSK 62,5 Bd + BPSK 250 Bd) |
| cb_weak| Baudrate × 1,6 (orthogonal) | alle 4 Ziffern     | eigener Stil für schwache CB-/AM-/FM-Signale |

Alle Frequenzen liegen im Sprachband (~300–3000 Hz), damit die Sequenz über
normale AM/FM/SSB-Sprachkanäle übertragbar bleibt.

Ruf/Intro (3-Ton-Nummernstation, XPA2-Ruf, XPB-Ruf, P07-Ruf) und Ruf-Länge
sind unabhängig vom gewählten Zahlen-Format-Stil einstellbar — beliebig
kombinierbar.

## Passwortschutz einrichten

`js/auth.js` enthält einen SHA-256-Hash. **Wichtiger Hinweis:** Das ist eine
statische Seite ohne Server — ein clientseitiges Passwort ist kein echter
Schutz, sondern hält nur zufällige Besucher ab. Für echten Zugriffsschutz
braucht es einen Server mit richtigem Login, oder das Repo bleibt privat.

Eigenes Passwort setzen:

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('DEIN-PASSWORT'))
  .then(b => console.log(Array.from(new Uint8Array(b))
    .map(x => x.toString(16).padStart(2,'0')).join('')));
```

Den ausgegebenen Hex-String in `PASSWORD_HASH` in `js/auth.js` eintragen.

## OTP-Verschlüsselung (optional, zuschaltbar)

Encoder und Decoder haben einen OTP-Schalter:

- **An**: Klartext wird über ein festes 39-Zeichen-Alphabet (A–Z, Leerzeichen,
  0–9, Punkt, Komma) in 2-Ziffern-Codes übersetzt und dann ziffernweise mod 10
  mit einem Pad (Schlüssel) verknüpft. Das Pad kann selbst eingegeben oder per
  Knopfdruck kryptographisch zufällig erzeugt werden. Nur die verschlüsselten
  Ziffern gehen in den Ton, das Pad wird **nicht mitgesendet** und muss dem
  Empfänger separat vorliegen (klassisches OTP-Prinzip).
- **Aus**: Zahlengruppen werden direkt eingegeben/gesendet, keine Text- oder
  Pad-Logik.

**Sicherheitshinweis:** Ein One-Time-Pad ist nur dann informationstheoretisch
sicher, wenn das Pad echt zufällig, mindestens so lang wie die Nachricht und
wirklich nur ein einziges Mal verwendet wird. Ist das eingegebene Pad kürzer
als die Nachricht, wird es zyklisch wiederholt — dann ist es kein sicheres
OTP mehr, sondern nur noch eine einfache Verschleierung. Für echte
Vertraulichkeit: Pad mindestens so lang wie die Nachricht, nur einmal
verwenden, sicher (nicht digital neben dem Gerät) austauschen.

## Änderungen — Sound-Korrektur (Ruf + Schwachsignal)

**1. Ruf "3-Ton-Nummernstation" korrigiert auf reales G04-Vorbild ("Three Note Oddity"):**
Vorher: drei hohe, kurze Digital-Töne (850/1150/1450 Hz) — klang wie ein
Telefon-Signalton, nicht wie eine echte Station. Jetzt: tiefes, langsames
Moll-Motiv (G4–Es4–C4, 392/311/262 Hz, je 0,45 s, unabhängig von der
Baudrate), angelehnt an G04 "Three Note Oddity" (vermutlich ungarischer
Nachrichtendienst, aktiv bis ~2005). Grundlage: Akkordanalyse der
Conet-Project-Aufnahme (c-Moll) plus Stations-Beschreibungen (tiefe,
langsame elektronische Töne, starker Rauschanteil). **Ehrlicher Hinweis:**
Es gibt keine veröffentlichte Spektralvermessung der Original-Hz-Werte —
das ist eine begründete Annäherung, keine Reproduktion einer Messung.

**2. Neuer Style "MFSK-Schwachsignal (orthogonal)":**
Ton-Abstand wird automatisch aus der Baudrate berechnet (Ton-Abstand =
1,3× Baudrate — siehe Kommentar in `resolveStyle()` in `engine.js` dazu,
warum nicht exakt 1× wie im Lehrbuch: der Decoder nutzt bewusst nur 80%
des Symbolfensters als Zeitreserve, das erfordert etwas mehr Abstand).
Mit niedriger Baudrate (Standard 4 Bd) kombiniert ergibt das lange
Symboldauer → mehr Energie pro Symbol im schmalen Analysefenster → hörbar
und decodierbar auch bei starkem Rauschen. Per End-to-End-Test mit
künstlichem Rauschen gemessen (nicht nur behauptet): bei −6 bis −12 dB SNR
lag die Ziffern-Trefferquote 20–30 Prozentpunkte über einem normalen Stil
gleicher Länge. Reale Schwachsignal-Digimodes (MFSK16, Olivia) nutzen
zusätzlich Vorwärts-Fehlerkorrektur — hier bewusst weggelassen, um die
Sequenz für dich nachvollziehbar/lesbar zu halten.

## Änderungen — Tonkorrektur (XPA2, G04-Ruf, Übergänge, eigene Audiodatei)

**3. XPA2 auf exakten Katalogwert korrigiert:** Vorher stand ein grob
gerundeter Näherungswert (15 Hz Abstand, als Baudrate-Vorschlag 7,5 Bd) im
Code. Realer ENIGMA-Katalogeintrag: XPA2, USB, 14-Ton-MFSK, **7,8125 Bd**,
**15,625 Hz** Ton-Abstand, Moskau/Russland. `engine.js` (`STYLES.xpa2`) sowie
die Baudrate-Auswahl in Encoder und Decoder nutzen jetzt exakt diese Werte;
beim Umschalten auf den XPA2-Stil wird die Baudrate automatisch auf 7,8125 Bd
vorgeschlagen (analog zum bestehenden Auto-Vorschlag beim Schwachsignal-Stil).

**4. Ruf "Three Note Oddity" (G04) — Frequenzen aktualisiert:** 512/739/899 Hz
statt des vorherigen Moll-Motivs (392/311/262 Hz). Quelle: reddit.com/r/signalis
sowie tvtropes.org, beide zum Videospiel *Signalis*, das den echten G04-Ruf als
Easter Egg nachbildet/referenziert. **Ehrlicher Hinweis:** Das sind Werte aus
einer Fan-Community-Analyse der Spiel-Audiodatei, keine spektral vermessene
Original-Aufnahme der echten Station selbst — die Akkordanalyse der
Conet-Project-Aufnahme (c-Moll, siehe Quellen unten) beschreibt stattdessen
einen tiefen, langsamen Klangcharakter. Auf ausdrücklichen Wunsch trotzdem so
eingesetzt; bei Bedarf später gegen eine echte Spektralmessung austauschbar.

**5. Ton-Übergänge entklickt ("klingt wie einzelne Bauklötze"-Fix):** Die
durchgehende Phase (ein Oszillator für die ganze Sequenz) gab es schon vorher,
hat das Blockig-Klingen aber nicht vollständig behoben — ein reiner
Frequenz-Ramp ohne Amplitudenänderung wird bei größeren Tonsprüngen (z. B.
512→739 Hz im Ruf-Motiv) trotzdem als harter Übergang wahrgenommen. Fix: bei
jedem Ton-zu-Ton-Wechsel bei offenem Gate läuft jetzt zusätzlich ein kurzer,
zum Frequenz-Ramp synchroner Amplituden-Dip (Einsacken auf 80 % und zurück,
insgesamt ~6 ms) — kaschiert den Wechsel, ohne Phase oder MFSK-Timing zu
verändern. Geprüft: Freq-Ramp (6 ms) bleibt bei allen Baudraten-Presets
deutlich innerhalb der 20 %-Zeitreserve, die `decodeSymbols()` je Symbolfenster
frei lässt — Decoder-Genauigkeit unverändert (Regressionstest: 10/10 Ziffern
korrekt bei XPA2 7,8125 Bd und beim "Einfach"-Stil).

**6. Ruf als eigene Audiodatei (Encoder, optional):** Datei-Upload ersetzt nur
den synthetisierten Ruf-Teil; ID/Anzahl/Zahlengruppen danach bleiben Ton-basiert
wie gehabt. Ich kann hier keine echte, urheberrechtlich geschützte
Original-Aufnahme (z. B. Conet-Project) mitliefern — das eigene/gemeinfreie
File muss der Nutzer selbst beisteuern. **Bekannte Einschränkung:** Die
automatische Rufmuster-Erkennung im Decoder (`findOnset()`) sucht die
synthetisierten Ruf-Töne per Matched-Filter und erkennt eine eigene Audiodatei
dort nicht automatisch — diese Funktion ist nur zum Anhören/WAV-Export gedacht,
nicht für den automatischen Encode→Decode-Rundweg.

**7. Ruf "Three Note Oddity" (G04) — erneut korrigiert, jetzt mit belastbarer Quelle:**
950/1400/1800 Hz statt 512/739/899 Hz. Quelle: Buch *Shadows of the State*
(siehe Link unten) — demzufolge sind die drei aufsteigenden Töne direkt aus
dem genormten Special Information Tone (SIT) des internationalen Telefonnetzes
übernommen, nicht frei erfunden. Das ist eine belastbarere Quelle als die
vorherige Fan-Community-Schätzung (512/739/899 Hz, aus einer Spiel-Audiodatei
abgeleitet) und ersetzt diese.

**8. XPB/P07: Baudraten- und Ton-Abstand-Korrektur nach ENIGMA-Katalogdaten:**
Werte vom Nutzer direkt aus dem ENIGMA-Katalog bereitgestellt (nicht
eigenständig gegenkontrolliert): XPB = USB, 16-Ton-MFSK, **~65,79 Bd**,
**175 Hz** Ton-Abstand (Ton-Abstand stimmte bereits, Baudraten-Vorschlag in
Encoder/Decoder war vorher falsch auf "16 Bd" gesetzt — jetzt 65,79 Bd,
automatischer Vorschlag beim Umschalten auf XPB-Stil). P07 = USB, 8-Ton-OFDM,
QPSK, **62,5 Bd**, **125 Hz** Ton-Abstand + separate BPSK-Lage 250 Bd (Ton-
Abstand war vorher 120 Hz statt 125 Hz; hier weiterhin nur die FSK/Ton-Ebene
nachgebildet, OFDM/QPSK/BPSK-Datenlage NICHT implementiert — daher
"Vorschau"-Label). Wichtig: der ENIGMA-Katalog führt für keine der drei
Stile (XPA2/XPB/P07) ein Feld für tatsächliche Ruf/Intro-Frequenzen
("Voice"/"Frequencies": N/A) — die CALL_PATTERNS-Werte für diese drei Rufe
bleiben deshalb unbestätigte Hobbyist-Näherungen, anders als der G04-Ruf
oben (Punkt 7), für den es eine echte Quelle gibt.

**9. Neuer Stil "CB/AM-Schwachsignal (weiter Ton-Abstand)":** zusätzlich zu
"MFSK-Schwachsignal (orthogonal)", speziell für sehr schwache CB-/AM-/FM-
Signale zugeschnitten: Ton-Abstand = 1,6× Baudrate (statt 1,3×) für mehr
Rauschreserve auf Kosten von etwas mehr Bandbreite, Basisfrequenz mittig im
typischen CB-/AM-Durchlassbereich (300–2700 Hz). Empfohlen: sehr niedrige
Baudrate (2 Bd, wird beim Umschalten auf diesen Stil automatisch
vorgeschlagen).

**10. Neue Stile F06a und F07, plus echter F07-Ruf:**

- **F06a** ist im echten Vorbild kein Mehrton-MFSK wie die anderen Stile,
  sondern echtes binäres 2-Ton-FSK (Mark/Space), das laut ENIGMA-Katalog
  benannte Binärdateien überträgt (Frequencies-Feld dort leer/N/A, Emission
  mode: FSK, 200 Bd, 1000 Hz, ACF=288). Die beiden Ton-Frequenzen (1500 Hz /
  2500 Hz, Shift 1000 Hz) stammen NICHT aus dem Katalog, sondern wurden per
  FFT/Goertzel-Analyse einer vom Nutzer bereitgestellten echten Aufnahme
  (f06a-14643usb-20170315-1550z.wav) direkt vermessen — der Katalogwert
  "1000 Hz" bezieht sich also auf den Shift, nicht auf eine Mitten-/
  Basisfrequenz, wie die Messung zeigt. Hier ans bestehende
  Zifferngruppen-Modell angepasst: jede Dezimalziffer wird als 4-Bit-Binärfolge
  über die zwei FSK-Töne gesendet. Baudrate im Tool = Bit-Rate (Katalogwert
  200 Bd), nicht Ziffer-Rate. **Ehrlicher Hinweis:** reales F06a überträgt
  Dateien, keine Zifferngruppen — das ist hier eine Anpassung an das
  bestehende Werkzeug-Modell, keine 1:1-Nachbildung des realen Protokolls.
- **F07** ist im echten Vorbild ein mehrstufiges Format: FSK-Callup (1800/1200
  Hz) → FSK-Barker-Sync (15,625 Bd, 875/2375 Hz) → PSK-Präambel → 5 parallele
  16-Ton-MFSK-Kanäle (20 Hz Ton-Abstand, 10 Bd, 800–2380 Hz Gesamtbereich) →
  FSK-Barker-Outro (15,625 Bd, 1500/1750 Hz), siehe priyom.org (Quelle unten).
  Hier nur die reine Mehrton-Ebene nachgebildet (ein einzelner Kanal des
  realen 5-Kanal-Systems: 20 Hz Abstand, Basis 800 Hz), analog zum
  bestehenden P07-Stil — Barker/PSK/Mehrkanal-Teile fehlen, daher
  "Vorschau"-Label. Der neue F07-Ruf bildet dafür die reale Callup-Sequenz
  exakt nach: 1800 Hz (500 ms), 1200 Hz (1500 ms), 1800 Hz (500 ms), 1200 Hz
  (1500 ms), 1000 Hz (100 ms) — mit ungleichen Tondauern, im Unterschied zu
  den anderen (gleichmäßig getakteten) Rufmustern. Die Katalog-Werte einer
  b.wav-Beispielaufnahme des Nutzers stimmten bei eigener Spektralanalyse
  nicht sauber mit einem einfachen gleichmäßigen Ton-Raster überein (vermutlich
  wegen der oben beschriebenen Mehrkanal-/PSK-Struktur des echten Signals,
  die dieses Werkzeug nicht vollständig nachbildet) — die hier verwendeten
  20 Hz/800 Hz-Werte stammen daher aus der priyom.org-Dokumentation, nicht aus
  einer eigenen Vermessung von b.wav.

## Quellen (ENIGMA-Klassifizierung)

- sigidwiki.com — CIS MFSK-16 XPA2, P07 numbers station
- priyom.org — Russian 7 (Operator-Übersicht, XPA2)
- signalshed.com — ENIGMA Control List, XPB-Ankündigung (2019)
- shortwaveinvestigations.wordpress.com — E07 Formatbeschreibung
- radiohobbyist.org / spynumbers.com — ENIGMA-Klassifizierungsschema allgemein
- numbers-stations.com, radioespionage.net, radiohobbyist.org (3NOTE.HTM) — G04 "Three Note Oddity" (Herkunft, Sprache, Sendezeiten)
- chordify.net — Akkordanalyse der Conet-Project-Aufnahme "Three Note Oddity" (c-Moll)
- reddit.com/r/signalis, tvtropes.org (VideoGame/Signalis) — 512/739/899-Hz-Werte des im Spiel *Signalis* nachgebildeten G04-Rufs (Fan-Analyse der Spiel-Audiodatei, keine Original-Stationsmessung, mittlerweile ersetzt, siehe Punkt 7 oben)
- dokumen.pub — Buch *Shadows of the State*, Quelle für 950/1400/1800 Hz (SIT-Ton-Herkunft des G04-Rufs)
- priyom.org/number-stations/digital/f07/protocol — F07-Protokollbeschreibung (Callup, Barker, PSK-Präambel, 5-Kanal-MFSK), Quelle für den F07-Ruf und die F07-MFSK-Parameter
- ENIGMA-Katalogeintrag F06a (vom Nutzer bereitgestellt: FSK, 200 Bd, 1000 Hz Shift, ACF=288) — Ton-Frequenzen (1500/2500 Hz) selbst per FFT/Goertzel aus f06a-14643usb-20170315-1550z.wav vermessen, nicht aus dem Katalog

## Lizenz

MIT, siehe LICENSE.
