# Script Blocker per Domain

Eine kleine Chrome-Erweiterung (Manifest V3), die es erlaubt, einzelne
JavaScript-Dateien gezielt pro Domain zu blockieren — über konfigurierbare
URL-Pattern, ohne dass die DevTools geöffnet sein müssen.

## Wozu?

Manchmal ist auf einer ansonsten brauchbaren Webseite ein einzelnes Skript
das Problem: eine weiche Paywall, ein nervender Tracker, ein fehlerhaftes
Drittanbieter-Widget. JavaScript komplett zu deaktivieren ist zu grob, einen
vollständigen Content-Blocker zu installieren oft Overkill. Mit dieser
Erweiterung blockierst du genau das eine Skript, auf genau den Seiten, auf
denen es dich stört.

## Features

- Blockiert externe Skripte über URL-Pattern (uBlock-Syntax: `||`, `*`, `^`)
- Regeln gelten pro Domain (oder global, wenn Domain leer bleibt)
- Schnelles Hinzufügen aus dem aktuellen Tab via Popup
- Vollwertige Options-Seite mit Tabellen-Editor und JSON Import/Export
- Pro-Regel-Schalter (an/aus, ohne Löschen)
- Diagnose-Ansicht: zeigt welche Regeln zuletzt gegriffen haben
- Funktioniert ohne geöffnete DevTools
- Komplett lokal — keine Telemetrie, keine Remote-Server, keine Tracker

## Installation

### Option A: Aus diesem Repository (empfohlen, solange nicht im Web Store)

1. Lade die neueste Version herunter:
   - **Variante 1:** Klick auf [Releases](../../releases) → bei der neuesten
     Version `script-blocker.zip` herunterladen → entpacken.
   - **Variante 2:** Repository als ZIP herunterladen (grüner Button
     **Code** → **Download ZIP**) → entpacken. Der relevante Ordner heißt
     dann `script-blocker-per-domain-main` (oder ähnlich).
   - **Variante 3 (für Git-Nutzer):**
     ```bash
     git clone https://github.com/<USERNAME>/script-blocker-per-domain.git
     ```

2. Öffne in Chrome `chrome://extensions`.

3. Aktiviere oben rechts den **Entwicklermodus** (Schalter).

4. Klicke auf **Entpackte Erweiterung laden** und wähle den entpackten
   Ordner aus. (Wichtig: den Ordner, der die `manifest.json` enthält —
   nicht einen darüber- oder darunterliegenden Ordner.)

5. Fertig. Das Plugin-Icon (dunkler Kreis mit rotem Strich) erscheint in der
   Toolbar. Falls nicht: auf das Puzzle-Symbol in der Toolbar klicken und
   die Erweiterung anpinnen.

#### Hinweis zur Warnmeldung

Chrome zeigt bei Erweiterungen aus dem Entwicklermodus regelmäßig die
Warnung *"Erweiterungen im Entwicklermodus deaktivieren"* an. Das ist
normal und nicht weiter schlimm — einfach wegklicken. Sobald das Plugin im
Chrome Web Store ist, entfällt die Warnung.

### Option B: Aus dem Chrome Web Store

> *Noch nicht veröffentlicht.* Der Link folgt, sobald das Plugin im Store
> freigeschaltet ist.

### Option C: In anderen Chromium-Browsern

Die Erweiterung läuft identisch in **Microsoft Edge**, **Brave**, **Opera**
und **Vivaldi**. Der Installationsweg ist analog (Entwicklermodus → entpackte
Erweiterung laden).

## Verwendung

### Schneller Weg über das Popup

1. Auf die Webseite navigieren, auf der ein Skript stören soll.
2. Auf das Toolbar-Icon klicken.
3. **↳ Aktuelle Domain übernehmen** klicken — das Domain-Feld wird gefüllt.
4. Im URL-Pattern-Feld die zu blockierende Skript-URL eintragen.
5. **+ Add rule** klicken. Seite neu laden — das Skript wird ab jetzt
   blockiert.

### Über die Options-Seite

Rechtsklick auf das Toolbar-Icon → **Optionen**. Hier kannst du:

- Mehrere Regeln gleichzeitig bearbeiten
- Regeln per JSON exportieren (z.B. zum Synchronisieren zwischen mehreren
  Rechnern oder zum Teilen)
- Regeln per JSON importieren
- Im Diagnose-Bereich sehen, welche Regeln zuletzt gegriffen haben (nützlich
  zum Verifizieren, dass das Pattern stimmt)

### URL-Pattern-Syntax

Die Pattern folgen der Chrome-`declarativeNetRequest.urlFilter`-Syntax, die
stark an uBlock/AdBlock Plus angelehnt ist:

| Symbol | Bedeutung |
|--------|-----------|
| `\|\|` | Domain-Anchor: matcht die angegebene Domain *und alle Subdomains*, ab dem angegebenen Pfad |
| `*` | Beliebige Zeichen (Wildcard) |
| `^` | Trenner: `/`, `?`, `=`, `&` oder URL-Ende |
| `\|` (am Anfang/Ende) | URL-Start bzw. -Ende (anchored) |

## Beispiele

### Beispiel 1: Piano-Paywall auf derStandard.at

Auf `derstandard.at` soll das Skript
`https://at.staticfiles.at/js/piano-37ad4a5b5e.js` blockiert werden. Da
der Hash-Suffix im Dateinamen sich gelegentlich ändert, verwenden wir eine
Wildcard:

| An | Domain | Skript-URL-Pattern |
|----|--------|--------------------|
| ✓  | `derstandard.at` | `\|\|at.staticfiles.at/js/piano-*.js` |

Damit wird der aktuelle wie auch zukünftige Versionen der Datei erfasst.

### Beispiel 2: Tracker auf einer einzelnen Domain blockieren

| An | Domain | Skript-URL-Pattern |
|----|--------|--------------------|
| ✓  | `meine-zeitung.at` | `\|\|google-analytics.com^` |

### Beispiel 3: Globale Regel (keine Domain angegeben)

Wenn das Domain-Feld leer bleibt, gilt die Regel auf *allen* Webseiten:

| An | Domain | Skript-URL-Pattern |
|----|--------|--------------------|
| ✓  | *(leer)* | `\|\|bad-tracker.example.com^` |

## Was das Plugin *nicht* kann

- **Inline-Skripte** (`<script>...</script>` direkt im HTML) lassen sich
  damit nicht blockieren. `declarativeNetRequest` arbeitet auf Netzwerk-
  Ebene und sieht externen Request, aber keinen eingebetteten Code. Für
  inline-Skripte bräuchte es einen anderen Mechanismus
  (`chrome.scripting` + Content-Script).
- **Skripte, die per `eval()` aus einem String ausgeführt werden**, lassen
  sich nicht selektiv blockieren — nur die ursprüngliche Datei, falls sie
  als separater Request geladen wird.

## Datenschutz

Das Plugin sammelt keinerlei Daten. Alle Regeln werden ausschließlich lokal
auf deinem Gerät in `chrome.storage.local` gespeichert. Es werden keine
Verbindungen zu externen Servern aufgebaut. Details siehe [PRIVACY.md](PRIVACY.md).

## Mitwirken

Bugs, Feature-Wünsche oder Verbesserungen gerne als
[GitHub Issue](../../issues) melden. Pull Requests sind willkommen.

## Technik

- Manifest V3
- API: `chrome.declarativeNetRequest` (dynamische Regeln)
- Speicher: `chrome.storage.local`
- Keine Build-Tools, keine externen Abhängigkeiten — purer Vanilla-JS

## Lizenz

[MIT](LICENSE)
