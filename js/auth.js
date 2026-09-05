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
 * To set your own PIN:
 *   1. Open a browser console and run (replace 1234 with your PIN):
 *        crypto.subtle.digest('SHA-256', new TextEncoder().encode('1234'))
 *          .then(b => console.log(Array.from(new Uint8Array(b))
 *            .map(x => x.toString(16).padStart(2,'0')).join('')))
 *   2. Copy the resulting hex string into PASSWORD_HASH below.
 *   3. Set PIN_LENGTH below to match the number of digits in your PIN.
 */

const PASSWORD_HASH =
  "a2b6103a90e7178ea29afa2a5e4d0fd98a71e75ac5c0a98ca166327a8814a6fb";
const PIN_LENGTH = 4; // muss zur Ziffernanzahl deiner PIN passen

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

  const dots = Array.from({ length: PIN_LENGTH }, () => `<span></span>`).join("");
  const digitBtn = (d) => `<button type="button" data-digit="${d}">${d}</button>`;

  gate.innerHTML = `
    <div class="box">
      <h2>ZUGANG — PIN</h2>
      <div class="pindots" id="pinDots">${dots}</div>
      <div class="padgrid">
        ${[1,2,3,4,5,6,7,8,9].map(digitBtn).join("")}
        <button type="button" id="pinClear" class="wide">L&Ouml;SCHEN</button>
        ${digitBtn(0)}
        <button type="button" id="pinBack" class="wide">&larr;</button>
      </div>
      <div class="err" id="gateErr"></div>
    </div>`;
  document.body.appendChild(gate);

  let entered = "";
  const dotsEl = gate.querySelector("#pinDots");

  function renderDots() {
    const spans = dotsEl.querySelectorAll("span");
    spans.forEach((s, i) => s.classList.toggle("filled", i < entered.length));
  }

  async function trySubmit() {
    const hash = await sha256Hex(entered);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem("ns_auth_ok", "1");
      gate.remove();
    } else {
      document.getElementById("gateErr").textContent = "Falsche PIN.";
      dotsEl.classList.add("shake");
      setTimeout(() => dotsEl.classList.remove("shake"), 300);
      entered = "";
      renderDots();
    }
  }

  gate.querySelectorAll("[data-digit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (entered.length >= PIN_LENGTH) return;
      entered += btn.dataset.digit;
      document.getElementById("gateErr").textContent = "";
      renderDots();
      if (entered.length === PIN_LENGTH) trySubmit();
    });
  });
  gate.querySelector("#pinBack").addEventListener("click", () => {
    entered = entered.slice(0, -1);
    document.getElementById("gateErr").textContent = "";
    renderDots();
  });
  gate.querySelector("#pinClear").addEventListener("click", () => {
    entered = "";
    document.getElementById("gateErr").textContent = "";
    renderDots();
  });

  // Physische Zahlentastatur ebenfalls erlauben (Komfort am Desktop)
  document.addEventListener("keydown", function keyHandler(e) {
    if (!document.body.contains(gate)) {
      document.removeEventListener("keydown", keyHandler);
      return;
    }
    if (/^[0-9]$/.test(e.key) && entered.length < PIN_LENGTH) {
      entered += e.key;
      renderDots();
      if (entered.length === PIN_LENGTH) trySubmit();
    } else if (e.key === "Backspace") {
      entered = entered.slice(0, -1);
      renderDots();
    }
  });
}

function requireAuth() {
  if (!isUnlocked()) renderGate();
}

document.addEventListener("DOMContentLoaded", requireAuth);
