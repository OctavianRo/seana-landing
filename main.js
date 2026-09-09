"use strict";
document.documentElement.classList.add("js");
const menu = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
function closeMenu() { menu.setAttribute("aria-expanded", "false"); navigation.classList.remove("is-open"); }
menu.addEventListener("click", () => { const open = menu.getAttribute("aria-expanded") !== "true"; menu.setAttribute("aria-expanded", String(open)); navigation.classList.toggle("is-open", open); });
navigation.addEventListener("click", event => { if (event.target.closest("a")) closeMenu(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") { closeMenu(); menu.focus(); } });
const seats = [...document.querySelectorAll(".seat")];
const invite = document.querySelector(".invite-demo");
const reset = document.querySelector(".reset-demo");
const count = document.querySelector("#session-count");
let guests = 1;
function renderSession() {
  seats.forEach((seat, index) => { seat.classList.toggle("occupied", index < guests); seat.textContent = index === 0 ? "You" : index < guests ? "Friend" : "＋"; });
  document.querySelector(".bench").setAttribute("aria-label", `Illustrative session: ${guests} of six places filled`);
  count.textContent = `${guests} of 6 places filled. ${guests === 6 ? "A full bench. A shared ritual." : guests === 1 ? "It starts with you." : "Good company is catching on."}`;
  invite.disabled = guests === 6;
  invite.textContent = guests === 6 ? "That’s a full house ✓" : "Invite a friend ＋";
  reset.hidden = guests === 1;
}
invite.addEventListener("click", () => { if (guests < 6) guests++; renderSession(); if (guests === 6) reset.focus(); });
reset.addEventListener("click", () => { guests = 1; renderSession(); invite.focus(); });
const banner = document.querySelector(".cookie-banner");
const preferences = document.querySelector(".cookie-settings");
preferences.addEventListener("click", () => { banner.hidden = !banner.hidden; if (!banner.hidden) banner.querySelector("button").focus(); });
banner.querySelectorAll("[data-consent]").forEach(button => button.addEventListener("click", () => {
  try { document.cookie = `seana_cookie_consent=${button.dataset.consent}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch { /* Preferences remain usable when browser storage is unavailable. */ }
  banner.hidden = true;
  preferences.focus();
}));
