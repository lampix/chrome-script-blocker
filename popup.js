// popup.js

const rulesDiv = document.getElementById("rules");
const currentDiv = document.getElementById("current");
const newDomainEl = document.getElementById("newDomain");
const newUrlEl = document.getElementById("newUrl");

let currentHost = "";

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try {
      currentHost = new URL(tab.url).hostname;
      currentDiv.textContent = "Current: " + currentHost;
    } catch {
      currentDiv.textContent = "Current: —";
    }
  }
  await renderRules();
}

function send(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

async function renderRules() {
  const res = await send({ type: "getRules" });
  const rules = res?.rules || [];

  rulesDiv.innerHTML = "";

  // Nur Regeln anzeigen, die zur aktuellen Domain passen (oder domain-los sind)
  const relevant = rules.filter(r =>
    !r.domain || !currentHost || currentHost.endsWith(r.domain)
  );

  if (relevant.length === 0) {
    rulesDiv.innerHTML = '<div class="empty">No rules for this domain.</div>';
    return;
  }

  relevant.forEach((r) => {
    const realIndex = rules.indexOf(r);
    const row = document.createElement("div");
    row.className = "rule";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = r.enabled !== false;
    cb.title = "Rule enabled";
    cb.addEventListener("change", async () => {
      rules[realIndex].enabled = cb.checked;
      await send({ type: "setRules", rules });
    });

    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML =
      '<div class="domain">' + (r.domain || "(all domains)") + '</div>' +
      '<div class="url">' + r.urlFilter + '</div>';

    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "Remove";
    del.addEventListener("click", async () => {
      rules.splice(realIndex, 1);
      await send({ type: "setRules", rules });
      renderRules();
    });

    row.appendChild(cb);
    row.appendChild(info);
    row.appendChild(del);
    rulesDiv.appendChild(row);
  });
}

document.getElementById("add").addEventListener("click", async () => {
  const domain = newDomainEl.value.trim();
  const urlFilter = newUrlEl.value.trim();
  if (!urlFilter) {
    newUrlEl.focus();
    return;
  }
  const res = await send({ type: "getRules" });
  const rules = res?.rules || [];
  rules.push({ domain, urlFilter, enabled: true });
  await send({ type: "setRules", rules });
  newDomainEl.value = "";
  newUrlEl.value = "";
  renderRules();
});

document.getElementById("useCurrent").addEventListener("click", (e) => {
  e.preventDefault();
  if (currentHost) {
    // eTLD+1 grob herleiten (für die meisten Fälle ausreichend)
    const parts = currentHost.split(".");
    const base = parts.length >= 2 ? parts.slice(-2).join(".") : currentHost;
    newDomainEl.value = base;
    newUrlEl.focus();
  }
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();
