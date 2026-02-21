# Changelog

All notable changes for desktop releases are documented here.  
Each release must have a matching section (`## vX.Y.Z`) so GitHub release notes and the in-app update dialog stay in sync.

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
