# Changelog

All notable changes for desktop releases are documented here.  
Each release must have a matching section (`## vX.Y.Z`) so GitHub release notes and the in-app update dialog stay in sync.

## v0.11.4
- Prepared the desktop release pipeline for a first macOS build alongside Windows, including DMG output and updater-ready macOS artifacts for future in-app update testing.
- Added ad-hoc macOS signing configuration so the new macOS bundles can be generated consistently during CI without changing the existing Windows release flow.
- Included the latest small UI polish from the current main branch, including improved spacing in the Settings jobs card.

## v0.11.3
- Fixed desktop issue reporting in the installed app by enabling the required Tauri opener permission so `Problem melden` opens in the user's default browser.
- Added a short dark splash intro with centered branding before login/app load, including a smoother handoff into the main UI animations.

## v0.11.2
- Cleaned up the release repository by removing local planning markdown files from GitHub while keeping only `README.md` and `CHANGELOG.md` tracked.
- Improved dashboard responsiveness with a constrained content width, a cleaner two-column top layout, and KPI alignment that stays anchored over the second card column on wider windows.
- Fixed remaining broken German action labels in income and subscription flows and polished page-level KPI alignment across core sections.

## v0.11.1
- Added a new **Expenses** page for tracking everyday spending outside of household costs, with month/year views, recurring expense support, trend and breakdown charts, and searchable entries.
- Improved consistency across income and statistics calculations so current-month totals and dashboard/statistics cashflow figures include the same relevant data sources.
- Refined dashboard and settings interactions with cleaner quick actions, flatter button styling, subtler card shadows, improved tooltip behavior, and better issue reporting polish.
- Added several smaller UX refinements including updated expense/subscription icon usage, dark mode as the default for new profiles, and a footer copyright notice in Settings.

## v0.11.0
- Introduced the first major desktop redesign pass with a cleaner dashboard-inspired shell, dock-style sidebar, refined top controls, and aligned card layouts across core pages.
- Simplified appearance to focused light and dark themes, added a more neutral greyscale dark mode, and polished modal, dropdown, and form field surfaces for a calmer UI.
- Upgraded charts and summaries with animated KPIs, improved line and donut visuals, cleaner hover states, and clearer cost-based color logic for subscriptions and household views.
- Refined login and settings UX with updated in-app branding, improved profile and settings layouts, and more consistent spacing, alignment, and page transitions.
- Updated desktop and web icon assets to the new branding set and switched issue reporting to the new Google Form flow.

## v0.10.4
- Updated the app icon and website favicon set to the new branding asset.
- Refined the sidebar header alignment so the `financify` wordmark sits more cleanly with the navigation.

## v0.10.3
- Improved profile image cropping with direct drag positioning inside the crop circle while keeping zoom control.
- Added crop boundaries so profile images can no longer be dragged beyond the visible frame.
- Fixed broken umlauts and encoding issues on the Household costs page.
- Reviewed visible app translations and cleaned up remaining household text issues.

## v0.10.2
- Added a new **High Contrast** theme and made it the default first-start look, paired with refreshed green default accent and gradient colors.
- Refined onboarding and job setup UX with a cleaner company-first flow, no baked-in example values, matching **salary payouts per year** dropdowns, and currency-aware amount placeholders.
- Refreshed accent color presets with much stronger colors, including a vivid neon green option.
- Improved modal spacing so segmented controls, fields, and footer actions no longer sit too tightly together.
- Tightened settings control hit areas to avoid accidental clicks beside switches and buttons.
- Removed the manual **Reduced animations** setting while keeping system motion preferences intact.

## v0.10.1
- Added an explicit **Apply change** confirmation step for edits that impact history, with the choice between:
  - **Retroactive**
  - **Apply from date**
- Extended this history-scope flow across:
  - recurring income edits
  - subscription cost-impact edits
  - job edits (fixed and casual)
- Improved casual job edits so logged shift entries can be updated consistently (name/rate) with the selected scope.
- Hardened effective-date validation to prevent silent fallback when a selected **from date** cannot be applied.
- Improved household selection stability and removed a render-loop-prone effect.
- Fixed currency label rendering in settings (`EUR (€)`).

