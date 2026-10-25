# GTA 7 — Entwicklungs-Roadmap 🗺️🚗💥

Dieses Dokument ist der Masterplan für **Matti**, seinen **Kumpel** und **Alexander**. Jedes Feature ist so aufgeteilt, dass es in kleinen, motivierenden Schritten programmiert, getestet und direkt im Browser gespielt werden kann.

---

## 📌 Übersicht der Entwicklungsphasen

```mermaid
flowchart LR
    P1[Phase 1: Grundlagen<br/>✅ Fertig] --> P2[Phase 2: Lebendige Stadt<br/>🚀 Live & Vertiefung]
    P2 --> P3[Phase 3: Waffen & Action<br/>📋 Nächster Fokus]
    P3 --> P4[Phase 4: Missionen & Tuning<br/>📋 Geplant]
    P4 --> P5[Phase 5: P2P Multiplayer<br/>🌟 Vision]
```

---

## ✅ Phase 1: Fundament & Open-World-Setup (Abgeschlossen)
* [x] Three.js 3D-Rendering mit Schatten & physikalischem Antialiasing
* [x] Arcade-Fahrphysik mit Driften (Leertaste), Bremsen und Rückwärtsgang
* [x] Spielfigur zu Fuß steuerbar (WASD + Sprinten)
* [x] Verfolger- und Weitwinkel-Kamera mit dynamischem Zoom
* [x] 5-Sterne Fahndungssystem (⭐) mit Jagd-Polizeiwagen & Blinklichtern
* [x] City-Grid mit Straßenmarkierungen, Wolkenkratzern und Sprungschanzen
* [x] Cyber-HUD mit digitalem Tachometer, Schadensbalken und Minimap-Radar
* [x] Web Audio API Synthesizer (Motorensound, Hupe, Sirene, Crash)
* [x] Automatisierte GitHub Actions CI/CD Pipeline auf GitHub Pages

---

## 🚀 Phase 2: Lebendige Stadt & Gangster-Feeling (Aktuelle Phase)

| Meilenstein | Beschreibung | Status |
|---|---|---|
| **M2.1 Kalifornische Beleuchtung** | Frisches, klares Tageslicht mit blauem Himmel, warmen Sonnenstrahlen und scharfen Schatten für optimale Sicht | ✅ Erledigt |
| **M2.2 Ziviler Stadtverkehr (Traffic)** | Bunte NPC-Autos (Taxis, Limousinen, SUVs, Pickups), die auf den Straßen fahren, anhalten und gecrasht werden können | ✅ Erledigt |
| **M2.3 Passanten auf Gehwegen** | Zivilisten mit Geh-Animationen, die panisch ausweichen, wenn man hupt oder auf sie zurast | ✅ Erledigt |
| **M2.4 Echtes Car-Jacking** | Der Spieler kann an JEDES vorbeifahrende Auto/Taxi herantreten, den Fahrer rauswerfen und den Wagen klauen | ✅ Erledigt |
| **M2.5 Straßensperren & SWAT** | Bei 4 bis 5 Fahndungssternen errichten Polizisten Straßensperren quer über Kreuzungen | 📋 Next |
| **M2.6 Pay 'n' Spray Werkstatt** | Eine Lackierwerkstatt in der Stadt: Reinfahren, umlackieren und die Polizeisterne sofort loswerden | 📋 Next |

---

## 🔫 Phase 3: Waffen, Ballern & Zerstörung

Ziel: Den Waffenladen mit echter Action füllen!

| Meilenstein | Beschreibung | Priorität |
|---|---|---|
| **M3.1 Nahkampf & Faustschlag** | Passanten und Autos per Mausklick / Leertaste mit Faust oder Baseballschläger attackieren | Hoch |
| **M3.2 Pistole & Fadenkreuz** | Schnelle Projektile mit Mündungsfeuer, Treffer-Funken und Schuss-Sounds | Hoch |
| **M3.3 Drive-by-Shooting** | Aus dem fahrenden Auto schießen und gegnerische Reifen oder Motoren zersieben | Mittel |
| **M3.4 RPG Raketenwerfer & Explosionen** | Dicke Feuerball-Explosionen, die Autos in die Luft schleudern | Hoch |
| **M3.5 Hubschrauber bei 5 Sternen** | Ein Polizeihubschrauber mit Suchscheinwerfer kreist über dem Spieler | Mittel |

---

## 🏆 Phase 4: Missionen, Tuning-Garage & Mini-Games

Ziel: Noch mehr Möglichkeiten, um an fette Kohle ($) zu kommen!

| Meilenstein | Beschreibung | Priorität |
|---|---|---|
| **M4.1 Interaktive Taxi-Missionen** | Passanten winken am Straßenrand, steigen ein und wollen zu einer bestimmten Adresse gebracht werden | Hoch |
| **M4.2 Stunt-Schanzen-Highscore** | Weitsprung-Messung bei den Schanzen: Jeder Meter Airtime bringt Extra-Dollar | Mittel |
| **M4.3 Checkpoint-Straßenrennen** | Rennen gegen die Zeit oder gegen KI-Sportwagen durch die Innenstadt | Hoch |
| **M4.4 Tuning-Werkstatt (Garage)** | Spoiler montieren, neonfarbene Unterbodenbeleuchtung, Nitro-Boost einbauen | Hoch |

---

## 🌐 Phase 5: P2P WebRTC Multiplayer (Zusammen spielen!)

Ziel: Wie in *Mattis Abenteuer* können Matti und sein Kumpel gemeinsam über das Internet auf einem Server cruisen!

* **PeerJS WebRTC:** Direkte Peer-to-Peer Verbindung ohne teure Serverkosten.
* **Host / Join Menü:** Einer drückt auf "Spiel erstellen", gibt dem Kumpel den 5-stelligen Raumcode.
* **Gemeinsam zocken:** Synchronisierte Autos, gegenseitiges Rammen, Verfolgungsjagden und Polizei-Flucht zu zweit!

---

## 💡 Wie Matti & sein Kumpel ein neues Feature einbauen:
1. Feature aus der Roadmap aussuchen.
2. Branch erstellen: `git checkout -b feat/mein-feature`
3. Coden & lokal testen: `npm run dev`
4. Testen & Bauen: `make ci`
5. Pushen & PR erstellen: GitHub Actions aktualisiert die Live-Website automatisch!
