# Redesign Memory – Financify

Dieses Dokument ist die laufende Gestaltungs-Referenz für das große Redesign von Financify.
Es dient als Memory, damit visuelle Entscheidungen konsistent bleiben und spätere UI-Arbeit nicht vom Stilziel abweicht.

---

## 1) Gewählte Designrichtung

Auswahl: **Option 1**

**Richtung:** neutral, edel, ruhig, modern  
**Nicht gewollt:** buntes SaaS-UI, zu technische Admin-Optik, bläulicher Dark Mode

Die App soll sich hochwertiger, ruhiger und stärker wie ein persönlicher Finanz-Hub anfühlen.
Der Stil orientiert sich grob am referenzierten Screenshot, wird aber an Financify angepasst und nicht blind kopiert.

---

## 2) Farbwelt – Grundentscheidung

### Primäre Strategie
- **Neutrale Basisfarben**
- **Kontrollierte Akzentfarbe**
- **Farbe vor allem für Daten, Zustände und Fokus**

### Gewünschte Wirkung
- ruhig
- hochwertig
- klar
- erwachsen
- modern

### Vermeiden
- zu viele laute Farben gleichzeitig
- bläuliche Grautöne im Dark Mode
- grelle UI-Flächen außerhalb von Charts und gezielten Akzenten
- harte, sterile Schwarz-Weiß-Kontraste ohne Tiefe

---

## 3) Farbrollen

Die Farbwelt wird in vier Ebenen gedacht:

### A. Basisfarben
Für:
- App-Hintergrund
- Panels
- Oberflächen
- Modals
- Inputs
- Borders
- Text / Muted Text

Ziel:
- neutral
- leicht weich
- gute Lesbarkeit
- starke Ruhe im Gesamtbild

### B. Akzentfarbe
Für:
- Primäraktionen
- aktive Navigation
- Fokuszustände
- ausgewählte Controls
- wichtige CTAs

Ziel:
- klar sichtbar
- aber nicht überall dominant

### C. Datenfarben
Für:
- Charts
- Verteilungen
- Trends
- Kategorien
- Income / Costs / Household Splits

Ziel:
- lebendiger als die Basis-UI
- aber systematisch und lesbar

### D. Semantikfarben
Für:
- Erfolg
- Warnung
- Fehler
- Info

Ziel:
- eindeutig
- barrierearm
- nicht mit Chartfarben kollidierend

---

## 4) Visuelle Leitlinien aus dem Referenzstil

### Flächen
- große, weiche Panels
- ruhige Oberflächen
- wenig harte Trennlinien
- subtile Layer statt harter Box-Optik

### Sidebar
- elegante Navigation statt Adminpanel-Gefühl
- ikonischer, klarer, ruhiger
- aktive Zustände deutlich, aber nicht schwer

### Typografie
- starke Headlines
- klare Zahlenhierarchie
- Labels kleiner und ruhiger
- weniger Text, mehr Ordnung

### Datenvisualisierung
- Charts dürfen lebendiger sein als die restliche UI
- UI bleibt neutral, Daten dürfen Farbe tragen

---

## 5) Zielbild für Financify

Financify soll nach dem Redesign:
- ruhiger wirken
- hochwertiger wirken
- visuell konsistenter wirken
- moderner wirken
- in Dark Mode neutral statt blau wirken
- trotzdem funktional und dicht genug für Finanzdaten bleiben

---

## 6) Redesign-Reihenfolge

Um Risiko zu kontrollieren, wird das Redesign nicht als Big Bang umgesetzt.

### Reihenfolge
1. Farbwelt
2. Typografie
3. Radius / Spacing / Shadow-System
4. App-Shell (Sidebar, Topbar, Page-Container)
5. Card-System
6. Dashboard
7. Formulare und Modals
8. restliche Seiten einzeln

---

## 7) Aktueller Status

Bereits entschieden:
- Farbstrategie: **Option 1**
- Richtung: **neutral, edel, ruhig**
- Dark Mode soll **neutral** sein, nicht bläulich
- Redesign soll **kontrolliert** und **seitenweise** passieren

