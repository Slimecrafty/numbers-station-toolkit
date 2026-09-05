/*
 * engine.js — shared tone-format definitions and DSP helpers.
 * Used by both encode.html and decode.html so the two sides always
 * agree on frequency mapping and timing.
 *
 * Formats are loosely modeled on real ENIGMA-catalog "Russian 7" family
 * numbers stations (E07 / V07 / M12 / XPA2 / XPB / P07) — see README.md
 * for sources. This is a hobbyist re-creation for CB/shortwave
 * experimentation, not a reproduction of any real station's traffic.
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
  xpa2: {
    label: "XPA2-Stil",
    hint: "Ziffern-Töne eng gestaffelt (15 Hz Abstand, wie reales XPA2). Sync-Ton 15 Hz unter dem Nullpunkt.",
    base: 1000, step: 15, sync: 985,
    syncEvery: 5,
  },
  xpb: {
    label: "XPB-Stil",
    hint: "Weites Ton-Raster, 175 Hz Abstand (540–2115 Hz Bereich), angelehnt an reale XPB-Beschreibung.",
    base: 540, step: 175, sync: 2290,
  },
  p07: {
    label: "P07-Stil (Vorschau)",
    hint: "Reales P07 nutzt FSK/BPSK-Intro + QPSK-OFDM-Datenteil. Hier nur die FSK-Ebene, OFDM folgt später.",
    base: 700, step: 120, sync: 2600,
  },
};

// Ruf/Intro-Muster jetzt unabhängig vom Zahlen-Format-Stil wählbar.
// Jedes Muster bleibt aus drei *unterschiedlichen* Tönen bestehen (siehe
// Hinweis oben zur Onset-Erkennung) — das gilt unabhängig davon, mit
// welchem Format-Stil die Zahlengruppen dahinter codiert werden.
const CALL_PATTERNS = {
  threeToneNumbers: {
    label: "3-Ton-Nummernstation (klassisch)",
    freqs: [850, 1150, 1450],
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
};

function digitFreq(style, d) {
  return style.base + d * style.step;
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

  // 1. Callup: three-tone pattern, repeated callRepeats times
  for (let r = 0; r < callRepeats; r++) {
    callPattern.freqs.forEach((f) => push(f, symDur * 1.1, "ruf"));
    push(null, symDur * 0.4, "pause");
  }
  push(null, symDur * 2, "pause");

  // 2. Preamble: station ID (3 digits)
  id3.split("").forEach((ch) => push(digitFreq(style, +ch), symDur, "id"));
  push(null, symDur * 1, "pause");

  // 3. Group count (2-digit, zero-padded)
  const groupCount = Math.ceil(msgDigits.length / 5);
  String(groupCount)
    .padStart(2, "0")
    .split("")
    .forEach((ch) => push(digitFreq(style, +ch), symDur, "count"));
  push(null, symDur * 2, "pause");

  // 4. Data: message digits, sync tone every N (style-dependent)
  let count = 0;
  msgDigits.split("").forEach((ch) => {
    if (style.syncEvery && count > 0 && count % style.syncEvery === 0) {
      push(style.sync, symDur, "sync");
    }
    push(digitFreq(style, +ch), symDur, "data");
    count++;
  });
  push(null, symDur * 1.5, "pause");

  // 5. Outro: triple-zero (classic "null message / end" marker)
  for (let i = 0; i < 3; i++) push(digitFreq(style, 0), symDur, "outro");

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
    SAMPLE_RATE, STYLES, CALL_PATTERNS, digitFreq, dspLimitWarning, buildSequence, goertzel,
    OTP_ALPHABET, textToDigits, digitsToText, generatePad, otpEncode, otpDecode,
  };
}
