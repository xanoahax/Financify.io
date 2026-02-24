# Changelog

All notable changes for desktop releases are documented here.  
Each release must have a matching section (`## vX.Y.Z`) so GitHub release notes and the in-app update dialog stay in sync.

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
