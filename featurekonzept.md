# Featurekonzept (ausführlich) — financify.io

## 1) Produktziel
financify.io ist ein „All-in-one“-Hub für persönliche Finanzen: Abos, Zinsrechner, Einkommen, Statistiken – mit sauberem Apple-clean UI, hoher Responsiveness und starken QoL-Features.  
Daten werden **lokal** gespeichert (LocalStorage/IndexedDB) und später auch im **Tauri-Desktop-Build** persistent verfügbar gemacht.

---

## 2) Feature-Scope & Module

### Modul A — Abo-Tracker (Subscriptions)
**Ziel:** Wiederkehrende Kosten verstehen, reduzieren, planen.

**Features**
- **Abo anlegen/bearbeiten**
  - Name, Anbieter, Kategorie, Tags
  - Betrag, Währung (global oder pro Abo)
  - Intervall: monatlich / jährlich / 4-wöchig / custom (z.B. alle X Monate)
  - Startdatum, nächste Abbuchung (auto berechnet + manuell überschreibbar)
  - Kündigungsfrist (Tage) + „Kündigen bis“-Datum
  - Notizen, Link (z.B. zum Anbieter)
  - Status: aktiv / pausiert / gekündigt
- **Übersichten**
  - Monatssumme & Jahressumme (mit Umrechnung)
  - „Upcoming Payments“ Liste (nächste 7/14/30 Tage)
  - Kategorien- und Tag-Filter, Suche
  - Sortierung: Betrag, nächstes Datum, Name
- **Aktionen**
  - Quick Add (minimal: Name + Betrag + Intervall)
  - Inline Editing (Betrag/Intervall direkt in Liste)
  - Pause / Reaktivieren
  - Kündigen (setzt Status + optional „End date“)
  - Undo nach Löschen

**Insights**
- Top-Abos nach Kosten (Monat/Jahr)
- Kosten nach Kategorie (Donut/Bar)
- Trend „Abo-Ausgaben“ pro Monat (Line)
- „Hidden annuals“: jährlich abgerechnet, aber auf Monat umgerechnet

---

### Modul B — Einkommen-Tracker (Income)
**Ziel:** Einnahmen strukturiert erfassen und über Zeit vergleichen.

**Features**
- **Eintrag erstellen**
  - Betrag, Datum, Quelle (Job/Freelance/Side)
  - Tags, Notiz
  - Wiederholung (optional): monatlich, wöchentlich, custom
  - Netto/Brutto Toggle (optional später)
- **Übersichten**
  - Monats- und Jahresansicht
  - Quellen-Filter, Search, Tag-Filter
  - Edit inline, Batch delete (mit confirm)
- **Statistiken**
  - Einnahmen pro Monat (Bar)
  - Quellenverteilung (Donut)
  - Durchschnitt/Median, MoM-Change (%)
  - Best/Worst Month

---

### Modul C — Zinsrechner (Interest / Compound)
**Ziel:** Growth-Szenarien schnell visualisieren.

**Features**
- **Inputs**
  - Startkapital
  - Regelmäßige Einzahlung (monatlich/jährlich/custom)
  - Zinssatz p.a.
  - Laufzeit (Monate/Jahre)
  - Zinsintervall (monatlich/jährlich)
- **Advanced (toggle)**
  - Inflation (Realwert)
  - Steuern auf Gewinne (vereinfachtes Modell)
  - Einzahlungssteigerung (z.B. +2% pro Jahr)
- **Outputs**
  - Endbetrag, total Einzahlungen, total Zinsen
  - Timeline Chart (Line)
  - Tabelle (Jahr/Monat) im Drawer
- **Save & Compare**
  - Szenario speichern („Plan A“, „Plan B“)
  - Vergleich 2 Szenarien (Overlay Chart)

---

### Modul D — Statistiken & Insights Hub
**Ziel:** Ein zentraler Bereich für „Was passiert in meinen Finanzen?“.

**Features**
- Zeitraumfilter: 30 Tage / 6 Monate / 12 Monate / Custom
- Subscriptions Insights
- Income Insights
- Kombi-Karten:
  - „Cashflow light“ (Income – Subscriptions) als grober Indikator
  - Trend-Vergleich zum Vorzeitraum
- Export: PNG/CSV (später), aktuell CSV reicht

---

### Modul E — Einstellungen (Customization)
**Appearance**
- Theme: Light/Dark/System
- Accent Color Presets (optional custom)
- Background Blur On/Off
- Reduced Motion On/Off
- Density: Comfortable/Compact (für Tabellen)

**Preferences**
- Currency (EUR default)
- Number formatting (Decimals)
- Date format (DD.MM.YYYY etc.)
- Start-of-week (Mo/So)

**Privacy**
- „Hide amounts“ Toggle (maskiert Zahlen)
- Optional: App Lock (Tauri später)

---

## 3) Quality-of-Life Features (App-weit)

### Navigation & Speed
- Global Search (Abos, Einkommen)
- Command Palette (Ctrl/Cmd+K):
  - Add Subscription
  - Add Income
  - Open Calculator
  - Jump to Settings
- Quick Add Button (sticky auf Mobile)
- Recent Actions / Recently edited

### Data Handling
- Autosave
- Undo/Redo für kritische Aktionen (min. Undo)
- Import/Export:
  - Export als JSON (vollständiger Backup)
  - Export als CSV (Subscriptions, Income)
  - Import JSON (Merge/Replace)

