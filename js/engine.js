/*
 * engine.js — shared tone-format definitions and DSP helpers.
 * Used by both encode.html and decode.html so the two sides always
 * agree on frequency mapping and timing.
 *
 * Formats are loosely modeled on real ENIGMA-catalog "Russian 7" family
 * numbers stations (E07 / V07 / M12 / XPA2 / XPB / P07) — see README.md
 * for sources. This is a hobbyist re-creation for CB/shortwave
 * experimentation, not a reproduction of any real station's traffic.
 *
 * XPA2/XPB/P07 Baudraten & Ton-Abstände (7,8125 Bd/15,625 Hz;
 * ~65,79 Bd/175 Hz; 62,5 Bd/125 Hz) stammen aus vom Nutzer direkt
 * bereitgestellten ENIGMA-Katalogdaten — nicht eigenständig von mir
 * gegenkontrolliert. Die Ruf/Intro-Frequenzen (CALL_PATTERNS) für diese
 * drei Stile sind weiterhin unbestätigte Hobbyist-Näherungen: der
 * ENIGMA-Katalog listet dafür kein Feld für tatsächliche Ruf-Hz-Werte
 * (Voice/Frequencies-Feld dort: N/A). Einzige Ausnahme mit belastbarer
 * Quelle: der G04-"Three Note Oddity"-Ruf (siehe CALL_PATTERNS unten).
 */

const SAMPLE_RATE = 8000; // voice-band, matches AM/FM/SSB voice channel bandwidth

