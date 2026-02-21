# Userkonzept fuer Onboarding und Multi-User

## 1. Zielbild
Beim ersten Start soll der User nicht direkt im Dashboard landen, sondern in einem kurzen Einrichtungsflow.
Danach startet die App immer mit den bereits gesetzten Praeferenzen.

Zusaetzlich sollen mehrere User-Profile auf einem PC/Browsersetup moeglich sein, mit sauber getrennter Datenhaltung und Backup.

## 2. UX-Konzept: Erster Start und Profilwahl

### 2.1 Startlogik
1. App startet.
2. Wenn kein Profil vorhanden: Einrichtungswizard oeffnen.
3. Wenn genau ein Profil vorhanden: direkt in App mit diesem Profil.
4. Wenn mehrere Profile vorhanden: Profilauswahl zuerst zeigen, dann App laden.

### 2.2 Einrichtungswizard (6 Schritte, jeweils eine Karte)
1. Willkommen + Kurzinfo (lokale Speicherung, spaeter aenderbar).
2. Profilname (Pflichtfeld, eindeutig im Geraet).
3. Sprache, Waehrung, Datumsformat.
4. Theme (Light, Dark, Glass, System).
5. Job-Setup (optional): Jobname + Stundensatz + als Standardjob setzen.
6. Zusammenfassung + "Einrichtung abschliessen".

Wichtig fuer seamless UX:
- Buttons: Zurueck, Weiter, Ueberspringen (nur bei optionalen Schritten).
- Live-Praevorschau fuer Theme/Sprache.
- Tastaturbedienung (Enter weiter, Esc abbrechen nur wenn sinnvoll).
- Draft pro Schritt lokal speichern, damit kein Verlust bei Reload/Crash.

## 3. Multi-User Architektur

### 3.1 Empfohlene Struktur
Ein zentrales Profilregister plus profilbezogene Daten.

Global (app-weit):
- `financify.profiles` (Liste aller Profile)
- `financify.activeProfileId` (aktives Profil)

Pro Profil:
- `financify.profile.{profileId}.settings`
- `financify.profile.{profileId}.uiState`
- `financify.profile.{profileId}.backgroundImage`
- IndexedDB pro Profil (empfohlen): `financify-db-{profileId}`
  - Stores wie bisher: `subscriptions`, `incomeEntries`, `interestScenarios`

Warum separate DB pro Profil:
- klare Trennung ohne zusaetzliche `profileId`-Filter in jeder Query
- geringeres Risiko fuer Datenleaks zwischen Profilen
- einfache Loeschung/Export pro Profil

### 3.2 Profilobjekt (Vorschlag)
```json
{
  "id": "p_7f3a2",
  "name": "Noah",
  "createdAt": "2026-02-21T10:15:00.000Z",
  "updatedAt": "2026-02-21T10:15:00.000Z",
  "lastOpenedAt": "2026-02-21T10:15:00.000Z"
}
```

### 3.3 Profilaktionen
- Profil anlegen
- Profil umbenennen
- Profil wechseln
- Profil loeschen (mit harter Bestaetigung)
- Optional spaeter: Profil-PIN (pro Profil)

## 4. Settings und First-Run Integration

### 4.1 Neue Flags
- `hasCompletedOnboarding: boolean` pro Profil
- optional `onboardingVersion: number` (falls spaeter neue Pflichtschritte kommen)

### 4.2 Initialwerte bei neuem Profil
- Sprache: Browser-Sprache ableiten (`de`/`en`, fallback `de`)
- Waehrung: `EUR` (oder spaeter localebasiert)
- Datumsformat:
  - `de` -> `DD.MM.YYYY`
  - `en` -> `MM/DD/YYYY`
- Theme: aktueller Default (`glass`) oder `system`, je Produktentscheidung
- Jobs: leer

## 5. Backup-Konzept (wichtig fuer Multi-User)

## 5.1 Backup-Typen
1. Profil-Backup
   - enthaelt genau ein Profil inkl. Daten
2. Voll-Backup
   - enthaelt alle Profile auf dem Geraet

