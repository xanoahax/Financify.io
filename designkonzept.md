# Designkonzept (detailliert) — financify.io
Modern, clean, „Apple-like“ UI-System für eine Finanz-Tool-Webapp: ruhig, hochwertig, extrem übersichtlich, highly responsive.

---

## 1) Design-Prinzipien (Leitlinien)

1. **Clarity first**  
   Jede Seite beantwortet eine Kernfrage sofort (z.B. „Wie viel kosten meine Abos pro Monat?“).
2. **Calm UI**  
   Wenig visuelles Rauschen: neutrale Flächen, dezente Trennlinien, sparsame Akzentfarbe.
3. **Progressive Disclosure**  
   Details nur bei Bedarf: „Details“-Drawer, Advanced-Toggles, Hover/Expand statt Volltext.
4. **Fast Interaction**  
   Quick Add, Inline Editing, Shortcuts, Undo, keine unnötigen Modals.
5. **Consistency**  
   Einheitliches Komponenten-System (Spacing, Radius, Typo, States).
6. **Responsive by design**  
   Mobile ist kein „Shrink“, sondern bewusst gestaltet (Cards statt Tabellen, Sticky Actions).

---

## 2) Brand & Visual Identity

### Markenwirkung
- **Premium + minimal** (wie Apple UI): ruhig, hochwertig, freundlich.
- **Vertrauen** durch saubere Zahlen-Layouts, klare Labels, verlässliche Mikrointeraktionen.

### Logo/Wordmark (Richtung)
- Wordmark „financify“ in lowercase, clean, mit leichter Tracking-Feinheit.
- Icon optional: abstrahierte „f“-Form oder ein minimalistischer „sparkline“-Bogen.

---

## 3) Typografie-System

### Schriftwahl (Empfehlung)
- Primär: **Inter** (nahe an SF, web-sicher, modern)  
- Fallbacks: system-ui, -apple-system, Segoe UI, Roboto

### Typo-Hierarchie (Beispiel)
- **H1 / Page Title:** 28–32px / 700
- **H2 / Section Title:** 18–20px / 600
- **Body:** 14–16px / 400–500
- **Label / UI Micro:** 12–13px / 500
- **Number Emphasis:** gleiche Schrift, aber 600 + tabular-nums

**Regel:** Zahlen immer mit **tabular lining** (gleich breite Ziffern) für saubere Spalten.

---

## 4) Grid, Spacing & Layout-Rhythmus

### Spacing Tokens
- 4, 8, 12, 16, 24, 32, 48, 64

### Container/Content Breite
- Max Content: 1120–1200px
- Page Padding:
  - Mobile: 16px
  - Tablet: 24px
  - Desktop: 32px

### Layout-Grundstruktur
- **Desktop:** Sidebar (links) + Content (rechts)
- **Tablet:** Sidebar als Icon-Rail + Content
- **Mobile:** Bottom Nav oder Top Nav + Drawer Sidebar

---

## 5) Farbkonzept (Apple-clean)

### Neutrals (Basis)
- Hintergrund: sehr helles Off-White (Light) / tiefes Graphite (Dark)
- Cards: leicht abgehoben (Ton-in-Ton)
- Divider: hairline (1px) mit sehr geringer Opacity

### Akzentfarbe (User-defined)
- 1 Akzent für CTA, Fokus-Ring, Highlights, Charts (sparsam)
- Presets: Blue, Mint, Purple, Orange, Graphite

### Statusfarben (dezent)
- Success / Warning / Error nur für States, nicht als Deko.

**Wichtig:** Charts bleiben neutral, Akzent nur als Key-Highlight (z.B. „this month“).

---

## 6) Light/Dark Mode & Blur System

### Theme
- Light / Dark / System
- Kontrast ausreichend, aber nicht „hart“.  
- Text: Primary, Secondary, Tertiary Levels.

### Blur (Setting: On/Off)
- Blur betrifft:
  - Sidebar Background
  - Topbar
  - Modals/Drawers
- Wenn Blur OFF: gleiche Flächen als solide „frosted“ Farbe.

**Rule:** Blur niemals Lesbarkeit verschlechtern → automatische Intensitätsanpassung.

---

## 7) Komponenten-Bibliothek (Core UI)

### Navigation
- **Sidebar**
  - Logo/Wordmark
  - Nav Items: Icon + Label
  - Active State: Akzent-Pill oder Left-Bar
  - Collapsed Mode: nur Icons, Labels als Tooltip
- **Topbar**
  - Page Title links
  - Quick Actions rechts: Search, Add, Settings

### Cards
- Standard Card: Header (Title + Action) + Content
- Stats Card: Zahl groß + Subtitle + Mini-sparkline optional
- Hover: minimaler Lift + Shadow Stufe 2

### Buttons
- Primary (Accent), Secondary (Neutral), Tertiary (Text)
- Icon Button (Square, 40–44px)
- Loading State + Disabled State klar

### Inputs
- Text, Number, Date, Select, Segmented, Toggle, Slider
- Focus Ring in Akzentfarbe (2px)
- Inline Validation (kleiner helper text)

### Table / List
- Desktop: Table mit sticky header (optional)
- Mobile: Table → **Stacked Cards**:
  - Title + Betrag rechts
  - Meta-Zeile (Datum/Intervall/Tag)
  - Swipe Actions optional (Delete/Edit)