Noch offen:
- exakte Light-Mode-Palette
- exakte Dark-Mode-Palette
- Akzentfarbe
- Datenfarben
- Semantikfarben
- Typografie-System

---

## 8) Shell-Entscheidungen

### Farbpalette
- Die konkrete Farbpalette bleibt zunächst **nah am Stil des Referenzbildes**.
- Die genauen Hex-Werte müssen jetzt noch nicht finalisiert werden.
- Wichtig ist vorerst das **Verhältnis der Flächen**:
  - ruhiger Hintergrund
  - weiche, helle Hauptfläche im Light Mode
  - neutraler, dunkler Hauptaufbau im Dark Mode
  - subtile Atmosphäre statt harter Kontraste

### Dark Mode
- Auch im Dark Mode sollen die **Verhältnisse** des Referenzstils erhalten bleiben:
  - klar erkennbare Layer
  - ruhiger Hintergrund
  - leicht abgesetzte Flächen
  - kein bläulicher Dark Mode
- Die exakten Dark-Mode-Farben werden im Verlauf des Redesigns feinjustiert.

### Sidebar
- Die Sidebar soll **dockartig** wirken.
- Sie ist **kein eigener Container** und keine volle Spalte.
- Sichtbar sind primär die **runden Seitenicons**.
- Zielgefühl:
  - ruhig
  - kompakt
  - elegant
  - ikonisch

### Sidebar-Inhalt
- Navigation über runde, vertikal angeordnete Icons
- keine schwere Hintergrundfläche hinter der Sidebar
- unten zusätzlich ein **Abmelden-Button**
- Profilwechsel findet **nicht** in der Sidebar statt

### Topbar
- Die Topbar soll **kein eigener schwerer Container** sein.
- Sie ist eher eine lose obere Funktionszone innerhalb der Hauptfläche.
- Ziel:
  - weniger „Admin-Dashboard-Leiste“
  - mehr offene, integrierte Arbeitsfläche

### Topbar-Inhalt
- In der Topbar befindet sich nur das **Profilicon**
- Beim Klick auf das Profilicon öffnet sich ein Menü mit:
  - anderen Accounts / Profilen
  - Einstellungen
- Die Topbar bleibt dadurch sehr reduziert und ruhig
- Das Profilicon ist **nur der Avatar**
- **keine Border**
- keine zusätzliche Button-Einfassung im Ruhezustand

### Avatar-Menü-Struktur
- Im geöffneten Menü steht oben der **aktive Avatar**
- Darunter folgen die **anderen Profile / Accounts**
- **Settings** sitzt **ganz unten** im Menü
- **Logout** bleibt vorerst unten in der Sidebar / im Dock und wandert nicht ins Avatar-Menü

---

## 9) Shell-Spacings

Diese Werte sind die erste verbindliche Desktop-Basis für die neue App-Shell.

### Desktop-Außenabstände
- **Viewport padding:** `28px`
- **Dock links:** `22px`
- **Dock oben/unten:** `28px`
- **Abstand Dock → Content-Start:** `20px`

### Begründung
- genug Luft für einen hochwertigen, ruhigen Eindruck
- keine gequetschte Fensteroptik
- Sidebar-Dock kann sichtbar „floaten“
- der Seiteninhalt bekommt genug Bühne ohne zusätzlichen Full-Page-Wrapper

### Priorisierung
- Das Redesign wird primär **desktop-first** gedacht.
- Mobile wird für diese große Neugestaltung vorerst **nicht priorisiert**.
- Zielkontext ist in erster Linie die Desktop-App.

---

## 10) Seitenarchitektur-Korrektur

Wichtige Klarstellung:

- Es gibt **keine große Main Surface als zusätzliche Fläche auf einer weiteren Fläche**.
- Das referenzierte Layout zeigt bereits die **eigentliche Seite**.
- Wir bauen also **kein** Schema wie:
  - App-Hintergrund
  - große zentrale Wrapper-Fläche
  - Karten innerhalb dieser Wrapper-Fläche

### Stattdessen gilt