// NOTE: call-up tone triples are intentionally three *distinct* frequencies
// (not a palindrome like f1,f2,f1). A palindromic pattern is ambiguous for
// matched-filter onset detection under noise (it can lock onto the wrong
// repeat cycle) — see README "Bekannte Grenzen".
const STYLES = {
  simple: {
    label: "Einfach — robuster 10-Ton-Code",
    hint: "Zehn gut getrennte Töne (150 Hz Abstand). Leicht zu decodieren, guter Startpunkt.",
    base: 600, step: 150, sync: 2400,
  },
  // Korrigiert auf realen ENIGMA-Katalogeintrag: XPA2, USB, 14-Ton-MFSK,
  // 7,8125 Bd, 15,625 Hz Ton-Abstand, Moskau/Russland. Vorher stand hier
  // ein grob gerundeter Näherungswert (15 Hz / 7.5 Bd) — keine reale
  // Katalogangabe. step/sync sowie die vorgeschlagene Baudrate im UI
  // (encode.html/decode.html) sind jetzt beide exakt auf den Katalogwert
  // gesetzt.
  xpa2: {
    label: "XPA2-Stil",
    hint: "Ziffern-Töne eng gestaffelt (15,625 Hz Abstand, exakter ENIGMA-Katalogwert für XPA2: USB, 14-Ton-MFSK, 7,8125 Bd, Moskau/Russland). Sync-Ton 15,625 Hz unter dem Nullpunkt. Baudrate unten wird beim Wechsel auf diesen Stil automatisch auf 7,8125 Bd vorgeschlagen.",
    base: 1000, step: 15.625, sync: 984.375,
    syncEvery: 5,
  },
  xpb: {
    label: "XPB-Stil",
    hint: "Ziffern-Töne 175 Hz Abstand (exakter ENIGMA-Katalogwert für XPB: USB, 16-Ton-MFSK, ~65,79 Bd). Baudrate unten wird beim Wechsel auf diesen Stil automatisch auf 65,79 Bd vorgeschlagen.",
    base: 540, step: 175, sync: 2290,
  },
  // Korrigiert: ENIGMA-Katalogeintrag für P07 nennt 125 Hz Ton-Abstand
  // (Datenlage laut Nutzer: USB, 8-Ton-OFDM, QPSK, 62,5 Bd, 125 Hz +
  // zusätzliche BPSK-Lage, 250 Bd). Vorher stand hier ein ungenauer
  // Näherungswert (120 Hz). Wie schon vorher hier nur die FSK/Ton-Ebene
  // nachgebildet — die reale OFDM/QPSK+BPSK-Datenlage ist NICHT
  // implementiert (siehe "Vorschau"-Label und README).
  p07: {
    label: "P07-Stil (Vorschau)",
    hint: "Reales P07 nutzt FSK/BPSK-Intro + QPSK-OFDM-Datenteil (ENIGMA-Katalogwert: 8-Ton-OFDM, QPSK, 62,5 Bd, 125 Hz Ton-Abstand + separate BPSK-Lage 250 Bd). Hier nur die FSK-Ebene mit 125 Hz Ton-Abstand, OFDM/QPSK/BPSK folgen später. Baudrate unten wird beim Wechsel auf diesen Stil automatisch auf 62,5 Bd vorgeschlagen.",
    base: 700, step: 125, sync: 2600,
  },
  // Neuer Stil, unabhängig vom Ziffern-Format oben: für sehr schwache
  // Signale speziell auf CB-/AM-/FM-Funk zugeschnitten (nicht nur "irgendein
  // Schwachsignal-Modus" wie mfsk_weak, sondern mit größerer Sicherheitsmarge
  // beim Ton-Abstand UND einer im Sprachband mittigeren Basisfrequenz, da CB-
  // /AM-Funkgeräte typischerweise unterhalb von ~300 Hz und oberhalb von
  // ~2700–3000 Hz stark filtern/dämpfen). safetyFactor 1.6 statt 1.3 gibt dem
  // Goertzel-Analysefenster mehr Reserve gegen Rauschen/Fading, auf Kosten
  // von etwas mehr Bandbreite pro Symbol — sinnvoll bei niedriger Baudrate
  // (empfohlen: 2 Bd).
  cb_weak: {
    label: "CB/AM-Schwachsignal (weiter Ton-Abstand)",
    hint: "Für sehr schwache CB-/AM-/FM-Signale: Ton-Abstand = 1,6× Baudrate (statt 1,3× bei MFSK-Schwachsignal) für mehr Rauschreserve, Basisfrequenz mittig im typischen CB-/AM-Durchlassbereich (300–2700 Hz). Empfohlen: sehr niedrige Baudrate (2 Bd). Baudrate unten wird beim Wechsel auf diesen Stil automatisch auf 2 Bd vorgeschlagen.",
    base: 600, orthogonal: true, safetyFactor: 1.6, syncEvery: 4,
  },
  // F06a: reales Vorbild ist NICHT Mehrton-MFSK wie die Stile oben, sondern
  // echtes binäres 2-Ton-FSK (Mark/Space), das laut ENIGMA-Katalog eigentlich
  // benannte Binärdateien überträgt, keine 5er-Zifferngruppen. Hier trotzdem
  // ins bestehende Zifferngruppen-Modell eingepasst: jede Dezimalziffer (0–9)
  // wird als 4-Bit-Binärfolge über die zwei FSK-Töne gesendet (siehe
  // `binary`/`pushDigitEvent` in diesem File). Frequenzwerte SELBST
  // GEMESSEN (nicht aus dem Katalog übernommen) per Goertzel/FFT-Analyse
  // einer vom Nutzer bereitgestellten echten Aufnahme
  // (f06a-14643usb-20170315-1550z.wav): klare, durchgehende Zwei-Ton-Struktur
  // bei 1500 Hz und 2500 Hz (Differenz 1000 Hz = der im Katalog genannte
  // "1000 Hz"-Wert, der sich also auf den FSK-Shift bezieht, nicht auf eine
  // Basis-/Mittenfrequenz). Baudrate laut Katalog: 200 Bd (hier: Bit-Rate,
  // siehe Kommentar bei `pushDigitEvent`).
  f06a: {
    label: "F06a-Stil (2-Ton-FSK, Bit-Ebene)",
    hint: "Echtes 2-Ton-FSK statt Mehrton-Raster: jede Ziffer wird als 4 Bit über genau zwei feste Töne gesendet (1500/2500 Hz, aus einer echten Aufnahme vermessen, Shift 1000 Hz laut ENIGMA-Katalog). Baudrate hier = Bit-Rate (Katalogwert 200 Bd), nicht Ziffer-Rate — die tatsächliche Ziffern-Rate ist also nur ein Viertel der eingestellten Baudrate. Reales F06a überträgt binäre Dateien, keine Zifferngruppen — hier ans bestehende Zifferngruppen-Modell angepasst.",
    binary: true, markFreq: 1500, spaceFreq: 2500, bitsPerDigit: 4,
  },
  // F07: reales Vorbild ist ein mehrstufiges Format (FSK-Callup + FSK-Barker-
  // Sync + PSK-Präambel + 5 parallele 16-Ton-MFSK-Kanäle, 20 Hz Abstand,
  // 10 Bd, siehe README-Quellen). Dieser Stil bildet NUR die reine
  // Mehrton-Ebene nach (ein einzelner Kanal des realen 5-Kanal-Systems,
  // dieselbe Logik wie beim bestehenden P07-Stil): 16-Ton-Raster, 20 Hz
  // Abstand, Basis 800 Hz (unterster dokumentierter Ton des realen
  // Frequenzbereichs 800–2380 Hz). PSK/Barker/Mehrkanal-Teile fehlen —
  // daher "Vorschau"-Label wie bei P07.
  f07: {
    label: "F07-Stil (Vorschau, ein MFSK-Kanal)",
    hint: "Reales F07 nutzt FSK-Callup + FSK-Barker-Sync + PSK-Präambel + 5 parallele 16-Ton-MFSK-Kanäle (20 Hz Abstand, 10 Bd, 800–2380 Hz Gesamtbereich). Hier nur EIN Kanal dieser MFSK-Ebene nachgebildet (20 Hz Ton-Abstand, Basis 800 Hz) — Barker/PSK/Mehrkanal-Teile fehlen. Baudrate unten wird beim Wechsel auf diesen Stil automatisch auf 10 Bd vorgeschlagen.",
    base: 800, step: 20, sync: 780,
  },
  mfsk_weak: {
    label: "MFSK-Schwachsignal (orthogonal)",
    hint: "Ton-Abstand wird automatisch = Baudrate gesetzt (orthogonale MFSK-Bedingung — das ist das reale Prinzip hinter Schwachsignal-Digimodes wie MFSK16/Olivia, kein beliebiges Hz-Raster). Niedrige Baudrate (z. B. 4 Bd) bedeutet lange Symboldauer → mehr Energie pro Symbol im schmalen Goertzel-Fenster → im Decoder auch bei starkem Rauschen/leisem Signal noch auswertbar. Reales Vorbild nutzt zusätzlich Vorwärts-Fehlerkorrektur — hier bewusst weggelassen, um die Sequenz für dich lesbar zu halten.",
    base: 350, orthogonal: true, syncEvery: 5,
  },
};

