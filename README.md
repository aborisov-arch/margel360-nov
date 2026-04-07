# AB Intelligence

Web development agency.

## Folder structure

```
AB Intelligence/
├── Clients/
│   ├── _template/     ← Copy this folder for every new client
│   └── [ClientName]/
│       ├── website/   ← All code files
│       ├── assets/    ← Logos, photos, brand files
│       ├── docs/      ← Contracts, proposals, invoices
│       └── notes.md   ← Project notes and status
├── Internal/
│   ├── templates/     ← Reusable starter code / components
│   ├── tools/         ← Scripts and utilities
│   └── branding/      ← AB Intelligence logo and brand assets
└── Finance/
    ├── invoices/      ← Issued invoices (name: YYYY-MM-ClientName.pdf)
    └── expenses/      ← Receipts and costs
```

## Adding a new client
1. Copy `Clients/_template/` → rename to client name
2. Fill in `notes.md`
3. Put code in `website/`, brand files in `assets/`, contracts in `docs/`
