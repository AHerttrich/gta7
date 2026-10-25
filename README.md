# GTA 7 🚗💨🏙️

[![CI](https://github.com/AHerttrich/gta7/actions/workflows/ci.yml/badge.svg)](https://github.com/AHerttrich/gta7/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/badge/play-live%20demo-brightgreen)](https://AHerttrich.github.io/gta7/)

> **GTA 7** — The open-world 3D browser action and driving sandbox created by Matti and his buddy. Cruise through a procedural neon city, drift sports cars, jump off stunt ramps, and evade the cops!

---

## 🎮 Play Online

Once deployed via GitHub Actions, play instantly in any browser:
👉 **[Play GTA 7 Live on GitHub Pages](https://AHerttrich.github.io/gta7/)**

---

## ✨ Features

| Feature | Description | Status |
|---|---|---|
| **🏎️ Arcade Driving Physics** | Smooth acceleration, steering, drifting with handbrake, reverse, and suspension bounce | ✅ Included |
| **🏙️ Procedural 3D City** | Multi-block metropolis with multi-lane roads, sidewalks, trees, street lights, and illuminated skyscrapers | ✅ Included |
| **🎥 Dynamic Chase Camera** | Spring-arm camera with smooth follow, corner swing, and multi-angle views (`C` key) | ✅ Included |
| **⭐ Wanted Level System** | 5-Star wanted system with HUD stars and cop response mechanics | ✅ Included |
| **🧭 Radar Minimap** | Real-time top-down 2D radar with car location, heading indicator, and city block layout | ✅ Included |
| **⚡ Cyber HUD** | Speedometer ($km/h$), automatic gear indicator, controls helper, and mission banner | ✅ Included |
| **🔊 Procedural Web Audio** | Dynamic engine pitch, tire screech, and horn honk synthesized via Web Audio API (no audio files needed) | ✅ Included |
| **🚀 Instant Browser Loading** | Zero gigabyte downloads — pure Three.js procedural graphics and fast Vite bundling | ✅ Included |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Language** | TypeScript (ES2022) |
| **3D Engine** | Three.js |
| **Build & Dev Tool** | Vite 6 |
| **Testing** | Vitest + Coverage V8 |
| **Linting & Code Style** | ESLint + Prettier |
| **CI / CD** | GitHub Actions (CI on PR/Push, Auto-deploy to GitHub Pages) |

---

## 🕹️ Controls

| Key | Action |
|---|---|
| `W` / `Arrow Up` | Throttle forward |
| `S` / `Arrow Down` | Brake / Reverse |
| `A` / `Arrow Left` | Steer left |
| `D` / `Arrow Right` | Steer right |
| `Space` | Handbrake & Drift |
| `H` | Honk horn |
| `C` | Switch camera angle |
| `L` | Toggle headlights |
| `R` | Reset car orientation |
| `M` | Mute / Unmute audio |
| `1` – `5` | Set wanted level stars |

---

## 🚀 Quick Start for Developers

```bash
# 1. Clone the repository
git clone https://github.com/AHerttrich/gta7.git
cd gta7

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev

# 4. Open in your browser
# http://localhost:3000
```

---

## 🧪 Development & CI Commands

Using `make` or `npm`:

```bash
make dev      # or: npm run dev
make test     # or: npm run test
make lint     # or: npm run lint
make format   # or: npm run format
make ci       # or: npm run build (verifies entire build)
```

---

## 📁 Project Structure

```
gta7/
├── src/
│   ├── main.ts              # Entry point bootstrap
│   ├── engine/              # Game loop, Three.js renderer, chase camera, input
│   ├── city/                # Procedural city grid, roads, and buildings
│   ├── vehicles/            # Car mesh, wheels, headlights, arcade physics
│   ├── ui/                  # Speedometer, wanted level, minimap radar, HUD
│   ├── audio/               # Web Audio synthesizer (engine, horn, drift)
│   ├── utils/               # Event bus, constants, maths
│   └── __tests__/           # Automated unit tests
├── docs/                    # PRD, Architecture, Specs, SDLC documentation
└── .github/workflows/       # GitHub Actions CI & Pages deployment
```

---

## 📜 License

MIT License © 2026 Alexander Herttrich
