# Grundkonzept — financify.io

**financify.io** ist eine moderne, cleane Web-App im Apple-Style, die mehrere Finanz-Tools in **einer** übersichtlichen Oberfläche bündelt. Fokus: **Klarheit, Geschwindigkeit, Einblicke** und ein **userfriendly Erlebnis** auf allen Geräten.

---

## 1) Produktidee & Value Proposition

**Problem:** Finanzinfos sind oft verteilt (Abos hier, Einkommen dort, Rechner irgendwo).  
**Lösung:** financify.io kombiniert Kern-Tools + Statistiken in einer zentralen, ruhigen Oberfläche.

**Versprechen in einem Satz:**  
> *„Alle wichtigen Finanz-Tools an einem Ort – sauber, schnell, verständlich.“*

---

## 2) Zielgruppe

- Studierende & Young Professionals, die Budget & Abos im Griff behalten wollen
- Selbstständige/Side Hustler mit wechselnden Einkommen
- „Minimalisten“, die eine cleane Alternative zu überladenen Finance-Apps suchen

---

## 3) Kern-Features (MVP)

### A) Abo-Tracker (Subscriptions)
**Ziel:** Alle Abos, Kosten und Laufzeiten sichtbar machen.

**Funktionen:**
- Abo anlegen: Name, Kategorie, Anbieter, Betrag, Zahlungsintervall (monatlich/jährlich/benutzerdefiniert), Startdatum, Kündigungsfrist, Notizen
- **Kosten-Ansichten:** monatlich & jährlich (automatisch umgerechnet)
- **Upcoming Payments** (nächste Abbuchungen)
- **Kündigungs-Reminder** (visuell + optional Notification später)
- Tags/Kategorien + Filter (z.B. Entertainment, Tools, Mobilität)

**Insights/Stats:**
- Top 5 teuerste Abos
- Kategorie-Verteilung (Donut/Bar)
- Trend: Abokosten pro Monat (Timeline)

---

### B) Zinsrechner (Interest / Compound)
**Ziel:** Schnell verstehen, wie Geld über Zeit wächst.

**Rechner-Parameter:**
- Startkapital
- monatliche Einzahlung (optional)
- Zinssatz (p.a.)
- Laufzeit (Monate/Jahre)
- Zinsintervall (monatlich/jährlich)
- Optional: Inflation, Steuern (als Toggle „Advanced“)

**Outputs:**
- Endbetrag, eingezahlt vs. Zinsen
- Kurve über Zeit (Line Chart)
- Tabellen-Ansicht (Jahr/Monat) als „Details“-Drawer

---

### C) Einkommen-Tracker (Income Overview)
**Ziel:** Einnahmen erfassen + verständliche Übersicht.

**Funktionen:**
- Eintrag: Betrag, Quelle (Job/Freelance/Side), Datum, Wiederholung (optional), Notiz
- Monatsübersicht + Jahresübersicht
- Quellen-Filter + Tags
- Export (CSV) als QoL Feature

**Insights/Stats:**
- Einnahmen pro Monat (Bar)
- Top Quellen (Ranking)
- Durchschnitt/Median pro Monat
- „Best Month / Worst Month“

---

## 4) Informationsarchitektur (Seitenstruktur)

**Core Layout:** eine App mit Sidebar/Topbar (responsive), Tool-Module als Routen.

**Navigation:**
- **Dashboard** (Overview)
- **Abo-Tracker**
- **Zinsrechner**
- **Einkommen**
- **Statistiken**
- **Einstellungen**

**Dashboard (Start):**
- „At a glance“-Cards:  
  - Monatliche Abokosten  
  - Einnahmen aktueller Monat  
  - Nächste Abbuchungen  
  - Shortcut: „Neues Abo“, „Neue Einnahme“
- Mini-Charts (sparsam, clean)
- „Insights“-Block (2–3 Highlights, nicht mehr)

---

## 5) UI/UX Leitlinien (Apple-clean)

### Look & Feel
- Viel **Whitespace**, klare Hierarchie, wenige Akzente
- **Frosted Glass / Blur** optional (User Setting)
- Card-basierte Sections mit softem Shadow
- Fokus auf Lesbarkeit: große Headings, ruhige Subtitles, klare Labels

