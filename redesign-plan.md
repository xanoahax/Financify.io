# Redesign Plan – Financify

Dieser Plan beschreibt die empfohlene Reihenfolge für das große Financify-Redesign.
Ziel ist ein kontrollierter Umbau mit möglichst wenig Regressionen und möglichst viel visueller Konsistenz.

Die inhaltliche und gestalterische Grundlage dafür liegt in `redesign-memory.md`.

---

## 1) Ziel des Redesigns

Financify soll:
- ruhiger wirken
- hochwertiger wirken
- moderner wirken
- klarer strukturiert sein
- näher an der definierten Referenzästhetik liegen

Wichtig:
- kein unkontrollierter Big-Bang-Umbau
- keine neue UI ohne System
- keine visuelle Fragmentierung zwischen Seiten

---

## 2) Grundstrategie

Das Redesign wird in klaren Phasen umgesetzt:

1. **Designsystem zuerst**
2. **App-Shell danach**
3. **Dashboard als erste Zielseite**
4. **globale Komponenten**
5. **restliche Seiten nacheinander**
6. **Login/Onboarding separat**
7. **Polish und Regression Checks ganz am Ende**

Diese Reihenfolge ist bewusst gewählt:
- zuerst die visuellen Regeln
- dann die globale Struktur
- dann die erste Showcase-Seite
- danach kontrollierte Ausbreitung auf den Rest der App

---

## 3) Phase 1 – Designsystem

Ziel:
- die neue visuelle Sprache als wiederverwendbares System aufbauen

Umfang:
- Farben / Canvas-Grundlogik
- Typografie-Hierarchie
- Radius-System
- Spacing-System
- Card-Grundstil
- Dock-/Icon-Grundformen
- Utility-Pills
- KPI-Summary-Stil

Ergebnis:
- stabile Token- und Stilbasis
- keine ad-hoc-Optik pro Seite

Wichtig:
- in dieser Phase möglichst wenig Business-Layout umbauen
- Fokus auf Grundbausteine

---

## 4) Phase 2 – App-Shell

Ziel:
- die neue äußere Struktur der App umsetzen

Umfang:
- linkes Dock statt alter Sidebar-Fläche
- Logout unten im Dock
- reduzierte obere Zone statt klassischer Topbar
- Avatar oben rechts
- Search-Icon + Plus links oben
- neue Desktop-Außenabstände
- neuer Page-Canvas

Ergebnis:
- die gesamte App fühlt sich sofort neu an
- ohne dass schon jede Seite komplett redesigniert sein muss

Wichtig:
- die Shell muss zuerst stabil sein, bevor Seitenlayouts folgen

---

## 5) Phase 3 – Dashboard

Ziel:
- erste vollständige Seite im neuen System

Umfang:
- `Welcome back!`
- KPI-Summaries oben rechts
- Search + Plus oben links
- symmetrisches 2-Spalten-Grid
- `Income trend`
- `Subscription distribution`
- `Household card`

Ergebnis:
- erste echte Referenzseite für den neuen Stil
- wichtigster Showcase für das weitere Redesign

Wichtig:
- Dashboard wird die Seite, an der wir Stilentscheidungen am besten validieren

---

## 6) Phase 4 – Globale UI-Bausteine

Ziel:
- wiederverwendbare Komponenten an den neuen Stil angleichen

Umfang:
- Card-Header
- Month-Range-Pill
- Buttons
- Dropdowns
- Inputs
- Modals
- Listen-/Overview-Blöcke
- KPI-nahe Summary-Elemente

Ergebnis:
- Seiten können auf denselben neuen Komponenten aufbauen

Wichtig:
- diese Phase reduziert spätere Inkonsistenz massiv

---

## 7) Phase 5 – Seitenweise Umstellung

Die restlichen Seiten werden kontrolliert nacheinander umgestellt.

Empfohlene Reihenfolge:

1. **Income**
2. **Subscription Tracker**
3. **Household costs**
4. **Statistics**
5. **Settings**

### Warum diese Reihenfolge?

**Income zuerst**
- hohe Relevanz
- viele Überschneidungen mit Dashboard-Logik
- Trends, Summaries und Add-Flows schon vorbereitet

**Subscription Tracker danach**
- ähnliche Verteilungs-/Trendlogik
- stark visuell strukturierbar

**Household costs**
- wichtige neue Funktion
- profitiert stark vom neuen Card-System

**Statistics**
- kann stark vom bereits redesignierten Dashboard/Card-System profitieren

**Settings**
- funktional dichter
- sollte erst umgebaut werden, wenn die neue Formensprache stabil ist

---

## 8) Phase 6 – Login und Onboarding

Ziel:
- die eigenständigen Flows separat redesignen

Umfang:
- Login Screen
- Profilauswahl
- Avatar-/Profilbereich
- Onboarding in neuer visueller Sprache

Warum separat?
- diese Bereiche haben eine andere Dramaturgie als die Haupt-App
- sie sollten nicht halb aus der App-Shell “mitgezogen” werden

Ergebnis:
- eigenständige, saubere Flows
- trotzdem konsistente Designsprache

---

## 9) Phase 7 – Polish und Qualitätssicherung

Ganz am Ende:
- Spacing-Polish
- Kontrast-Checks
- Hover-/Focus-States
- Animationen
- Icons
- deutsch/englisch prüfen
- Textlängen prüfen
- Desktop-Checks
- Build/Test/Lint

Wichtig:
- erst am Ende feinpolieren
- nicht mitten im Umbau schon Pixel-Polish verlieren

---

## 10) Technische Arbeitsweise

Empfohlene Arbeitsweise während der Umsetzung:

### Immer in kleinen Schritten
- nicht alles auf einmal umbauen
- jede Phase separat verifizieren

### Nach jeder größeren Änderung prüfen
- Build
- UI-Regressionen
- Theme-Verhalten
- deutsch/englisch

### Bestehende Logik schützen
- Redesign heißt zuerst visuelle + strukturelle Verbesserung
- keine unnötigen Funktionsänderungen, wenn sie nicht Teil des Plans sind

### Desktop priorisieren
- Fokus bleibt die Desktop-App
- Mobile wird in diesem Redesign bewusst nicht zuerst optimiert

---

## 11) Konkrete Reihenfolge für die tatsächliche Umsetzung

Wenn wir loslegen, wäre die genaue Arbeitsreihenfolge:

1. neue Design-Tokens und globale CSS-Variablen
2. Dock + Top-Zone + Canvas
3. neue Card-Basis
4. KPI-Summary-Komponente
5. Dashboard komplett
6. globale Inputs / Pills / Dropdowns / Modals
7. Income
8. Subscription Tracker
9. Household costs
10. Statistics
11. Settings
12. Login
13. Onboarding
14. Final Polish

---

## 12) Erfolgskriterium

Das Redesign ist erfolgreich, wenn:
- die App sofort konsistenter wirkt
- das Dashboard klar als neue Referenzseite funktioniert
- Seiten nicht wie zufällig neu gestylte Altansichten wirken
- die Bedienung einfacher und ruhiger wird
- bestehende Kernfunktionen stabil bleiben