/**
 * Löst einen Style für eine konkrete Baudrate auf. Für normale Styles
 * unverändert; für `orthogonal`-Styles (aktuell: mfsk_weak) wird `step`
 * live aus der Baudrate berechnet.
 *
 * WICHTIG (ehrlich, nicht nur behauptet — per E2E-Test verifiziert):
 * Die lehrbuchmäßige orthogonale Bedingung wäre step = baud EXAKT, aber
 * das gilt nur für ein Analysefenster von genau einer vollen Symboldauer.
 * decodeSymbols() nutzt hier bewusst nur 80% der Symboldauer als Fenster
 * (Rest ist Timing-Jitter-Reserve) — das verschlechtert die effektive
 * Frequenzauflösung auf 1/(0.8·T) = 1.25·baud. Bei step=baud exakt lag
 * das Fenster also UNTER der eigenen "DSP-Grenze"-Formel weiter oben in
 * dieser Datei (durchgefallen im Test: Ziffern-Verwechslungen). step wird
 * deshalb mit demselben 1.3er-Sicherheitsfaktor wie bei den anderen
 * Styles berechnet — das ist die engste Stafflung, die mit dem
 * bestehenden Decoder-Zeitfenster noch zuverlässig funktioniert, nicht
 * die idealisierte (und in der Praxis zu knappe) Lehrbuch-Minimalgrenze.
 */
function resolveStyle(style, baud) {
  if (!style.orthogonal) return style;
  const safetyFactor = style.safetyFactor || 1.3;
  const step = baud * safetyFactor;
  return { ...style, step, sync: style.base - step };
}