Die neue Shell besteht aus:

1. **Page Canvas**
   - die eigentliche Seite
   - mit Hintergrundcharakter und definierten Außenabständen

2. **Dock-Navigation**
   - links freistehend
   - kein eigener Spalten-Container

3. **Top-Zone**
   - oben rechts reduziert
   - ohne eigenen Topbar-Container

4. **Content Grid**
   - direkt auf dem Canvas komponiert

5. **Cards**
   - die primären Flächenobjekte der UI
   - nicht eingebettet in einen zusätzlichen Full-Page-Surface-Wrapper

### Begriffskorrektur

Der bisherige Begriff **Main Surface** war an dieser Stelle missverständlich.

Richtig ist:
- **Page Canvas** = die Seite selbst
- **Cards** = die eigentlichen Flächen

### Gestalterische Konsequenz

- weniger Verschachtelung
- weniger „Fläche auf Fläche“
- luftigeres, moderneres Layout
- näher am Stil der Referenz

---

## 11) Page Canvas

### Grundidee
- Der **Page Canvas** ist die eigentliche Seite.
- Er trägt die Grundstimmung der App.
- Er soll ruhig, hell und hochwertig wirken.

### Light Mode
- sehr heller neutraler Grundton
- darüber ein **ganz leichter blasser Mint-Gradient**
- der Gradient ist **atmosphärisch**, nicht dekorativ laut
- er soll eher gespürt als bewusst wahrgenommen werden

### Dark Mode
- neutral dunkler Grund
- dieselbe Logik mit einem **sehr subtilen mintigen Hauch**
- keine bläuliche Dunkelbasis
- keine grelle Farbwirkung im Hintergrund

### Rolle des Minttons
- der Mintton ist **nicht** die Akzentfarbe
- er ist **Atmosphäre**
- er dient dazu, die Seite weicher, frischer und lebendiger wirken zu lassen

### Vermeiden
- zu sichtbare oder harte Verläufe
- starke Sättigung im Hintergrund
- dekorative Effekte, die mit Content konkurrieren
- Hintergründe, die Charts oder Text optisch überholen

---

## 12) Cards

### Grundrolle
- Cards sind die primären Flächenobjekte der UI.
- Sie tragen Inhalte, Kennzahlen, Charts, Listen und Aktionen.
- Sie sollen ruhig, weich und hochwertig wirken.

### Formensprache
- **Card radius:** `26px`
- **Innenabstand:** `26px`
- **Gap zwischen Cards:** `20px` bis `24px`
- keine harte Border
- sehr subtile, weiche Tiefenwirkung statt sichtbarer Box-Optik

### Materialcharakter
- matter, heller Hintergrund im Light Mode
- neutral-dunkler, ruhiger Hintergrund im Dark Mode
- nicht glassig
- nicht technisch-panelartig

### Card-Typen
- **KPI-nahe Summary-Elemente**: stehen nicht zwingend als eigene große Cards im Grid
- **Distribution Card**: eigene Card für Verteilungen / Zusammensetzungen
- **Trend Card**: eigene Card für Zeitverläufe / Entwicklung
- weitere Content Cards für Listen, Tabellen oder Detailmodule

---

## 13) Top-Zone über den Cards

Die Zone oberhalb des eigentlichen Card-Grids wird klar strukturiert und bleibt sehr reduziert.

### KPI-Bereich
- Die **3 wichtigsten KPI-Infos** stehen **rechts oben über den Cards**
- ähnlich wie im Referenzbild
- Die konkreten KPIs sind **seitenabhängig** und zeigen immer die wichtigsten Werte der jeweiligen Seite.
- Es gibt also **kein global fixes KPI-Set** für die ganze App.

Diese KPIs sind keine schweren Dashboard-Boxen, sondern eigenständige Summary-Elemente mit starker Zahlenhierarchie.

### Search
- Die Suche erscheint **nicht als breite Suchleiste**
- stattdessen nur als **Lupe ohne Kreis**
- Position:
  - **links über den Cards**
  - auf derselben Höhe wie die KPI-Summary rechts

