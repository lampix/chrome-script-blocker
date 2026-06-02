// background.js — Service Worker
// Liest die Regeln aus chrome.storage.local und synchronisiert sie mit
// chrome.declarativeNetRequest. Jede Regel = { id, enabled, domain, urlFilter, pathContains? }
//
// domain      : Hostname/Pattern der Seite auf der geblockt werden soll (z.B. "derstandard.at")
//               Es werden auch Subdomains automatisch einbezogen (initiatorDomains-Match).
// urlFilter   : Pattern für die zu blockierende Skript-URL, z.B.
//               "||at.staticfiles.at/js/piano-*.js"  (uBlock-ähnliche Syntax wird in DNR-urlFilter konvertiert)
//               oder einfach "at.staticfiles.at/js/piano-"
// pathContains: OPTIONAL. Wenn gesetzt, greift die Regel nur, wenn der Pfad der
//               Seiten-URL diesen Substring enthält (z.B. "/story/"). DNR kann den
//               Initiator nur per Domain matchen, nicht per Pfad — deshalb werden
//               solche Regeln nicht als dynamische Regel angelegt, sondern pro Tab
//               über webNavigation + Session-Rules geschaltet.

const STORAGE_KEY = "rules";

// ID-Bereiche getrennt halten: dynamische (statische) Regeln 1000+,
// Session-Regeln (pfad-bedingt, pro Tab) in einem eigenen, hohen Bereich.
const DYNAMIC_ID_BASE = 1000;
const SESSION_ID_BASE = 1_000_000;

// --- Rule sync ---------------------------------------------------------------

async function loadRules() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function saveRules(rules) {
  await chrome.storage.local.set({ [STORAGE_KEY]: rules });
}

function isEnabled(rule) {
  return rule.enabled !== false && rule.urlFilter && rule.urlFilter.trim() !== "";
}

// Eine Regel ist "pfad-bedingt", wenn pathContains gesetzt und nicht leer ist.
function isPathConditional(rule) {
  return typeof rule.pathContains === "string" && rule.pathContains.trim() !== "";
}

// Baut das condition-Objekt einer DNR-Regel (gemeinsam für dynamisch & session).
function buildCondition(rule) {
  const condition = {
    urlFilter: rule.urlFilter,
    resourceTypes: ["script"]
  };
  if (rule.domain && rule.domain.trim() !== "" && rule.domain !== "*") {
    // initiatorDomains matcht die Top-Level-Seite (eTLD+1 + Subdomains).
    condition.initiatorDomains = [rule.domain.trim()];
  }
  return condition;
}

// Wandelt eine gespeicherte (statische) Regel in eine dynamische DNR-Regel um.
function toDnrRule(rule, index) {
  return {
    id: DYNAMIC_ID_BASE + index,
    priority: 1,
    action: { type: "block" },
    condition: buildCondition(rule)
  };
}

// --- Block-Regeln: dynamische DNR-Rules (immer aktiv) ------------------------
//
// WICHTIG zum Timing: AUCH pfad-bedingte Regeln werden hier als ganz normale
// Block-Regel angelegt, also default aktiv auf der ganzen Domain. Der Pfad-
// Filter wird NICHT durch nachträgliches Einschalten umgesetzt (das kommt zu
// spät — das Skript ist dann schon geladen), sondern umgekehrt: auf Seiten, wo
// der Pfad NICHT passt, hebt eine tab-spezifische `allow`-Session-Regel den
// Block wieder auf (siehe applyPathRulesForTab). Im kritischen Fall (Pfad passt
// → blocken) muss damit zur Laufzeit gar nichts geschaltet werden.

async function syncDnrRules() {
  const stored = await loadRules();
  // Alle aktiven Regeln (mit und ohne pathContains) werden als Block-Regel
  // angelegt. Index bleibt der Original-Array-Index → stabile/eindeutige IDs.
  const newRules = stored
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => isEnabled(r))
    .map(({ r, i }) => toDnrRule(r, i));

  // Alle alten dynamischen Regeln entfernen (wir verwalten sie komplett selbst).
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: newRules
  });
}

// --- Pfad-bedingte Regeln: Session-Rules pro Tab -----------------------------

// Eindeutige Session-Rule-ID aus Tab-ID und Regel-Index.
// tabId kann groß werden, Regel-Index ist klein → Index in die unteren Stellen.
function sessionRuleId(tabId, ruleIndex) {
  return SESSION_ID_BASE + tabId * 100 + ruleIndex;
}

// Entfernt alle Session-Regeln, die zu einem bestimmten Tab gehören.
async function clearSessionRulesForTab(tabId) {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const removeIds = existing
    .filter(r => Array.isArray(r.condition?.tabIds) && r.condition.tabIds.includes(tabId))
    .map(r => r.id);
  if (removeIds.length > 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: removeIds });
  }
  return removeIds;
}

