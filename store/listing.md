# Chrome Web Store — listing copy

Paste-ready fields for the Developer Dashboard.

**Icon:** upload `icon-128.png` from this kit (128×128).
**Promo tile:** upload `promo-tile.png` (440×280).
**Screenshots:** upload the PNGs in `screenshots/` (1280×800).

## Fields

**Name** (≤45 chars):

```
GitHub PR Review Enhancement
```

**Summary** (≤132 chars):

```
Collapse multi-line comment blocks in GitHub PR diffs to one line. Hover to highlight, click to expand.
```

**Category:** Developer Tools
**Language:** English

**Detailed description:**

```
Reviewing a PR is harder when every function arrives with a wall of comments. This extension collapses each run of multi-line source-code comments in the "Files changed" view into a single line with a +N badge — so you review code, not comment walls.

How it works
• Auto-collapses comment blocks on page load — works in both the classic and the new GitHub diff views
• Hover a collapsed block for GitHub's native accent highlight; the full comment text is in the tooltip
• Click (or press Enter / Space) to expand and re-collapse; the +N / −N badge shows how many lines are hidden
• Expanded blocks stay expanded while you scroll (virtualization-safe)

Safe by design
• Only whole-line comments collapse — trailing comments, URLs and strings never trigger
• The right comment markers are detected automatically from each file's extension, so blocks in the languages used by your project are recognized correctly
• Formats without comments are left untouched, and Markdown headings are never collapsed

Privacy
• Zero permissions: no storage, no network requests, no tracking, no analytics. Everything runs locally in your browser.

Source: https://github.com/tskorupka/github-pr-review-enhancement
```

## Single purpose statement

```
Collapse multi-line source-code comment blocks in GitHub pull request file diffs into a single line, with hover highlight and click-to-expand.
```

## Website access

- **Category:** On specific sites
- **Matches:** `https://github.com/*`
- **Justification:**

```
The content script must read and modify the diff page DOM on github.com pull request "Files changed" views in order to group consecutive comment lines, hide them, and render the collapse badge and hover highlight. It never accesses data outside github.com and sends nothing anywhere.
```

## Remote code

```
No. All logic ships inside the store package (manifest.json, content.js, styles.css). The extension loads no remote scripts.
```

## Privacy — data collection questionnaire

```
• Does this item collect user data?  No
• Permanently deleted if removed?    n/a — nothing is stored
• Independent of account?            yes
• Analytics / cookies / credentials / browsing history / personal content?  none of these
```

Note: no privacy policy URL is required when declaring zero data collection.
