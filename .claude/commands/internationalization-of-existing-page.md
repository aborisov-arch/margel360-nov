---
name: internationalization-of-existing-page
description: Workflow command scaffold for internationalization-of-existing-page in margel360-nov.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /internationalization-of-existing-page

Use this workflow when working on **internationalization-of-existing-page** in `margel360-nov`.

## Goal

Add or improve internationalization (i18n) support for an existing page, enabling multiple languages.

## Common Files

- `website/js/translations-*.js`
- `website/*.html`
- `website/js/*.js`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update translations JS file (e.g., translations-edit.js, translations-reservation.js).
- Update the HTML file to use data-i18n attributes for all static and dynamic text.
- Update the relevant JS logic to wire up the i18n engine and handle language toggling.
- Bump version numbers for cache busting if needed.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.