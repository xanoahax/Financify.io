# Tauri Plan - financify.io

## Ziel
- Web-App als Desktop-App (Windows/macOS/Linux) bereitstellen.
- Lokale, langfristige Datenspeicherung pro User.
- In-App-Updates einfuehren, ohne Datenverlust.

## Scope v0.x

### 1) Desktop-Setup
- [ ] Tauri v2 in bestehendes Vite/React-Projekt integrieren.
- [ ] Build-Targets fuer Windows/macOS/Linux konfigurieren.
- [ ] App-Metadaten (Name, Icon, Bundle-ID, Version) finalisieren.

### 2) Lokale Datenspeicherung
- [ ] Persistente Daten in `appDataDir` speichern (nicht im Installationsordner).
- [ ] Datenmodell fuer Abos, Einkommen, Zins-Szenarien und Settings festlegen.
- [ ] Entscheidung: SQLite (Hauptdaten) + Store (kleine Settings/UI-Flags).
- [ ] Backup-Datei als JSON exportieren/importieren (vollstaendig).

### 3) Migration Web -> Desktop
- [ ] Einmalige Uebernahme aus bestehendem IndexedDB/localStorage.
- [ ] Migration nur einmal ausfuehren (`migration_done` Flag).
- [ ] Integritaetscheck nach Migration (Anzahl Datensaetze + Pflichtfelder).

### 4) Update-Funktionalitaet
- [ ] Tauri Updater Plugin integrieren.
- [ ] "Nach Updates suchen" in Einstellungen.
- [ ] Optional: automatischer Check beim App-Start.
- [ ] Signierte Update-Artefakte bereitstellen.
- [ ] Update-Kanaele: `stable` (optional spaeter: `beta`).

### 5) Datenverlust-Schutz bei Updates
- [ ] Vor jedem Install-Update Auto-Backup erstellen.
- [ ] Nach Update beim ersten Start Schema-Migrationen ausfuehren.
- [ ] Migrationen transaktional (Rollback bei Fehler).
- [ ] Recovery-Flow: Backup wiederherstellen, falls Migration fehlschlaegt.

### 6) Sicherheit
- [ ] CSP/Allowlist fuer Tauri-Faehigkeiten auf Minimum begrenzen.
- [ ] Keine sensiblen Daten in Klartext-Logs.
- [ ] Optional spaeter: verschluesseltes Backup mit Passwort.

### 7) UX in der App
- [ ] Settings-Kachel "Desktop" mit:
- [ ] Letzter Update-Check
- [ ] Button "Nach Updates suchen"
- [ ] Button "Backup erstellen"
- [ ] Button "Backup wiederherstellen"
- [ ] Hinweis auf lokalen Speicherpfad

### 8) QA / Release
- [ ] Testfaelle fuer Update ohne Datenverlust definieren.
- [ ] Testmatrix: clean install, update, downgrade-block, restore.
- [ ] GitHub Actions Workflow fuer signierte Releases bauen.
- [ ] Erste interne Testversion (alpha) als Installer ausliefern.

## Reihenfolge (empfohlen)
1. Tauri-Setup + lokaler Datenlayer.
2. Web->Desktop Migration + Backup/Restore.
3. Updater + Signierung + Release-Pipeline.
4. Recovery-Flow + End-to-End Tests.

## Definition of Done (v0.x)
- Desktop-Build laeuft stabil auf mindestens Windows.
- Alle Kernfeatures speichern lokal und bleiben nach Update erhalten.
- App kann manuell nach Updates suchen und erfolgreich aktualisieren.
- Backup/Restore funktioniert reproduzierbar mit realen Testdaten.