### Quick Actions
- Links neben dem Search-Icon steht vorerst **nur eine einzige kreisförmige Quick Action**
- diese Quick Action ist das **Plus**
- Search bleibt als einzige obere Aktion **ohne Kreis**
- Die restlichen Actions verwenden die runde Dock-/Utility-Formensprache

Diese Quick Actions sind bewusst in der oberen Aktionszone gebündelt, damit sie schnell erreichbar sind, ohne eine dominante Topbar aufzubauen.

### Zielbild
- links: Quick Actions + Search-Icon
- rechts: 3 KPI-Summaries
- darunter: Card-Grid

### Kontextlogik für Plus-Aktionen
- Das **Plus** klappt je nach Seite unterschiedliche Aktionen auf
- Die angebotenen Optionen sind also **seitenabhängig**

Beispiel:
- **Income-Seite**
  - `Add income`
  - `Add shift`

- **Subscription Tracker**
  - Plus öffnet direkt das `Add subscription`-Modal

- **Household costs**
  - `Add cost`
  - `Add member`
  - `Add external payer`
  - `Add household`

Ziel:
- keine globale überladene Add-Liste
- stattdessen kontextbezogene Schnellaktionen passend zur aktuellen Seite

---

## 14) KPI-Summary-Gestaltung

### Grundprinzip
- KPI-Summaries orientieren sich gestalterisch **so nah wie sinnvoll am Referenzbild**
- sie wirken leicht, frei und typografisch
- sie sind **keine eigenen Cards**

### Aufbau pro KPI
Jede KPI besteht aus:

1. **Label**
   - klein
   - ruhig
   - muted
   - klar lesbar

2. **Wert**
   - groß
   - stark
   - visuell dominant
   - wichtigste Typo in diesem Block

3. **optionale kleine Pill**
   - für Zusatzinfo wie Delta, Forecast, Zeitraum oder Sekundärwert
   - weich
   - klein
   - unaufdringlich

### Materialcharakter
- keine Card-Fläche
- keine harte Border
- kein eigener Schatten
- keine überladene Deko
- Wirkung primär über Typografie und Abstand

### Ausrichtung
- drei KPI-Summaries in einer horizontalen Reihe
- sauber ausgerichtet
- genug Luft zwischen den Gruppen
- eher wie kuratierte Highlights als wie eine Tabelle

### Farbverhalten
- UI bleibt ruhig
- Labels sind neutral / muted
- Werte klar und dominant
- optionale Pill nur subtil
- keine lauten KPI-Flächen

### Inhaltsregel
- Die KPI-Summaries sind **immer pro Seite individuell**
- Beispiel:
  - Dashboard: übergreifende Finanz-KPIs
  - Income: einkommensbezogene KPIs
  - Subscription Tracker: Abo-KPIs
  - Household costs: Haushalts-KPIs

### Vermeiden
- KPI-Boxen mit eigenem Card-Look
- zu viele Icons
- starke Hintergründe
- zu viele Zusatzinfos gleichzeitig
- KPI-Bereiche, die wie Tabellen oder Admin-Widgets wirken

### Dashboard – konkrete Startbelegung

Für das Dashboard werden die 3 KPI-Summaries zum Start wie folgt belegt:

1. **Income vom aktuellen Monat**
   - mit zusätzlicher kleiner Pill:
   - **Delta zum Durchschnitt**

2. **Subscription total per month**

3. **Household total per month**

Diese Belegung ist die erste verbindliche Dashboard-Variante für das Redesign.

---

## 15) Dock-Geometrie

### Grundidee
- Das Dock ist **keine Sidebar-Fläche**, sondern eine vertikale Reihe einzelner runder Buttons.
- Es wirkt wie ein ruhiges Werkzeug-Dock am linken Rand.

### Geometrie
- **Dock-Button-Größe:** `54px`
- **Icon-Größe:** `19px`
- **Abstand zwischen Nav-Buttons:** `12px`
- **Form:** voller Kreis