// Ruf/Intro-Muster jetzt unabhängig vom Zahlen-Format-Stil wählbar.
// Jedes Muster bleibt aus drei *unterschiedlichen* Tönen bestehen (siehe
// Hinweis oben zur Onset-Erkennung) — das gilt unabhängig davon, mit
// welchem Format-Stil die Zahlengruppen dahinter codiert werden.
const CALL_PATTERNS = {
  // Angelehnt an G04 "Three Note Oddity" (vermutlich ungarischer Nachrichtendienst,
  // Sendungen bis 2005). KORRIGIERT: die drei Töne sind laut Quelle (Buch
  // "Shadows of the State", siehe README-Quellen) direkt aus dem genormten
  // "Special Information Tone" (SIT) des internationalen Telefonnetzes
  // übernommen — keine Fan-Schätzung mehr, sondern ein bekannter, genormter
  // Tonsatz. Vorherige Werte (512/739/899 Hz) stammten nur aus einer
  // Fan-Community-Analyse einer Spiel-Audiodatei (Signalis) und werden hiermit
  // ersetzt.
  threeToneNumbers: {
    label: "3-Ton-Nummernstation / „Three Note Oddity“ (G04-Vorbild)",
    freqs: [950, 1400, 1800], // SIT-Töne (Special Information Tone), steigend
    noteDur: 0.45, // eigene, baudraten-unabhängige Dauer — echtes Vorbild ist ein
                   // langsames Melodie-Motiv, kein an die Datenrate gekoppelter Blip
  },
  xpa2: {
    label: "XPA2-Ruf",
    freqs: [1030, 1075, 1120],
  },
  xpb: {
    label: "XPB-Ruf",
    freqs: [715, 1250, 1785],
  },
  p07: {
    label: "P07-Ruf (Vorschau)",
    freqs: [700, 820, 940],
  },
  // Echte, dokumentierte F07-Callup-Sequenz (Quelle: priyom.org/F07-Protokoll,
  // siehe README): 1800 Hz (500 ms), 1200 Hz (1500 ms), 1800 Hz (500 ms),
  // 1200 Hz (1500 ms), 1000 Hz (100 ms) — ungleiche Tondauern, deshalb über
  // `sequence` statt `freqs`+`noteDur` (siehe buildSequence). Der reale
  // anschließende FSK-Barker (15,625 Bd, 875/2375 Hz) ist NICHT nachgebildet.
  f07: {
    label: "F07-Ruf (reale Callup-Sequenz, ohne Barker)",
    sequence: [
      { freq: 1800, dur: 0.5 },
      { freq: 1200, dur: 1.5 },
      { freq: 1800, dur: 0.5 },
      { freq: 1200, dur: 1.5 },
      { freq: 1000, dur: 0.1 },
    ],
  },
};

function digitFreq(style, d) {
  return style.base + d * style.step;
}

/**
 * Zerlegt eine Dezimalziffer (0–9) in ihre Bit-Darstellung, MSB zuerst.
 * Nur für `binary`-Stile (z. B. F06a) genutzt — dort wird jede Ziffer nicht
 * als EIN Ton aus einem Mehrton-Raster gesendet (wie bei den anderen
 * Stilen), sondern als Folge von Bits über zwei feste FSK-Töne
 * (style.markFreq / style.spaceFreq), echtem 2-Ton-FSK entsprechend.
 */
function digitBits(d, bitsPerDigit) {
  const bits = [];
  for (let i = bitsPerDigit - 1; i >= 0; i--) bits.push((d >> i) & 1);
  return bits;
}

/**
 * Ein einzelnes Symbol-Ereignis erzeugen — entweder ein Mehrton-Symbol
 * (normaler Fall, ein Ton pro Ziffer) oder, bei `style.binary`, eine Folge
 * von Bit-Tönen (mehrere Ereignisse pro Ziffer, echtes 2-Ton-FSK).
 * `symDur` ist bei binären Stilen die BIT-Dauer (1/Bitrate), nicht die
 * Ziffer-Dauer — das entspricht der Katalog-Angabe "Bd" für F06a, die sich
 * dort auf die Bitrate bezieht, nicht auf eine Ziffernrate.
 */
function pushDigitEvent(push, style, digit, symDur, kind) {
  if (style.binary) {
    digitBits(digit, style.bitsPerDigit || 4).forEach((b) => {
      push(b ? style.markFreq : style.spaceFreq, symDur, kind);
    });
  } else {
    push(digitFreq(style, digit), symDur, kind);
  }
}

/**
 * Grenzfall-Check: reicht das Analysefenster (1/baud) aus, um Töne mit
 * `step` Hz Abstand sauber zu trennen? Frequenzauflösung ist ungefähr
 * 1/Fensterdauer — bei zu hoher Baudrate relativ zum Ton-Abstand können
 * benachbarte Ziffern-Töne nicht mehr zuverlässig unterschieden werden.
 * Das ist der Grund, warum reales XPA2 nur 7,5 Bd nutzt (15 Hz Abstand).
 * Gibt null zurück (kein Problem) oder einen Warntext.
 */
