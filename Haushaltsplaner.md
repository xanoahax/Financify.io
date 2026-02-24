# Haushaltsplaner – Produkt- und Umsetzungskonzept

## 1. Zielbild
Der **Haushaltsplaner** ist ein eigenes Tool in der Sidebar und bewusst getrennt vom Abo-Tracker.
Er deckt laufende Lebens- und Wohnkosten ab, unabhängig von Wohnform:
- Haus
- Mietwohnung
- Eigentumswohnung
- WG / Mehrpersonenhaushalt

Ziel ist, Fixkosten transparent zu machen und fair auf Mitglieder zu verteilen, damit alle Bewohner klar sehen, wer welchen Anteil tragen soll.

## 2. Abgrenzung zum Abo-Tracker
Der Abo-Tracker bleibt für digitale/regelmäßige Services (z. B. Streaming, Software).
Der Haushaltsplaner ist für klassische Wohn- und Lebenskosten:
- Miete / Kreditrate
- Strom, Gas, Wasser, Heizung
- Internet, Mobilfunk, TV
- Hausverwaltung / Betriebskosten
- Versicherungen rund um Haushalt/Wohnen
- Lebensmittel-Budget, Reinigung, Müll, Wartung

Regel:
- Alles, was primär den gemeinsamen Haushalt betrifft, gehört in den Haushaltsplaner.
- Alles, was ein persönliches Abo ist, bleibt im Abo-Tracker.

## 3. Hauptfunktionen (MVP+)

### 3.1 Haushalte verwalten
- Pro Profil mehrere Haushalte möglich (z. B. alte Wohnung + neues Haus).
- Ein Haushalt hat:
  - Name
  - Typ (Haus, Mietwohnung, Eigentumswohnung, WG, Sonstiges)
  - Währung
  - Abrechnungsstart (Monat/Jahr)
  - Aktiv/Archiviert

### 3.2 Mitglieder verwalten
- Mitglieder pro Haushalt mit Rolle:
  - Hauptmieter/Eigentümer
  - Mitbewohner
  - Partner
  - Kind/abhängig (optional ohne Zahlpflicht)
- Felder:
  - Name
  - Aktiv von/bis
  - Optional Kontakt
  - Optional bevorzugter Verteilungsschlüssel (falls Standard abweichend)

### 3.3 Kostenpositionen (Fixkosten + variable Haushaltskosten)
- Kostenarten:
  - Wiederkehrend (monatlich, 2-wöchentlich, wöchentlich, jährlich)
  - Einmalig
- Felder:
  - Titel
  - Kategorie
  - Unterkategorie (pflichtig innerhalb der Kategorie)
  - Betrag
  - Intervall
  - Start-/Enddatum
  - Verantwortlich (wer zahlt real)
  - Teilbar ja/nein
  - Verteilungsregel
  - Notiz
  - Status (aktiv, pausiert, beendet)

### 3.4 Kostenaufteilung unter Mitgliedern
Unterstützte Aufteilungsarten:
1. Gleichmäßig (50/50, 33/33/33, …)
2. Gewichtet (z. B. Person A 60 %, B 40 %)
3. Betragsfix (A 500 EUR, Rest B/C)
4. Benutzerdefiniert pro Kostenposition

Automatische Validierung:
- Summe der Anteile muss 100 % oder Gesamtbetrag entsprechen.
- Inaktive Mitglieder dürfen nicht neu belastet werden.
- Unterkategorie muss zur gewählten Kategorie passen.

### 3.5 Dashboard im Haushaltsplaner
Kacheln:
- Monatliche Gesamtkosten
- Anteil pro Bewohner (aktueller Monat)
- Kosten je Kategorie (Donut)
- Kosten je Mitglied (Balken)
- Trend 12 Monate

Listen:
- Kostenliste mit Filtern
- Mitgliederübersicht mit Anteil/Saldo

Anzeige-Regel:
- Jede Kostenposition zeigt immer `Kategorie · Unterkategorie` (z. B. `Energie · Strom`), damit sofort klar ist, wofür gezahlt wird.

## 4. Kategorien (Startvorschlag)
Vordefiniert, erweiterbar:
- Wohnen:
  - Miete
  - Kreditrate
  - Betriebskosten
- Energie:
  - Strom
  - Gas
  - Heizung/Fernwärme
- Wasser & Abwasser:
  - Wasser
  - Abwasser
- Internet & Kommunikation:
  - Internet
  - Mobilfunk
  - TV
- Versicherung:
  - Haushaltsversicherung
  - Gebäudeversicherung
  - Rechtsschutz
- Haushalt & Reinigung:
  - Reinigungsmittel
  - Hausservice
  - Müllentsorgung
- Lebensmittel:
  - Supermarkt
  - Haushaltswaren
- Mobilität:
  - Öffi-Ticket
  - Treibstoff
  - Parken
- Rücklagen/Instandhaltung:
  - Reparaturfonds
  - Wartung
- Sonstiges:
  - Frei definierbar

## 5. UX-Konzept

### 5.1 Navigation
Neue Sidebar-Position:
- Übersicht
- Einkommen
- Abo-Tracker
- **Haushaltskosten** (neu)
- Statistiken
- Einstellungen