### Typografie
- Moderne Sans-Serif (z.B. Inter / SF-like)
- Saubere Größen-Skala:
  - H1: Produkt/Seite
  - H2: Section
  - Body: Input/Info
  - Microcopy: Hinweise/Helper-Text

### Komponenten-Standard
- Cards, Tables, Pills/Tags, Toggle, Segmented Control (Monat/Jahr), Date Picker
- Charts minimalistisch (keine „bunten Spielzeuge“), klare Achsen, dezente Gridlines
- Empty States mit kurzer Erklärung + CTA

---

## 6) Responsiveness (Highly Responsive)

**Breakpoints-Strategie:**
- Mobile: Bottom-Navigation oder collapsible Sidebar
- Tablet: Sidebar Icon-only
- Desktop: Sidebar expanded + Quick Actions

**Mobile Priorities:**
- 1-Spalten Layout
- Sticky „Add“-Button (FAB) für Abo/Einnahme
- Tabellen werden zu Cards (Stacked rows)

---

## 7) Quality-of-Life Features

- Global Search (Abos + Einnahmen)
- Quick Add (Cmd/Ctrl + K Palette)
- Smart Defaults (letztes Intervall, letzte Kategorie)
- Inline Editing (ohne Modal-Hölle)
- Undo Toast (nach Löschen)
- Export/Import (CSV)
- Autosave + Offline-optimierte States (später)

---

## 8) Einstellungen & Customizability

**Appearance:**
- Accent Color (Preset-Palette)
- Background Blur: On/Off
- Theme: Light/Dark/System
- Reduced Motion Toggle

**Preferences:**
- Währung (EUR default)
- Datumsformat
- Rundung/Decimals
- Advanced Mode (zeigt Inflation/Steuern im Zinsrechner)

**Privacy (UI-Ebene):**
- „Hide amounts“ (Privacy Toggle, z.B. beim Screen Sharing)

---

## 9) Datenmodell (High-Level)

**Subscription**
- id, name, amount, interval, startDate, nextPaymentDate, category, tags[], notes, cancelByDate

**IncomeEntry**
- id, amount, date, source, tags[], notes, recurringRule?

**Settings**
- theme, accentColor, blur, currency, dateFormat, advancedMode, privacyHideAmounts

---

## 10) Interaktionskonzept

- Dashboard-Karten sind klickbar → Deep Link ins Tool mit Filter
- Segmented Controls für Monat/Jahr wechseln sofort (ohne Reload)
- Statistiken: Filterbar oben (Zeitraum, Kategorie/Quelle)
- Drawer für „Details“ statt neue Seiten (ruhiger Flow)

---

## 11) Visual System (Design Tokens)

- Spacing: 4/8/12/16/24/32
- Radius: 12–20 (Cards), 10 (Inputs)
- Shadow: 2 Stufen (subtle, hover)
- Colors:
  - Neutral base (hell/dunkel)
  - 1 Accent (user-defined)
  - Status: success/warn/error (dezent)

---

## 12) Roadmap-Ideen (Post-MVP)

- Expense-Tracker (Ausgaben) + Budget
- Netto-Saldo (Income – Subs – Expenses)
- Ziele (Savings Goals)
- Forecast (Abo + Einkommen Projektion)
- Multi-Profile (Privat/Business)
- Sync/Backup + Login (optional)

---

## 13) Erfolgskriterien (Was „gut“ aussieht)

- User findet in < 10 Sekunden: „Was kosten meine Abos monatlich?“
- Daten hinzufügen in < 20 Sekunden
- Dashboard wirkt ruhig, nicht überladen
- Mobile fühlt sich wie native App an (smooth, tappable, quick)

---

## Kurz-Fazit

**financify.io** ist ein „Finance Hub“ im cleanen Apple-Look:  
Abo-Tracker + Zinsrechner + Einkommen-Übersicht, ergänzt durch minimalistische Statistiken, starke Responsiveness und hochwertige QoL-Features – mit personalisierbarem Look (Blur/Accent/Theme).