function dspLimitWarning(style, baud) {
  const symDur = 1 / baud;
  const resolution = 1 / symDur; // Hz
  const safetyFactor = 1.3; // etwas Marge, da Goertzel keine ideale Rechteck-Fensterung nutzt
  if (style.step < resolution * safetyFactor) {
    const maxBaud = style.step / safetyFactor;
    return `⚠ DSP-Grenze: Bei ${baud} Bd beträgt die Frequenzauflösung ≈${resolution.toFixed(1)} Hz, ` +
      `aber die Ziffern-Töne liegen nur ${style.step} Hz auseinander. Das ist eine reale, physikalische ` +
      `Grenze (Frequenzauflösung ∝ 1/Fensterdauer) — kein Software-Bug. Empfohlen: ≤${maxBaud.toFixed(1)} Bd für diesen Stil.`;
  }
  return null;
}

/**
 * Build the full event timeline for a transmission.
 * Returns a list of {freq, dur, kind}. freq === null means silence.
 * kind: "ruf" | "pause" | "id" | "count" | "data" | "sync" | "outro"
 *
 * callPattern: einer der CALL_PATTERNS-Einträge (Ruf/Intro), unabhängig vom
 * Zahlen-Format-Stil wählbar. callRepeats: wie oft der Ruf wiederholt wird
 * (="Länge" des Rufs), Standard 3.
 */
function buildSequence(style, baud, id3, msgDigits, callPattern, callRepeats) {
  callPattern = callPattern || CALL_PATTERNS.threeToneNumbers;
  callRepeats = callRepeats || 3;
  const symDur = 1 / baud;
  const events = [];
  const push = (freq, dur, kind) => events.push({ freq, dur, kind });

  // 1. Callup: three-tone pattern, repeated callRepeats times.
  // Manche Rufmuster (z. B. "Three Note Oddity") haben eine eigene, von der
  // Baudrate unabhängige Notendauer (noteDur) — reales Vorbild ist ein
  // langsames Melodie-Motiv, keine an die Datenrate gekoppelte Ton-Folge.
  // Manche Rufmuster (z. B. F07) haben stattdessen eine feste, ungleichmäßige
  // Ton-Folge mit je eigener Dauer (callPattern.sequence) — z. B. eine echte
  // FSK-Callup-Sequenz mit dokumentierten Einzeldauern statt gleich langer Noten.
  if (callPattern.sequence) {
    for (let r = 0; r < callRepeats; r++) {
      callPattern.sequence.forEach((ev) => push(ev.freq, ev.dur, "ruf"));
      push(null, symDur * 0.8, "pause");
    }
  } else {
    const callNoteDur = callPattern.noteDur || symDur * 1.1;
    const callPauseDur = callPattern.noteDur ? callNoteDur * 0.35 : symDur * 0.4;
    for (let r = 0; r < callRepeats; r++) {
      callPattern.freqs.forEach((f) => push(f, callNoteDur, "ruf"));
      push(null, callPauseDur, "pause");
    }
  }
  push(null, symDur * 2, "pause");

  // 2. Preamble: station ID (3 digits)
  id3.split("").forEach((ch) => pushDigitEvent(push, style, +ch, symDur, "id"));
  push(null, symDur * 1, "pause");

  // 3. Group count (2-digit, zero-padded)
  const groupCount = Math.ceil(msgDigits.length / 5);
  String(groupCount)
    .padStart(2, "0")
    .split("")
    .forEach((ch) => pushDigitEvent(push, style, +ch, symDur, "count"));
  push(null, symDur * 2, "pause");

  // 4. Data: message digits, sync tone every N (style-dependent)
  let count = 0;
  msgDigits.split("").forEach((ch) => {
    if (style.syncEvery && count > 0 && count % style.syncEvery === 0) {
      push(style.sync, symDur, "sync");
    }
    pushDigitEvent(push, style, +ch, symDur, "data");
    count++;
  });
  push(null, symDur * 1.5, "pause");

  // 5. Outro: triple-zero (classic "null message / end" marker)
  for (let i = 0; i < 3; i++) pushDigitEvent(push, style, 0, symDur, "outro");

  return events;
}