### Zustände
- **Aktiver Zustand:** gefüllter Kontrastkreis
- **Inaktive Zustände:** ruhig, neutral, zurückhaltend
- keine harte Outline als Hauptindikator
- Fokus soll über Fläche und Kontrast funktionieren

### Positionierung
- links freistehend mit den bereits definierten Außenabständen
- vertikal klar organisiert
- eher im oberen bis mittleren Seitenbereich verankert

### Logout
- der **Logout-Button** sitzt unten separat
- gleicher Durchmesser wie die Navigationsbuttons
- gleiche Formensprache
- mit spürbar mehr Abstand zur eigentlichen Navigation

### Vermeiden
- ovale Buttons
- zu kleine oder zu enge Buttons
- alte Sidebar-Optik
- farbige Icons in allen Zuständen
- Aktivzustände nur über Rand oder Outline

---

## 16) Seitenkopf-Logik

### Dashboard
- Oben auf dem Dashboard steht eine begrüßende Headline im Stil von:
  - `Welcome back!`
- Das Dashboard darf dadurch etwas editorialer und persönlicher wirken.

### Restliche Seiten
- Alle anderen Seiten verwenden **einfach den jeweiligen Seitentitel**
- keine zusätzliche Begrüßungslogik
- keine unnötige Hero-Inszenierung

### Ziel
- Dashboard fühlt sich wie Startpunkt an
- restliche Seiten bleiben klar, ruhig und funktional

### Dashboard – erste Inhaltsbelegung
- KPI-Summaries:
  - **Income vom aktuellen Monat**
  - **Subscription total per month**
  - **Household total per month**
- Beim Income-KPI gibt es zusätzlich eine kleine Pill mit:
  - **Delta zum Durchschnitt**

- Erste Dashboard-Cards:
  - **Income trend**
  - **Subscription distribution**

### Restliche Seiten
- Für die restlichen Seiten bleibt die inhaltliche Logik **vorerst wie aktuell**
- Das Redesign fokussiert sich zunächst auf die neue visuelle Sprache und die Dashboard-Struktur

---

## 17) Typografie-Richtung

### Grundrichtung
- Die Typografie orientiert sich **nah am Referenzbild**
- Sie soll modern, ruhig, freundlich und hochwertig wirken
- Nicht technisch, nicht verspielt, nicht überdekoriert

### Gewünschter Schriftcharakter
- klar
- modern
- weich genug für große Headlines
- stark bei Zahlen
- gut lesbar in UI-Labels und Controls

### Typografische Wirkung
- Headlines dürfen deutlich und präsent sein
- Zahlen sollen visuell stark und hochwertig wirken
- Labels und Meta-Informationen bleiben ruhig und zurückhaltend
- Hierarchie entsteht primär über:
  - Größe
  - Gewicht
  - Luft
  - Klarheit

### Ziel pro Ebene
- **Dashboard-Headline:** groß, fett, freundlich, editorialer
- **Seitentitel:** klar, stark, aber nüchterner als das Dashboard
- **KPI-Werte:** präsent, dominant, ruhig gesetzt
- **Card-Titel:** kompakt, klar, semibold bis bold
- **Sekundärtext / Labels:** muted, ruhig, aber nicht zu dünn

### Vermeiden
- ultradünne Schrift
- technisch-kühle Fintech-Anmutung
- zu viele verschiedene Font-Weights
- sehr kleine oder blasse Labels
- alles gleich laut und gleich fett

---

## 18) Card-internes Layout

### Grundprinzip
- Cards sollen innen sehr klar, ruhig und großzügig organisiert sein.
- Inhalt darf nie gequetscht wirken.
- Die Card-Struktur soll lesbar sein, ohne technisch oder formularartig zu wirken.

### Standardaufbau
Jede inhaltliche Card folgt grundsätzlich dieser Reihenfolge:

1. **Card Header**
   - Titel links
   - optionale Utility-Actions rechts

2. **kleiner Abstand unter dem Header**
   - genug Luft, damit Titel und Inhalt nicht kollidieren

3. **Card Content**
   - Chart, Liste, Werteblock oder Verteilung

4. **optionaler Footer / Secondary Row**
   - nur wenn inhaltlich nötig

