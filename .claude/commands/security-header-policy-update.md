---
name: security-header-policy-update
description: Workflow command scaffold for security-header-policy-update in margel360-nov.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /security-header-policy-update

Use this workflow when working on **security-header-policy-update** in `margel360-nov`.

## Goal

Update or tighten HTTP security headers such as CSP, COOP, CORP, or add new security-related policies.

## Common Files

- `netlify.toml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit netlify.toml to adjust security headers (e.g., CSP, COOP, CORP, SRI).
- Document rationale and risk in commit message.
- Verify that changes do not break existing site functionality.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.