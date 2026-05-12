// background.js — Service Worker
// Liest die Regeln aus chrome.storage.local und synchronisiert sie mit
// chrome.declarativeNetRequest. Jede Regel = { id, enabled, domain, urlFilter }
//
// domain   : Hostname/Pattern der Seite auf der geblockt werden soll (z.B. "derstandard.at")
//            Es werden auch Subdomains automatisch einbezogen (initiatorDomains-Match).
// urlFilter: Pattern für die zu blockierende Skript-URL, z.B.
//            "||at.staticfiles.at/js/piano-*.js"  (uBlock-ähnliche Syntax wird in DNR-urlFilter konvertiert)
//            oder einfach "at.staticfiles.at/js/piano-"

const STORAGE_KEY = "rules";

// --- Rule sync ---------------------------------------------------------------

async function loadRules() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function saveRules(rules) {
  await chrome.storage.local.set({ [STORAGE_KEY]: rules });
}

// Wandelt eine gespeicherte Regel in eine declarativeNetRequest-Regel um.
function toDnrRule(rule, index) {
  // urlFilter: führendes "||" wird von DNR direkt unterstützt (domain anchor).
  // Wir lassen den User die Eingabe so machen wie sie ist und übergeben sie 1:1.
  const condition = {
    urlFilter: rule.urlFilter,
    resourceTypes: ["script"]
  };

  if (rule.domain && rule.domain.trim() !== "" && rule.domain !== "*") {
    // initiatorDomains matcht die Top-Level-Seite (eTLD+1 + Subdomains).
    condition.initiatorDomains = [rule.domain.trim()];
  }

  return {
    // IDs müssen positive Integer sein und eindeutig.
    id: 1000 + index,
    priority: 1,
    action: { type: "block" },
    condition
  };
}

async function syncDnrRules() {
  const stored = await loadRules();
  const enabled = stored
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.enabled !== false && r.urlFilter && r.urlFilter.trim() !== "");

  const newRules = enabled.map(({ r, i }) => toDnrRule(r, i));

  // Alle alten dynamischen Regeln entfernen (wir verwalten sie komplett selbst).
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: newRules
  });
}

// --- Lifecycle ---------------------------------------------------------------

chrome.runtime.onInstalled.addListener(syncDnrRules);
chrome.runtime.onStartup.addListener(syncDnrRules);

// Wenn die Regeln im Storage geändert werden (durch Options-Page oder Popup),
// sofort neu synchronisieren.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    syncDnrRules();
  }
});

// --- Messaging API für Popup/Options ----------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "getRules": {
          sendResponse({ ok: true, rules: await loadRules() });
          break;
        }
        case "setRules": {
          await saveRules(msg.rules);
          await syncDnrRules();
          sendResponse({ ok: true });
          break;
        }
        case "getMatchedRules": {
          // Welche Regeln haben in den letzten 10 Minuten (Browser-Default) gegriffen?
          const info = await chrome.declarativeNetRequest.getMatchedRules({});
          sendResponse({ ok: true, matched: info.rulesMatchedInfo });
          break;
        }
        default:
          sendResponse({ ok: false, error: "unknown message type" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // async response
});