// Liefert die pfad-bedingten Regeln, deren Block auf dieser Seiten-URL
// AUFGEHOBEN werden muss: Domain passt (sonst greift die Block-Regel ohnehin
// nicht), aber der Pfad enthält den geforderten Substring NICHT.
function pathRulesToAllow(rules, url) {
  let host = "", path = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    return [];
  }
  return rules
    .map((r, i) => ({ r, i }))
    .filter(({ r }) =>
      isEnabled(r) &&
      isPathConditional(r) &&
      (!r.domain || host.endsWith(r.domain.trim())) &&
      !path.includes(r.pathContains.trim())
    );
}

// Setzt pro Tab `allow`-Session-Regeln, die den (statischen) Block für
// pfad-bedingte Regeln dort wieder aufheben, wo der Pfad NICHT passt.
// Eine `allow`-Regel mit gleicher Priorität schlägt die `block`-Regel.
//
// Wird aus webNavigation.onBeforeNavigate aufgerufen. Das Timing ist hier
// unkritisch: Wenn die allow-Regel ausnahmsweise zu spät kommt, wird das
// Skript einmal auf einer Nicht-Treffer-Seite geblockt — also genau dort, wo
// es nicht stört. Im Treffer-Fall (blocken erwünscht) wird nichts geschaltet.
async function applyPathRulesForTab(tabId, url) {
  // Erst die alten Allow-Ausnahmen dieses Tabs entfernen ...
  const removeIds = await clearSessionRulesForTab(tabId);

  const rules = await loadRules();
  const allowList = pathRulesToAllow(rules, url);

  const addRules = allowList.map(({ r, i }) => ({
    id: sessionRuleId(tabId, i),
    priority: 1,
    action: { type: "allow" },
    condition: { ...buildCondition(r), tabIds: [tabId] }
  }));

  // ... und in einem Schritt die neuen setzen (ggf. leeres addRules = nur aufräumen).
  if (addRules.length > 0 || removeIds.length > 0) {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: removeIds,
      addRules
    });
  }
  return allowList.length;
}

// --- Badge / Icon (3 Stufen) -------------------------------------------------
// Stufe 1: keine Regel passt zur Domain         → grau
// Stufe 2: Regel passt zur Domain, aber greift   → farbig, ohne Zahl
//          auf diesem Pfad nicht (pfad-bedingt)
// Stufe 3: Regel greift hier wirklich            → farbig, mit Zahl
async function updateBadgeForTab(tabId, url) {
  const rules = await loadRules();
  let host = "", path = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch { /* keine gültige URL — als "keine Regel" behandeln */ }

  const domainMatch = (r) => !r.domain || !host || host.endsWith(r.domain.trim());

  // Regeln, die zur Domain gehören (unabhängig vom Pfad).
  const onDomain = rules.filter(r => isEnabled(r) && domainMatch(r));

  // Regeln, die hier (auf diesem Pfad) tatsächlich aktiv blocken:
  //  - statische Regeln: immer aktiv, sobald Domain passt
  //  - pfad-bedingte Regeln: nur wenn pathContains im Pfad vorkommt
  const active = onDomain.filter(r =>
    !isPathConditional(r) || (path && path.includes(r.pathContains.trim()))
  );

  let stage;
  if (onDomain.length === 0) stage = 1;
  else if (active.length === 0) stage = 2;
  else stage = 3;

  const colorIcons = { 16: "icons/icon16.png", 48: "icons/icon48.png", 128: "icons/icon128.png" };
  const grayIcons = { 16: "icons/icon16_gray.png", 48: "icons/icon48_gray.png", 128: "icons/icon128_gray.png" };

  await chrome.action.setIcon({ tabId, path: stage === 1 ? grayIcons : colorIcons });
  await chrome.action.setBadgeText({ tabId, text: stage === 3 ? String(active.length) : "" });
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

// --- Lifecycle ---------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  await syncDnrRules();
  await updateBadgeAllTabs();
});
chrome.runtime.onStartup.addListener(async () => {
  await syncDnrRules();
  await updateBadgeAllTabs();
});

// Wenn die Regeln im Storage geändert werden, alles neu synchronisieren.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    syncDnrRules().then(updateBadgeAllTabs);
  }
});

// Badge aktualisieren wenn der User den Tab wechselt.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) await updateBadgeForTab(tabId, tab.url);
});

// Badge aktualisieren wenn eine Seite fertig geladen ist.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    await updateBadgeForTab(tabId, tab.url);
  }
});

// Pfad-bedingte Regeln: VOR dem Laden der Sub-Resources schalten.
// onBeforeNavigate feuert mit der vollen Ziel-URL (inkl. Pfad), bevor das
// HTML geparst und die Skripte angefragt werden. Nur Top-Level-Frame (frameId 0).
chrome.webNavigation.onBeforeNavigate.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0) return;
  try {
    await applyPathRulesForTab(tabId, url);
    await updateBadgeForTab(tabId, url);
  } catch { /* z.B. about:blank, chrome:// — ignorieren */ }
});

// Aufräumen, wenn ein Tab geschlossen wird.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try { await clearSessionRulesForTab(tabId); } catch { /* ignore */ }
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