### Drawer/Modal
- Drawer für „Details“ & „Add/Edit“
- Modal nur für kritische Aktionen (Delete confirm)
- Escape/Backdrop closes, klare „Cancel/Save“ Buttons

### Toasts
- Undo (nach Delete)
- Saved / Exported / Copied
- Nicht spammy: 1 Toast gleichzeitig

### Charts
- Line (Trend), Bar (Month), Donut (Category)
- Interactions:
  - Tooltip on hover/tap
  - Active point highlight
  - Filter-Chips für Zeitraum

---

## 8) Seiten-Design (Screens & Content)

## 8.1 Dashboard
**Ziel:** „At a glance“ ohne Überladung.

**Layout:**
- Row 1: 3–4 Stats Cards
  - Monatliche Abo-Kosten
  - Einnahmen (aktueller Monat)
  - Nächste Abbuchung
  - Sparrate/Trend (optional)
- Row 2: „Upcoming Payments“ (List)
- Row 3: „Insights“ (2 Karten max)
- Row 4: Quick Links (Add Abo, Add Income, Zinsrechner öffnen)

**Microcopy:** kurz, ruhig („You’re spending…“, „Next payment…“)

---

## 8.2 Abo-Tracker
**Header-Bar:**
- Segmented: Monat / Jahr
- Filter: Kategorie, Tag
- Search field
- CTA: „Add Subscription“

**Main:**
- Tabelle (Desktop) / Cards (Mobile)
- Rechts oben: Summary Card
  - Total/Monat, Total/Jahr
  - Top 3 Abos

**Details Drawer:**
- Abo Infos + Timeline (Start, Next Payment, Cancel By)
- „Mark as cancelled“ / „Pause“ (optional später)

---

## 8.3 Zinsrechner
**Split Layout Desktop:**
- Left: Inputs (Card)
- Right: Ergebnisse + Chart

**Mobile:**
- Inputs oben, Ergebnisse darunter
- „Advanced“ als collapsible Section

**Output Card:**
- Endbetrag prominent
- Eingezahlt vs. Zinsen als kleine Breakdown Chips
- Chart darunter (Line)

---

## 8.4 Einkommen-Tracker
**Header-Bar:**
- Zeitraum (Month/Year) + Source filter + Search
- CTA: „Add Income“

**Main:**
- Chart (Einnahmen pro Monat)
- List/Table darunter
- Source Breakdown Card rechts (Desktop) / darunter (Mobile)

---

## 8.5 Statistiken (Insights Hub)
**Ziel:** Deep dive, aber clean.

**Sections:**
- Spending (Subscriptions)
- Income
- Net Overview (später)
- Trends

**Filter-Leiste:**
- Zeitraum (last 30d / 6m / 12m / custom)
- Kategorie/Quelle
- Toggle: „Show comparisons“ (z.B. vs. previous period)

---

## 8.6 Einstellungen
**Layout:**
- Left: Kategorien (Appearance, Preferences, Privacy)
- Right: Settings Cards

**Appearance Settings:**
- Theme: Light/Dark/System
- Accent Color: presets + custom picker (optional)
- Blur: toggle
- Reduced motion toggle

---

## 9) Interaction Design (Microinteractions)

- Hover States subtil (Opacity + 1–2px lift)
- Segmented switch animiert weich
- Drawer slide-in mit easing (Reduced Motion respektieren)
- Save Action:
  - Button zeigt spinner
  - Erfolg: kurzer Toast + UI aktualisiert ohne reload
- Delete:
  - Soft confirm + Undo Toast 5–8s

---

## 10) Accessibility & Usability

- Kontrast: Text minimum AA
- Focus visible (immer)
- Hit targets: mind. 44px
- Keyboard:
  - Tab Reihenfolge logisch
  - Cmd/Ctrl+K Command Palette
- Zahlenformat:
  - Locale-aware (EUR, Komma/Punkt)
  - Rundung einstellbar

---

## 11) Design Tokens (konkret)

### Radius
- Card: 16–20
- Input/Button: 12–14
- Chips: 999 (pill)

### Shadow
- S1: sehr subtil (Default)
- S2: Hover/Active

### Border
- 1px hairline, 8–12% opacity

### Spacing
- Form rows: 12–16
- Section gap: 24–32
- Page gap: 32–48

---

## 12) Content Style (Ton & Text)

- Kurz, neutral, hilfreich
- Labels eindeutig: „Monthly cost“, „Next payment“
- Empty States:
  - 1 Satz Erklärung
  - 1 CTA („Add your first subscription“)

---

## 13) Beispiel-UI Patterns (konkret)

### Pattern: Summary + List
- Oben: Summary Card (Total + Breakdown)
- Unten: List/Table mit Filterbar
- Rechts: Insights Card (Top items)

### Pattern: Calculator Split
- Inputs links, Result rechts
- „Advanced“ ist einklappbar
- Export/Share optional später

---

## 14) Finaler Eindruck (Design-Ziel)

financify.io soll sich anfühlen wie:
- **ruhig** (wenig visuelles Rauschen),
- **präzise** (perfekte Zahlen-Layouts),
- **schnell** (keine Reibung im Flow),
- **premium** (Spacing, Typo, Microinteractions),
- **super responsive** (mobile-first patterns, keine „geschrumpfte Desktop-Seite“).

