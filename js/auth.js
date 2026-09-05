/*
 * auth.js — lightweight client-side password gate.
 *
 * IMPORTANT / HONEST LIMITATION:
 * This is a static site with no server. There is no way to truly
 * "protect" a static page with client-side JS — anyone who opens
 * dev tools can read the page source and, in principle, brute-force
 * the stored hash offline. This gate only stops casual visitors
 * (e.g. someone stumbling onto your local network share or a
 * public GitHub Pages URL) from immediately seeing the content —
 * it is NOT a substitute for real auth. If you need real access
 * control, put this behind a server with proper login, or keep the
 * repo private.
 *
 * To set your own password:
 *   1. Open a browser console and run:
 *        crypto.subtle.digest('SHA-256', new TextEncoder().encode('DEIN-PASSWORT'))
 *          .then(b => console.log(Array.from(new Uint8Array(b))
 *            .map(x => x.toString(16).padStart(2,'0')).join('')))
 *   2. Copy the resulting hex string into PASSWORD_HASH below.
 *
 * Default password is "changeme" — change it before publishing.
 */

const PASSWORD_HASH =
  "0900fd45964d090ac695b7dee9d3e232ce548ce1494ecb182ac9c2b3c9350dbb"; // placeholder, see below
// NOTE: replace with your own hash generated as described above.
// The placeholder above is intentionally NOT a valid hash of "changeme"
// so you are forced to generate your own before the gate will open.

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isUnlocked() {
  return sessionStorage.getItem("ns_auth_ok") === "1";
}

function renderGate() {
  const gate = document.createElement("div");
  gate.id = "gate";
  gate.innerHTML = `
    <div class="box">
      <h2>ZUGANG</h2>
      <input type="password" id="gatePw" placeholder="Passwort" autocomplete="current-password">
      <div class="btnrow"><button id="gateBtn">Entsperren</button></div>
      <div class="err" id="gateErr"></div>
    </div>`;
  document.body.appendChild(gate);

  const submit = async () => {
    const pw = document.getElementById("gatePw").value;
    const hash = await sha256Hex(pw);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem("ns_auth_ok", "1");
      gate.remove();
    } else {
      document.getElementById("gateErr").textContent = "Falsches Passwort.";
    }
  };
  document.getElementById("gateBtn").addEventListener("click", submit);
  document.getElementById("gatePw").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
}

function requireAuth() {
  if (!isUnlocked()) renderGate();
}

document.addEventListener("DOMContentLoaded", requireAuth);