## v0.10.0
- Added a new **Household** tab for managing shared living costs in one place.
- Added household setup with residents and recurring household cost entries.
- Added payer assignment per cost, including **external payers** (non-residents).
- Added household monthly overview split into total costs, resident share, and externally paid amount.
- Added household category/resident breakdown charts and 12-month trend view.
- Improved household translation coverage, including subcategory labels.

## v0.9.62
- Improved profile UX and reliability across login, onboarding, and settings.
- Onboarding now lets users choose job type (casual vs fixed) and saves the selected job setup correctly.
- Add Income modal source is now a dropdown with typical income source presets.
- Login screen now always shows a `New profile` action again.
- Fixed profile rename persistence in Edit Profile (name changes are now reliably saved).
- Improved long-name handling in profile switchers and login profile tiles (stable layout + ellipsis).
- Refined date input theming logic so calendar controls adapt by theme.
- Internal state-flow cleanup to reduce race-condition risks in profile/update flows.

## v0.9.61
- Fixed desktop auto-update checks for older app versions by restoring a valid updater manifest (`latest.json`) on the newest release.
- No feature changes in this patch; release exists to recover updater compatibility.

## v0.9.54
- Fixed broken sidebar icons caused by invalid symbol characters.
- Replaced sidebar symbols with stable Unicode icons for all navigation items.
- Improved sidebar icon rendering with symbol font fallbacks and slightly better icon spacing.

## v0.9.53
- Kuss Bro: Desktop start behavior fixed for everyday use.
- Window size/position persistence moved to native Tauri window-state plugin for reliable restore on next launch.
- Enforced single-instance desktop runtime; launching again now focuses the running app instead of opening a parallel instance.
- Main window config refined (`label: main`, larger defaults, min size) to prevent tiny/square startup windows.
- Removed legacy frontend window-size workaround to avoid conflicts with native window-state handling.

## v0.9.52
- Kuss Bro: Erstes Usertesting in zentrale UX-Fixes umgesetzt.
- Desktop-App merkt sich jetzt Fenstergröße und startet mit der zuletzt gespeicherten Größe.
- Theme-Auswahl im Einrichtungsscreen wird sofort sichtbar auf die UI angewendet.
- Modal-Backdrop-Verhalten gehärtet, damit Text-Markieren mit Drag außerhalb nicht mehr versehentlich Popups schließt.
- Kalender-Symbole in Datums-/Zeitfeldern sind in allen Themes kontrastreicher sichtbar.
- Abo-Kategorie im Abo-Log ist jetzt ein Dropdown mit sinnvollen Standardkategorien.
- Top-Kosten/teuerste Abos zeigen Beträge inkl. Nachkommastellen.

## v0.9.51
- Added multi-profile support with profile-specific local storage and IndexedDB separation.
- Added first-start setup flow (onboarding) before entering the dashboard.
- Added profile setup options during onboarding: profile name plus optional PIN/password protection.
- Added profile management in Settings, including post-setup protection updates via Edit Profile.
- Added controlled onboarding exit for newly added profiles while keeping first-start onboarding non-exitable.
- Updated backup payload to profile-aware schema (`backupSchema: 2`, `scope`, `profile` metadata).

## v0.9.50
- Release packaging and version synchronization update.
- Updated app and desktop metadata versions for the new publish.

## v0.9.49
- Income charts and source breakdown now include logged job shifts as `Job: <Name>`.
- Income entries now display job shift items with a clear `Job:` source label.

## v0.9.48
- Added a success popup after JSON import in Settings.
- Success message adapts to import mode (replace or merge).

## v0.9.47
- Fixed desktop white screen issue by using relative asset paths in Tauri builds.
- Switched Tauri runtime routing to hash-based routing for robust local navigation.

## v0.9.46
- Updated release workflow to handle immutable GitHub releases reliably (draft -> publish).
- Added dynamic tag resolution in the release workflow.

