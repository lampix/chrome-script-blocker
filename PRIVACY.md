# Privacy Policy

**Script Blocker per Domain** does not collect, transmit, or share any user data.

## What this extension does

- Stores your block rules **locally on your device** using Chrome's
  `chrome.storage.local` API.
- Reads the URL of the currently active tab (via `activeTab` permission) only
  when you open the popup, in order to display the current hostname and offer
  the "Use current domain" shortcut. This data never leaves your browser.
- Uses Chrome's declarative network request API to block network requests
  matching your configured rules. Block decisions are made entirely inside the
  browser; no requests, URLs, or metadata are sent to any external server.

## What this extension does NOT do

- No analytics, telemetry, or crash reporting.
- No remote configuration.
- No third-party servers contacted.
- No reading of page content.
- No tracking of browsing history.

## Data retention

All rules remain on your device until you delete them or uninstall the
extension. Uninstalling removes all stored rules.

## Contact

For questions or issues, please open an issue on the project's GitHub
repository.
