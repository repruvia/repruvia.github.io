# @repruvia/web-app

The Repruvia **report builder**. React 19 + Vite + Tailwind v4 + shadcn/ui.

## Layering (UI / logic separation)

```
src/
├── pages/          # Route compositions only
├── components/
│   ├── ui/         # shadcn primitives (generated — do not hand-edit)
│   ├── atoms/      # Smallest presentational pieces
│   ├── molecules/  # Composed presentational pieces
│   └── organisms/  # Feature sections
├── hooks/          # ALL behaviour lives here (loaders, editor, submission, export)
├── store/          # Zustand state + pure mutations
└── lib/            # Framework-free utilities
    ├── extensionBridge.ts      # Typed facade over chrome.runtime
    └── integrations/           # TicketProvider implementations (Linear, Jira)
```

Components are presentational and receive data + callbacks. Side effects, async
flows, and derivations live in hooks; persistence lives in the store and `lib`.
Ticket integrations implement the shared `TicketProvider` interface, so the
submission UI is provider-agnostic.

## Develop

```bash
cp .env.example .env.local   # set VITE_EXTENSION_ID
pnpm --filter @repruvia/web-app dev   # http://localhost:3000
```