### Header
- Card-Header bleiben ruhig und reduziert
- keine schwere Toolbar-Optik
- Titel links klar priorisiert
- Utility-Buttons rechts klein, rund und leicht
- keine harte Unterstreichung oder Trennlinie unter dem Header

### Header-Abstände
- Titel darf nicht zu nah am oberen Rand sitzen
- zwischen Titel und Inhalt muss sichtbar Luft bestehen
- Header und Actions sollen gemeinsam ruhig in einer Zeile sitzen

### Utility-Actions
- pro Card vorerst **nur eine einzige Utility-Action**
- diese Utility-Action ist ein **Month-Range-Pill-Setting**
- keine zusätzlichen Overflow-, Filter- oder Mehrfach-Action-Buttons in der Standard-Card
- Wirkung:
  - ruhig
  - reduziert
  - konsistent
  - näher am Referenzstil

### Month-Range-Pill
- sitzt rechts im Card-Header
- weich, rund, leicht
- klar als sekundäres Steuer-Element lesbar
- dient zur Auswahl des zeitlichen Bezugs der Card
- bleibt optisch deutlich ruhiger als ein Primärbutton

### Feste Optionen
Die Month-Range-Pill verwendet vorerst appweit dieselben 3 Optionen:

- `This month`
- `Last 6 months`
- `Last year`

Diese drei Optionen sind die Standardbasis für Trend- und Verteilungs-Cards.

### Content-Abstände
- Charts, Listen und Kennzahlen brauchen großzügige Innenabstände
- keine enge Stapelung
- keine visuelle Kollision mit Header oder Actions

### Card-Typen im Inneren

#### Trend Card
- klarer Header
- darunter viel ruhige Fläche für den Chart
- Legenden / Sekundärinfos nur kontrolliert

#### Distribution Card
- Header oben
- darunter klare Aufteilung zwischen Visualisierung und Legende / Breakdown
- keine enge Verdichtung

#### List / Overview Card
- Titel oben
- dann klar gegliederte Zeilen oder kompakte Module
- keine Tabellenoptik, wenn sie nicht nötig ist

### Vermeiden
- Header direkt am Content kleben lassen
- mehrere konkurrierende Utility-Actions pro Card
- Utility-Buttons zu groß machen
- interne Divider überall einsetzen
- Cards mit mehreren konkurrierenden Ebenen überladen
- Inhalte zu dicht und technisch-panelartig anordnen

---

## 19) Dashboard-Grid

### Grundaufbau
- Der Dashboard-Card-Bereich wird **immer von zwei Cards pro Reihe geteilt**
- Das Grid bleibt **symmetrisch**
- keine bewusst ungleich breiten Hauptspalten im Standard-Dashboard

### Breitenlogik
- zwei gleichwertige Card-Spalten
- klare, ruhige Zweiteilung
- keine visuell dominante Monster-Card neben einer kleinen Nebenkarte

### Höhenlogik
- Die **Höhe der Cards darf inhaltsabhängig sein**
- also:
  - Trend-Cards dürfen höher werden
  - Distribution-Cards dürfen kompakter oder höher ausfallen
  - Listen-/Overview-Cards dürfen sich nach ihrem Inhalt strecken

### Padding
- Auch bei variabler Höhe bleibt das Innen-Padding **großzügig**
- Content darf nicht an den Card-Rand gedrückt werden
- Höhe entsteht durch Inhalt, nicht durch enge Verdichtung

### Zielwirkung
- ruhige, geordnete, symmetrische Bühne
- trotzdem lebendig genug, weil nicht jede Card exakt dieselbe Höhe erzwingen muss

### Erste Dashboard-Card-Richtung
- **Income trend**
- **Subscription distribution**
- zusätzlich eine eigene **Household Card**

### Household Card – erste Version
- vorerst bewusst kompakt und fokussiert
- zeigt zunächst nur:
  - **monthly cost**
  - **member count**

Diese Card wird als eigener Haushalt-Überblick auf dem Dashboard vorgesehen und kann später erweitert werden.
