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
| xpa2   | 15 Hz Abstand (eng)   | alle 5 Ziffern, 15 Hz unter Null | XPA2 |
| xpb    | 175 Hz Abstand (weit) | fester Extra-Ton         | XPB / XPB1 |
| p07    | 120 Hz Abstand        | fester Extra-Ton         | P07 (nur FSK-Ebene) |

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

## Quellen (ENIGMA-Klassifizierung)

- sigidwiki.com — CIS MFSK-16 XPA2, P07 numbers station
- priyom.org — Russian 7 (Operator-Übersicht, XPA2)
- signalshed.com — ENIGMA Control List, XPB-Ankündigung (2019)
- shortwaveinvestigations.wordpress.com — E07 Formatbeschreibung
- radiohobbyist.org / spynumbers.com — ENIGMA-Klassifizierungsschema allgemein
- numbers-stations.com, radioespionage.net, radiohobbyist.org (3NOTE.HTM) — G04 "Three Note Oddity" (Herkunft, Sprache, Sendezeiten)
- chordify.net — Akkordanalyse der Conet-Project-Aufnahme "Three Note Oddity" (c-Moll)

## Lizenz

MIT, siehe LICENSE.