### UX Feinheiten
- Empty states mit CTA
- Tooltips für schwierige Begriffe (Inflation, Realwert)
- Smart defaults (letzte Kategorie, letzter Intervall)

---

## 4) Datenhaltung: LocalStorage + IndexedDB (Architektur)

### Prinzip
- **LocalStorage**: klein, schnell, Settings & UI-State
- **IndexedDB**: alle Finanzdaten, Versionierung, Szenarien, Historie

### Was wo gespeichert wird
**LocalStorage**
- `settings` (theme, accent, blur, currency, dateFormat, privacy)
- `uiState` (sidebar collapsed, last selected filters, last tab)
- `appMeta` (migrationVersion, lastBackupPrompt)

**IndexedDB**
- `subscriptions`
- `incomeEntries`
- `interestScenarios`
- `categories` (optional custom)
- `tags` (optional)
- `events/audit` (optional: change log light)

### IDB Struktur (Beispiel Stores)
- `subscriptions` (key: id)
  - Index: nextPaymentDate
  - Index: status
  - Index: category
- `incomeEntries` (key: id)
  - Index: date
  - Index: source
- `interestScenarios` (key: id)
  - Index: createdAt

### Migration & Versioning
- `dbVersion` hochzählen bei Schema-Änderungen
- Migrations:
  - Feld hinzufügen → default setzen
  - Feld umbenennen → transform
- Fail-safe:
  - vor Migration Auto-Backup in `appMeta` markieren (optional)

---

## 5) File- & Backup-Konzept (lokal, ohne Server)

### Export (MVP)
- **Backup JSON**
  - Enthält: Settings, Subscriptions, Income, Scenarios, Meta
- **CSV Export**
  - Subscriptions.csv, Income.csv

### Import
- JSON Import:
  - Modus: Replace (alles ersetzen) oder Merge (IDs deduplizieren)
- CSV Import (optional später):
  - mapping UI (Spalten zu Feldern)

---

## 6) Tauri-Ready Konzept (später Desktop Build)

### Ziel
Die gleiche App als Desktop (Win/macOS/Linux) mit stabiler lokaler Persistenz, optional mit File-System Export/Import und später App-Lock.

### Speicherstrategie im Tauri Build
- Primär weiterhin IndexedDB (WebView) möglich
- Optional Upgrade (später):
  - Tauri `fs` API: Backups automatisch in AppData speichern
  - „Export Backup to File“ / „Import from File“
  - Optional Verschlüsselung (z.B. passwortbasiert) für Backup-Dateien

### Tauri QoL (später)
- System Tray Quick Actions („Add Income“, „Add Subscription“)
- Global Shortcut (open command palette)
- Auto-update (wenn gewünscht)

---

## 7) Functional Requirements (konkret)

### Performance
- App shell lädt < 1s gefühlt (skeleton UI)
- IndexedDB Zugriffe: caching layer für häufig genutzte Reads
- Charts lazy-load / nur rendern wenn sichtbar

### Reliability
- Jede Mutation erzeugt konsistente Derived Values (Totals, NextPayment)
- Validierung: keine negativen Beträge außer explizit erlaubt
- Date handling robust (Timezone-safe: nur lokale Datumskomponenten)

### Responsiveness
- Mobile-first flows:
  - Tabellen → Cards
  - Sticky Add
  - Drawer statt komplexe Seitenwechsel

---

## 8) Derived Data (Berechnungslogik)

### Subscriptions
- `monthlyEquivalent`:
  - monthly: amount
  - yearly: amount / 12
  - custom: amount / monthsBetweenPayments
- `nextPaymentDate`:
  - aus startDate + interval bis > today
  - override möglich
- `cancelByDate`:
  - nextPaymentDate - noticePeriodDays

### Income
- Aggregation nach Monat:
  - Summe pro YYYY-MM
- Source breakdown:
  - group by source, sum

### Interest Scenarios
- Monatliche Iteration:
  - apply contribution
  - apply interest
- Realwert optional:
  - nominal / (1 + inflation)^years

---

## 9) User Stories (Beispiele)

- Als User will ich sehen, wie viel ich monatlich für Abos ausgebe, um Kosten zu senken.
- Als User will ich die nächste Abbuchung sehen, um Überraschungen zu vermeiden.
- Als User will ich Einnahmen pro Quelle vergleichen, um Stabilität einzuschätzen.
- Als User will ich Zins-Szenarien speichern, um Strategien zu vergleichen.
- Als User will ich ein JSON-Backup exportieren, um meine Daten zu sichern.

---

## 10) MVP → V1 → V2 Roadmap

### MVP (Launch)
- Subscriptions: CRUD + Monats/Jahressumme + Upcoming + simple stats
- Income: CRUD + Monatsübersicht + basic stats
- Interest: Rechner + Chart
- Settings: Theme + Accent + Blur + Currency
- Storage: LocalStorage + IndexedDB
- Export/Import: JSON Export + JSON Import (Replace)
- Merge Import, CSV Export

### V1
- Scenario Compare (Interest)
- Sparplan ersteller für größere Käufe
- Advanced Interest toggles (Inflation/Steuer)
- More Insights (vergleich Vorperiode)

### V2 (Tauri)
- File-based Backups
- Optional App Lock
- Tray actions + shortcuts