### 5.2 First-Use Flow im Tool
Wenn kein Haushalt existiert:
1. „Haushalt anlegen“
2. Mitglieder hinzufügen
3. Erste Fixkosten erfassen
4. Verteilung wählen
5. Dashboard aktivieren

### 5.3 Modale Eingabe statt überladener Seite
- „Kosten hinzufügen“-Modal
- „Mitglied hinzufügen“-Modal
- „Verteilung bearbeiten“-Modal

So bleibt das Hauptpanel aufgeräumt.

### 5.4 Leichte Bedienung
- Quick Actions:
  - Kosten hinzufügen
  - Mitglied hinzufügen
- Fokus-Management wie bei bestehenden Modals (Input direkt fokussiert).
- Einheitliches Karten-Spacing wie im restlichen UI.

## 6. Datenmodell (Vorschlag)

```ts
type HouseholdType = 'house' | 'rental' | 'owned' | 'shared' | 'other'
type CostFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'one_time'
type CostStatus = 'active' | 'paused' | 'ended'
type SplitType = 'equal' | 'weighted' | 'fixed_amount' | 'custom'

interface Household {
  id: string
  profileId: string
  name: string
  type: HouseholdType
  currency: 'EUR' | 'USD'
  billingStart: string // ISO date
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

interface HouseholdMember {
  id: string
  householdId: string
  name: string
  role: string
  activeFrom: string
  activeTo: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface HouseholdCost {
  id: string
  householdId: string
  title: string
  category: string
  subcategory: string
  amount: number
  frequency: CostFrequency
  startDate: string
  endDate: string | null
  responsibleMemberId: string | null
  isShared: boolean
  splitType: SplitType
  notes: string
  status: CostStatus
  createdAt: string
  updatedAt: string
}

interface HouseholdCostSplit {
  id: string
  costId: string
  memberId: string
  sharePercent: number | null
  shareAmount: number | null
}
```

## 7. Logikregeln und Berechnung

### 7.1 Periodenberechnung
- Wiederkehrende Kosten erzeugen periodische Soll-Einträge.
- Jahresansicht zeigt auf Monatsbasis normalisierte Summen + echte Einzelperioden.

### 7.2 Verteilung
- Gleichmäßig: `Betrag / aktive Mitglieder`.
- Gewichtet: `Betrag * (Gewicht / Gewichtssumme)`.
- Fester Betrag:
  - fixe Beträge abziehen, Rest nach definierter Restregel verteilen.

### 7.3 Rundung
- Rundung auf 2 Nachkommastellen.
- Rundungsdifferenzen immer deterministisch auf letztes aktives Mitglied buchen.

## 8. Edge Cases
- Mitglied tritt mitten im Monat aus/ein.
- Kostenposition endet rückwirkend.
- Haushaltswährung wird geändert (historische Werte nicht verfälschen).
- Summe der Split-Anteile unvollständig.
- Haushalt ohne aktive Mitglieder.
- Gelöschtes Mitglied war noch in alten Splits referenziert.

Strategie:
- Weiches Löschen, Validierung vor Speichern, konsistente Fallbacks.

## 9. Backup- und Import-Konzept
- Haushaltsdaten müssen vollständig in bestehendes Profil-Backup aufgenommen werden:
  - `households`
  - `householdMembers`
  - `householdCosts`
  - `householdCostSplits`
- Export bleibt **pro Profil** (wie aktuell).
- Dateiname bleibt Schema-konform, nur Datenumfang steigt.
- Import `replace` und `merge` müssen diese Collections mit abdecken.

## 10. Berechtigungen / Schutz mit PIN-Passwort
- Ist Profil gesperrt:
  - keine Einsicht in Haushaltskosten
  - kein Export
  - kein Löschen
- Aktionen wie „Alle Haushaltsdaten löschen“ nur mit zusätzlicher Bestätigung.

## 11. Umsetzungsvorschlag in Phasen

### Phase 1 (MVP)
- Sidebar-Eintrag + leeres Tool-Gerüst
- Haushalt anlegen
- Mitglieder anlegen
- Wiederkehrende Kosten erfassen
- Einfache gleiche Kostenaufteilung
- Monatsübersicht + Kostenliste

### Phase 2
- Flexible Split-Modelle (gewichtet/fix/custom)
- Dashboard-Charts

### Phase 3
- Erweiterte Historie/Audit
- Erinnerungen (optional)
- Haushaltsvergleich (Monat-zu-Monat)
- Exportansicht pro Haushalt

## 12. UI-Qualitätskriterien
- Keine überladenen Panels: Erstellen/Bearbeiten nur per Modal.
- Einheitliche Abstände wie bestehende Kachel-Standards.
- Dropdowns und Toggle-Design konsistent mit aktueller App.
- Mobile: untere Nav mit Symbolen, Haushaltsplaner voll erreichbar.
- In Listen/Karten nie nur die Oberkategorie anzeigen, sondern immer `Kategorie · Unterkategorie`.

## 13. Erfolgskriterien
- User kann in < 3 Minuten einen Haushalt mit 2 Mitgliedern und 5 Fixkosten einrichten.
- Monatliche Gesamtkosten und Mitgliederanteile stimmen rechnerisch.
- Backup/Restore enthält alle Haushaltsdaten verlustfrei.
- Keine Vermischung mit Abo-Tracker-Daten.
