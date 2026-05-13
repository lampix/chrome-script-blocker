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

// Setzt Badge-Text und Icon abhängig davon, wie viele Regeln für den aktiven Tab greifen.
async function updateBadgeForTab(tabId, url) {
  const rules = await loadRules();
  let host = "";
  try { host = new URL(url).hostname; } catch { /* keine URL */ }

  const active = rules.filter(r =>
    r.enabled !== false &&
    r.urlFilter &&
    (!r.domain || !host || host.endsWith(r.domain))
  );

  const count = active.length;
  const icons = count > 0
    ? { 16: "icons/icon16.png", 48: "icons/icon48.png", 128: "icons/icon128.png" }
    : { 16: "icons/icon16_gray.png", 48: "icons/icon48_gray.png", 128: "icons/icon128_gray.png" };

  await chrome.action.setIcon({ tabId, path: icons });
  await chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#4ea1ff" });
}

async function updateBadgeAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url) {
      try { await updateBadgeForTab(tab.id, tab.url); } catch { /* ignore inactive tabs */ }
    }
  }
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

chrome.runtime.onInstalled.addListener(async () => {
  await syncDnrRules();
  await updateBadgeAllTabs();
});
chrome.runtime.onStartup.addListener(async () => {
  await syncDnrRules();
  await updateBadgeAllTabs();
});

// Wenn die Regeln im Storage geändert werden, Badge auf allen Tabs aktualisieren.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    syncDnrRules().then(updateBadgeAllTabs);
  }
});

// Badge aktualisieren wenn der User den Tab wechselt oder eine Seite lädt.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) await updateBadgeForTab(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    await updateBadgeForTab(tabId, tab.url);
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