/** Goertzel single-bin power estimate for `targetFreq` over `samples`. */
function goertzel(samples, sampleRate, targetFreq) {
  const N = samples.length;
  if (N === 0) return 0;
  const k = Math.round((N * targetFreq) / sampleRate);
  const w = (2 * Math.PI * k) / N;
  const cosine = Math.cos(w),
    sine = Math.sin(w),
    coeff = 2 * cosine;
  let q0 = 0,
    q1 = 0,
    q2 = 0;
  for (let i = 0; i < N; i++) {
    q0 = coeff * q1 - q2 + samples[i];
    q2 = q1;
    q1 = q0;
  }
  const real = q1 - q2 * cosine;
  const imag = q2 * sine;
  return real * real + imag * imag;
}

/* ---------------------------------------------------------------------
 * OTP (One-Time-Pad) — optionale Text-Verschlüsselung.
 *
 * Klassische Zahlensender verschicken reine Zifferngruppen; der Klartext
 * entsteht beim Empfänger erst durch Abziehen eines geheimen, nur einmal
 * verwendeten Zahlen-Schlüssels (Pad) von den empfangenen Ziffern
 * (mod-10-Subtraktion). Hier optional zuschaltbar:
 *
 *  - AN: Text wird über ein festes Alphabet in 2-Ziffern-Codes übersetzt,
 *        dann ziffernweise mod 10 mit einem selbst eingegebenen (oder
 *        zufällig generierten) Pad verknüpft. Nur das Ergebnis (die
 *        Geheim-Ziffern) geht in den Ton — das Pad selbst wird NICHT
 *        mitgesendet und muss dem Empfänger separat/sicher vorliegen.
 *  - AUS: Es werden direkt die eingegebenen Ziffern gesendet, keine
 *         Text->Zahl-Umwandlung, kein Pad nötig.
 *
 * WICHTIG (Ehrlichkeit statt Krypto-Theater): ein one-time pad ist nur
 * dann informationstheoretisch sicher, wenn das Pad (a) echt zufällig,
 * (b) mindestens so lang wie die Nachricht und (c) wirklich nur EIN
 * einziges Mal verwendet wird. Wird hier ein zu kurzes Pad eingegeben,
 * wird es zyklisch wiederholt, damit das Tool nutzbar bleibt — das ist
 * dann aber kein sicheres OTP mehr, nur noch eine einfache Verschleierung
 * (wie eine Vigenère-Chiffre). Die UI weist darauf hin.
 * --------------------------------------------------------------------- */

// 39 Zeichen -> 2-stellige Codes 00..38. Reihenfolge ist willkürlich, muss
// nur bei Encoder und Decoder gleich sein (ist hier fix im Code hinterlegt).
const OTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789.,";

function textToDigits(text) {
  const upper = text.toUpperCase();
  let out = "";
  for (const ch of upper) {
    const idx = OTP_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // unbekannte Zeichen werden stillschweigend übersprungen
    out += String(idx).padStart(2, "0");
  }
  return out;
}

function digitsToText(digits) {
  let out = "";
  for (let i = 0; i + 1 < digits.length; i += 2) {
    const idx = parseInt(digits.substr(i, 2), 10);
    out += OTP_ALPHABET[idx] ?? "?";
  }
  return out;
}

/** Erzeugt ein kryptographisch zufälliges Ziffern-Pad der gewünschten Länge. */
function generatePad(length) {
  const bytes = new Uint8Array(length);
  (window.crypto || {}).getRandomValues?.(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += String(bytes[i] % 10);
  return out;
}

/** padDigits wird zyklisch wiederholt, falls kürzer als plainDigits (siehe Warnung oben). */
function otpEncode(plainDigits, padDigits) {
  if (!padDigits.length) throw new Error("Pad darf nicht leer sein.");
  let out = "";
  for (let i = 0; i < plainDigits.length; i++) {
    const p = +plainDigits[i];
    const k = +padDigits[i % padDigits.length];
    out += String((p + k) % 10);
  }
  return out;
}

function otpDecode(cipherDigits, padDigits) {
  if (!padDigits.length) throw new Error("Pad darf nicht leer sein.");
  let out = "";
  for (let i = 0; i < cipherDigits.length; i++) {
    const c = +cipherDigits[i];
    const k = +padDigits[i % padDigits.length];
    out += String((c - k + 10) % 10);
  }
  return out;
}

if (typeof module !== "undefined") {
  module.exports = {
    SAMPLE_RATE, STYLES, CALL_PATTERNS, digitFreq, digitBits, pushDigitEvent, resolveStyle, dspLimitWarning, buildSequence, goertzel,
    OTP_ALPHABET, textToDigits, digitsToText, generatePad, otpEncode, otpDecode,
  };
}
