# Changelog

All notable changes for desktop releases are documented here.  
Each release must have a matching section (`## vX.Y.Z`) so GitHub release notes and the in-app update dialog stay in sync.

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