### 5.2 Dateiname
Profil-Backup:
- `financify-backup-{profilname-slug}-{YYYYMMDD-HHmmss}-v{appVersion}-schema{backupSchema}.json`

Voll-Backup:
- `financify-backup-all-profiles-{YYYYMMDD-HHmmss}-v{appVersion}-schema{backupSchema}.json`

Beispiel:
- `financify-backup-noah-20260221-223015-v0.9.50-schema2.json`

### 5.3 JSON-Struktur (Vorschlag)
```json
{
  "backupSchema": 2,
  "appVersion": "0.9.50",
  "exportedAt": "2026-02-21T22:30:15.000Z",
  "scope": "single-profile",
  "profile": {
    "meta": { "id": "p_7f3a2", "name": "Noah" },
    "settings": {},
    "uiState": {},
    "backgroundImageDataUrl": null,
    "subscriptions": [],
    "incomeEntries": [],
    "interestScenarios": []
  }
}
```

Bei Voll-Backup:
- `scope: "all-profiles"`
- `profiles: [ ... ]`

### 5.4 Import-Regeln
- `replace`:
  - Zielprofil komplett ersetzen
  - bei Voll-Backup optional "alles ersetzen"
- `merge`:
  - pro Entitaet `id` als Primaerschluessel
  - Konfliktregel: neuester `updatedAt` gewinnt
- vor Import immer Validierung:
  - Pflichtfelder, Datentypen, bekannte enum-Werte
  - harte Ablehnung bei ungueltigem Schema

## 6. Migration von aktuellem Stand (wichtig)
Aktuell existiert ein "single user" Datenmodell.
Fuer ein seamless Upgrade:

1. Beim ersten Start nach Update:
   - altes Single-User-Dataset lesen
   - automatisch Profil `Default` erzeugen
   - alle bestehenden Daten in dieses Profil uebernehmen
2. `activeProfileId` auf dieses Profil setzen
3. User sieht danach optional kurzen Hinweis "Profilsystem aktiv"

So gehen keine Bestandsdaten verloren.

## 7. Umsetzung in Phasen

### Phase A: Fundament
- Profilregister + Active Profile State
- Repository-Layer auf profilgebundene DB umstellen
- Backup-Schema auf v2 erweitern

### Phase B: Onboarding
- Wizard UI
- First-run Gate vor App-Routes
- Job/Theme/Language/Currency/Date-Format Setup

### Phase C: Profilverwaltung
- Profil-Switcher in Topbar/Settings
- Profil erstellen/umbenennen/loeschen
- Confirm-Dialoge

### Phase D: Import/Export fertigstellen
- Profil-Backup und Voll-Backup
- Import replace/merge mit Conflict-Handling
- Klare Success/Error-Toasts

## 8. Edge Cases
- Profilname doppelt: automatisch Suffix vergeben (`Noah (2)`).
- Profil loeschen waehrend aktiv: zuerst auf anderes Profil wechseln.
- Letztes Profil loeschen: verbieten oder direkt Onboarding starten.
- Background Image zu gross: importieren aber Bild optional skippen mit Warnung.
- Backup von neuerer App-Version: warnen, nur mit bestaetigter Fortsetzung importieren.

## 9. Tauri und Website Unterschiede
- Website:
  - Speicherung im Browserprofil (LocalStorage/IndexedDB)
  - Multi-User nur innerhalb desselben Browserprofils
- Desktop (Tauri):
  - Speicherung lokal auf dem Rechner im App-Scope
  - Multi-User ist fuer mehrere Personen am selben OS-Account geeignet
  - spaeter empfehlenswert: optionaler Profil-PIN fuer Privatsphaere

## 10. Definition of Done
- Erster Start zeigt Wizard statt Dashboard.
- User kann mindestens 2 Profile anlegen und wechseln.
- Daten sind pro Profil strikt getrennt.
- Backup/Import kann Profil-Backup und Voll-Backup.
- Dateiname des Backups ist eindeutig, versioniert und schema-basiert.
- Migration vom Altbestand funktioniert ohne Datenverlust.
