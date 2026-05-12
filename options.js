// options.js

const rowsEl = document.getElementById("rows");
const statusEl = document.getElementById("status");

function send(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

function setStatus(text, color) {
  statusEl.textContent = text;
  statusEl.style.color = color || "#888";
  if (text) setTimeout(() => { statusEl.textContent = ""; }, 2500);
}

function makeRow(rule = { domain: "", urlFilter: "", enabled: true }) {
  const tr = document.createElement("tr");

  const tdOn = document.createElement("td");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = rule.enabled !== false;
  tdOn.appendChild(cb);

  const tdDom = document.createElement("td");
  const inpDom = document.createElement("input");
  inpDom.type = "text";
  inpDom.value = rule.domain || "";
  inpDom.placeholder = "e.g. example.com";
  tdDom.appendChild(inpDom);

  const tdUrl = document.createElement("td");
  const inpUrl = document.createElement("input");
  inpUrl.type = "text";
  inpUrl.value = rule.urlFilter || "";
  inpUrl.placeholder = "||example.com/path/script.js";
  tdUrl.appendChild(inpUrl);

  const tdDel = document.createElement("td");
  const btn = document.createElement("button");
  btn.textContent = "Delete";
  btn.className = "danger";
  btn.addEventListener("click", () => tr.remove());
  tdDel.appendChild(btn);

  tr.appendChild(tdOn);
  tr.appendChild(tdDom);
  tr.appendChild(tdUrl);
  tr.appendChild(tdDel);

  tr._getRule = () => ({
    domain: inpDom.value.trim(),
    urlFilter: inpUrl.value.trim(),
    enabled: cb.checked
  });
  return tr;
}

function readAllRules() {
  return Array.from(rowsEl.children)
    .map(tr => tr._getRule())
    .filter(r => r.urlFilter !== "");
}

async function loadIntoForm() {
  rowsEl.innerHTML = "";
  const res = await send({ type: "getRules" });
  const rules = res?.rules || [];
  if (rules.length === 0) {
    rowsEl.appendChild(makeRow());
  } else {
    rules.forEach(r => rowsEl.appendChild(makeRow(r)));
  }
}

document.getElementById("addRow").addEventListener("click", () => {
  rowsEl.appendChild(makeRow());
});

document.getElementById("save").addEventListener("click", async () => {
  const rules = readAllRules();
  const res = await send({ type: "setRules", rules });
  if (res?.ok) setStatus("✓ Saved (" + rules.length + " active rules)", "#4ea1ff");
  else setStatus("Error: " + (res?.error || "unknown"), "#e06b6b");
});

document.getElementById("export").addEventListener("click", () => {
  const json = JSON.stringify(readAllRules(), null, 2);
  document.getElementById("ioArea").value = json;
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "script-blocker-rules.json";
  a.click();
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("ioArea").focus();
  setStatus("Paste JSON into the textarea below and click 'Apply'");
});

document.getElementById("importApply").addEventListener("click", async () => {
  try {
    const parsed = JSON.parse(document.getElementById("ioArea").value);
    if (!Array.isArray(parsed)) throw new Error("Expected an array");
    rowsEl.innerHTML = "";
    parsed.forEach(r => rowsEl.appendChild(makeRow(r)));
    await send({ type: "setRules", rules: parsed });
    setStatus("✓ Imported: " + parsed.length + " rules", "#4ea1ff");
  } catch (err) {
    setStatus("JSON error: " + err.message, "#e06b6b");
  }
});

document.getElementById("refreshMatched").addEventListener("click", async () => {
  const res = await send({ type: "getMatchedRules" });
  const el = document.getElementById("matched");
  if (!res?.ok) { el.textContent = "Error: " + (res?.error || "—"); return; }
  if (!res.matched || res.matched.length === 0) {
    el.textContent = "No blocked requests in the last few minutes.";
    return;
  }
  el.innerHTML = res.matched.map(m =>
    new Date(m.timeStamp).toLocaleTimeString() +
    " — Rule #" + m.rule.ruleId +
    " (Tab " + (m.tabId ?? "—") + ")"
  ).join("<br>");
});

loadIntoForm();
