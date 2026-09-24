# Privacy Policy

**Last updated:** 2026-09-24

This privacy policy applies to the **GitHub PR Review Enhancement** Chrome extension.

## Summary

The extension collects, stores, and transmits **no data of any kind**.

## Details

- **No data collection.** The extension does not collect, use, share, or sell any personal or non-personal data.
- **No network requests.** The extension makes zero network requests. It does not communicate with any server, API, or third party.
- **No storage.** The extension does not use `chrome.storage`, cookies, localStorage, or any other persistence. Per-session expand/collapse state lives only in the current page and is discarded when the tab closes.
- **No tracking or analytics.** No analytics, telemetry, fingerprints, or identifiers.
- **No account access.** The extension does not read credentials, tokens, or GitHub data beyond rendering the pull request diff pages that are already visible in your browser.

## Permissions

The extension injects a content script on `https://github.com/*` because it must read and modify the pull request “Files changed” page DOM to group comment lines and render the collapse badge and hover highlight. This access is used solely for that on-page behavior.

## Third parties

The extension has no relationship with third parties and shares nothing with anyone.

## Changes

Any future change to this policy will be published in the project repository along with the corresponding release. Previous versions remain available in the repository history.

## Contact

Questions? Open an issue at [github.com/tskorupka/github-pr-review-enhancement](https://github.com/tskorupka/github-pr-review-enhancement).

## Source code

The extension is open source under the [MIT license](https://github.com/tskorupka/github-pr-review-enhancement/blob/main/LICENSE) — inspect exactly what it does at [github.com/tskorupka/github-pr-review-enhancement](https://github.com/tskorupka/github-pr-review-enhancement).
