# financify.io

Local-first finance hub with a clean, responsive UI.  
Built from the provided product/design/feature concepts.

## Included MVP modules

- Dashboard with at-a-glance cards and insights
- Subscription tracker
  - CRUD, filters, sorting, status changes
  - monthly/yearly totals, upcoming payments, reminders
  - category/top/trend insights
- Income tracker
  - CRUD, period/source/search filters
  - monthly/source charts, avg/median, MoM delta
- Interest calculator
  - compound timeline, advanced mode (inflation/tax/contribution growth)
  - save scenarios + compare
- Statistics hub
  - range filters (30d/6m/12m/custom)
  - income/spending/cashflow-light insights
- Settings
  - theme, accent, gradient overlay, reduced motion
  - custom background image + optional image blur
  - currency/date/precision/privacy
  - JSON backup import/export + CSV export
- QoL
  - global search, command palette (`Ctrl/Cmd + K`)
  - mobile quick add FAB
  - undo toasts for delete actions

## Architecture

- Frontend: React + TypeScript + Vite
- Routing: React Router
- Data: IndexedDB (`subscriptions`, `incomeEntries`, `interestScenarios`)
- Preferences/UI: LocalStorage
- Core calculation logic isolated in `src/utils`
- Unit tests for core financial logic via Vitest

## Run

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## Notes

- Data stays local on the device (no backend).
- JSON backup supports `replace` and `merge` import modes.
- Code is structured to stay compatible with a future Tauri desktop packaging step.
# Release Notes Source

Desktop release notes are sourced from `CHANGELOG.md`.
For every new version, add a section like `## v0.9.50` before tagging a release.
The release workflow validates this and uses the same notes for GitHub release text and in-app update notes.
