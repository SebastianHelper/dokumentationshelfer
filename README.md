# Dokumentationshelfer

Kleine Web-App fürs Smartphone, mit der Messwerte in der Steinproduktion erfasst werden.
Eine einzige Datei (`index.html`, Vanilla HTML/CSS/JS), kein Backend, gehostet über GitHub Pages:
<https://sebastianhelper.github.io/dokumentationshelfer/>

Orientiert sich am Dichterechner [block-density-qc](https://github.com/SebastianHelper/block-density-qc)
(Eingabe per −/+, gleiche Dichteformel).

## Tabs

1. **Höhe** – je Brett kleinster und größter Wert in mm (Start 209, Schritt 1 mm). Toleranz 205–213 mm
   wird farbig angezeigt.
2. **Frischdichte** – Steintyp I3/I2 (setzt das Standardgewicht 13 kg bzw. 9 kg), je Reihe ein Stein mit
   Gewicht (Schritt 0,1 kg) und Höhe (Start 209 mm): I3 vorne/hinten, I2 vorne/Mitte/hinten. Je Stein ein
   Schalter „gemessen / nicht gemessen“; nicht gemessene Steine werden leer gespeichert, mindestens einer
   muss gemessen sein. Dichte wie im Dichterechner.
3. **Brettdichte** – Brett-Layout (I3: 2 Reihen × 6, I2: 3 Reihen × 6, im Tab änderbar). Stein antippen →
   Popup mit Gewicht und Höhe, „Weiter →“ springt zum nächsten leeren Stein.

Bedienung: −/+ antippen oder gedrückt halten; auf den Wert tippen, um ihn einzutippen. Zwischen den Tabs
wischen. Jeder gespeicherte Eintrag bekommt automatisch einen Zeitstempel. Im **Verlauf** lassen sich
Einträge bearbeiten (Zeitstempel bleibt, `geaendert` wird gesetzt) und löschen; für die Höhe gibt es einen
kleinen Verlaufsgraphen.

Dichte: `Gewicht [kg] / (Höhe [mm] × Faktor)`, Faktor I2 0,031, I3 0,046; Mindestdichte I2 1,387, I3 1,358.

## Daten

- Alles liegt im Local Storage des Browsers (Schlüssel `dokumentationshelfer.v1`), auch die gerade
  eingestellten Werte und ein halb erfasstes Brett. Neuladen verliert nichts. Mehrere offene Tabs
  führen ihre Einträge zusammen.
- **Sicherung:** ☰ → „CSV herunterladen“ (oder „Teilen“). Ein roter Punkt am Menü erinnert, wenn seit über
  einer Stunde ungesicherte Einträge vorliegen.
- **Mehrere Geräte:** Jedes Gerät hat einen Namen (Spalte `geraet`) und erzeugt seine eigene CSV. Die
  CSVs lassen sich einfach aneinanderhängen und nach `zeitstempel` sortieren, oder in der App über
  ☰ → „CSV importieren“ zusammenführen (doppelte `eintrag_id` werden übersprungen). Der Import dient
  auch zur Wiederherstellung.

CSV: UTF-8 mit BOM, Trennzeichen `;`, Dezimalkomma (öffnet direkt in Excel). Eine Zeile je Messwert:

| Spalte | Inhalt |
|---|---|
| `zeitstempel` | ISO 8601 mit Zeitzone, z. B. `2026-10-13T08:15:32+02:00` |
| `geraet` | Gerätename |
| `messung` | `hoehe`, `frischdichte` oder `brettdichte` |
| `eintrag_id` | eindeutige ID des Eintrags (ein Brett = mehrere Zeilen mit derselben ID) |
| `steintyp` | `I2` / `I3` |
| `brett_nr`, `layout` | nur Brettdichte, Layout als `Reihen x Steine`, z. B. `2x6` |
| `position` | Frischdichte `vorne`/`mitte`/`hinten` (Mitte nur I2, nicht gemessen = Werte leer); Brettdichte `R1-S1` (Reihe 1 = vorne, Stein 1 = links) |
| `min_mm`, `max_mm` | nur Höhe |
| `gewicht_kg`, `hoehe_mm`, `dichte` | Frisch- und Brettdichte |
| `geaendert` | Zeitpunkt der letzten Bearbeitung, sonst leer |

## Entwicklung

`index.html` direkt im Browser öffnen. Tests (simulierter Browser mit jsdom, inkl. Neuladen):

```sh
npm install
npm test
```

GitHub Pages veröffentlicht `main` aus dem Wurzelverzeichnis.
