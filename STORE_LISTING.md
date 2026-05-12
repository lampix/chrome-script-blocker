# Chrome Web Store — Listing Material

Use the texts below when submitting the extension to the Chrome Web Store.
Copy/paste sections into the developer dashboard as needed.

---

## Single-purpose description (required by the Web Store)

> A single-purpose tool that lets users block specific JavaScript files on
> specific websites by configuring URL patterns. Useful for disabling
> nuisance scripts (paywalls, trackers, broken third-party widgets) without
> blocking entire domains or installing a full content blocker.

---

## Short description (≤132 characters)

> Block specific JavaScript files per domain. Configure URL patterns to disable nuisance scripts without keeping DevTools open.

---

## Detailed description

> **Script Blocker per Domain** lets you selectively block individual
> JavaScript files on individual websites, using familiar uBlock-style URL
> patterns.
>
> **Why use this?**
>
> Sometimes a single script on an otherwise useful site causes problems —
> a soft paywall, a broken third-party widget, an aggressive tracker.
> Disabling JavaScript globally is too much. Installing a full content
> blocker is overkill. With Script Blocker per Domain, you target exactly
> the script you want gone, on exactly the sites where you want it gone.
>
> **Features**
>
> • Block any external script by URL pattern (uBlock-style: `||`, `*`, `^`).
> • Limit each rule to specific domains, or apply globally.
> • Quick popup for adding rules from the current tab.
> • Full options page with table editor, JSON import/export.
> • Per-rule on/off toggles.
> • Diagnostic view of recently blocked requests.
> • Works without DevTools open.
> • No tracking, no telemetry, no remote servers. All rules stored locally.
>
> **Technical**
>
> Built on Manifest V3 using the modern `declarativeNetRequest` API. Rules
> are evaluated by Chrome itself for performance and privacy — the
> extension never inspects request content.
>
> **Limitations**
>
> Blocks externally-loaded scripts (network requests). Inline `<script>`
> blocks embedded in HTML cannot be blocked by this extension.
>
> Source code and documentation: [GitHub repository URL]

---

## Category

> Productivity (or: Developer Tools)

---

## Permission justifications

Use these in the "Permissions" section of the Web Store submission form.

### `declarativeNetRequest`

> Required to block matching network requests for scripts based on the
> user's configured rules. This is the modern Manifest V3 mechanism for
> request blocking.

### `declarativeNetRequestFeedback`

> Required to power the "Recently blocked requests" diagnostic view in the
> options page, so users can verify their rules are working as expected.

### `storage`

> Required to persist the user's block rules locally between browser
> sessions via `chrome.storage.local`.

### `activeTab`

> Required so the popup can read the URL of the currently active tab and
> offer a "Use current domain" shortcut when adding new rules. Only used
> when the user explicitly opens the popup.

### Host permissions

> None. The extension does not request access to any specific websites.
> Network request blocking via declarativeNetRequest does not require host
> permissions, and the extension never injects code into pages or reads
> page content.

---

## Privacy practices disclosures

When asked in the dashboard, declare:

| Category | Answer |
|---|---|
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

> "I certify that the following disclosures are true: I do not sell or
> transfer user data to third parties, outside of the approved use cases.
> I do not use or transfer user data for purposes that are unrelated to
> my item's single purpose. I do not use or transfer user data to
> determine creditworthiness or for lending purposes."

Check **all three** boxes.

---

## Privacy policy URL

After publishing PRIVACY.md, paste the public URL. If you host the repo on
GitHub, the easiest stable URL is:

> https://github.com/<your-username>/script-blocker-per-domain/blob/main/PRIVACY.md

---

## Screenshots needed (you must take these yourself)

The Web Store requires 1–5 screenshots at **1280×800** or **640×400**.
Suggested shots:

1. **Popup with a few rules visible.** Caption: "Quick toggles from any tab."
2. **Options page with table editor.** Caption: "Manage all rules in one place."
3. **URL syntax help section expanded.** Caption: "uBlock-style URL patterns."
4. **Diagnostics view showing blocked requests.** Caption: "See exactly what's being blocked."

Capture them after installing the extension and adding a couple of demo
rules so the screenshots look populated.

---

## Promotional images (optional but recommended)

- Small tile: **440×280**
- Marquee: **1400×560**

If you skip these, the listing still works but looks emptier on the store
front page.
