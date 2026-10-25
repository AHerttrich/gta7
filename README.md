# GTA 7 🚗💨🏙️

[![CI](https://github.com/AHerttrich/gta7/actions/workflows/ci.yml/badge.svg)](https://github.com/AHerttrich/gta7/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/badge/play-live%20demo-brightgreen)](https://AHerttrich.github.io/gta7/)

> **GTA 7** — The open-world 3D browser action and driving sandbox created by Matti and his buddy. Cruise through a procedural neon city, drift sports cars, jump off stunt ramps, and evade the cops!

---

## 🎮 Play Online

Once deployed via GitHub Actions, play instantly in any browser:
👉 **[Play GTA 7 Live on GitHub Pages](https://AHerttrich.github.io/gta7/)**

---

## 🗺️ Entwicklungs-Roadmap

Unser detaillierter Zukunftsplan für die nächsten Phasen (Waffen, Schusswechsel, Taxi-Fahrgäste, Tuning-Garage & WebRTC-Multiplayer):
👉 **[Hier geht's zur GTA 7 Roadmap (docs/ROADMAP.md)](file:///c:/Users/ahert/Documents/GTA7/docs/ROADMAP.md)**

---

## ✨ Features

| Feature | Description | Status |
|---|---|---|
| **🏁 AI Street Racing Rivals & Leaderboard** | 2 rival sports cars (*Cyber Viper* & *Neon Phantom*) compete in street races with overtaking AI, rubberbanding, and live podium HUD (`🥇 1. / 3`) | ✅ Included |
| **🛠️ Performance Tuning & Custom Shop** | Stage 1-3 Turbo upgrades (up to 280 km/h), Kevlar armor plating, and custom neon underglow colors (Hot Pink, Toxic Lime, Solar Gold, Cyber Purple) | ✅ Included |
| **🚨 Police Spike Strips & PIT Maneuvers** | 3D spike strips puncturing tires with rim sparks and handling drag; aggressive police PIT spin-outs at high speed | ✅ Included |
| **☀️🌙 Dynamic Day/Night & Weather FX** | Orbiting sun cycle (High Noon, Golden Sunset, Cyber Night), volumetric rain particles, lightning flash bursts (`L` / `K` / `[☀️ ZEIT]`) | ✅ Included |
| **🐍 Gang Turf Wars & Bounty Boss Convoy** | Cyber Vipers vs Neon Syndicate districts with armed patrols; heavy armored 300 HP Bounty Convoy Boss dropping $5,000 cash | ✅ Included |
| **🚁 Flyable Executive Helicopter** | Fully flyable helicopter on the Downtown skyscraper helipad with spinning rotors, lift physics & searchlight (`E` to enter) | ✅ Included |
| **📻 Procedural GTA Cyber Radio** | 4-Station synthesizer radio (*80s Synthwave FM*, *Cyber Electro Drive*, *Vice Beach Chill*, *Radio Aus*) with HUD station banner (`B` / `[📻 RADIO]`) | ✅ Included |
| **🚨 Police Helicopter & SWAT Roadblocks** | Air interceptor helicopter tracking player with searchlight at 4-5 stars; destructible hazard barricades at 3+ stars | ✅ Included |
| **🛸 Futuristic DeLorean Hover Flight** | Authentic DeLorean DMC-12 time machine with brushed stainless steel, folding hover thruster wheels, vertical climb & flight mode (`V`/`X` / mobile `🚀 HOVER`) | ✅ Included |
| **🌆 Next-Gen City Graphics** | Procedural skyscraper window grid facades, rooftop helipads, antennas with blinking warning beacons, boulevard palm trees & street lamps | ✅ Included |
| **🌌 Atmospheric Sky Dome & Warp FX** | Gradient sky dome (space cobalt to golden sunset haze), floating cyber dust motes, and hyperspace speed warp streak lines | ✅ Included |
| **🏎️ Arcade Driving Physics** | Smooth acceleration, steering, drifting with handbrake, reverse, and suspension bounce | ✅ Included |
| **📱 Mobile Touch Controls** | Full on-screen touch virtual controls for smartphones & tablets (Steering, Gas, Brake, Nitro, Flight, Jack, Shoot, Top Bar) | ✅ Included |
| **🤸 Ballistic Ragdoll Pedestrians** | Pedestrians get launched into the air upon vehicle impact with 3D tumbling, flailing limbs, ground bouncing & recovery | ✅ Included |
| **🌐 P2P WebRTC Multiplayer** | Real-time direct browser-to-browser multiplayer (Host/Join with 6-char code, synced cars, PvP ramming & shooting) | ✅ Included |
| **☀️ California Sunlight** | Bright daylight with sharp sun shadows, blue sky and clear visibility across districts | ✅ Included |
| **🚕 Living City Traffic** | NPC cars, yellow cabs, SUVs and coupes driving through streets, braking and reacting to crashes | ✅ Included |
| **🚨 Real Car-Jacking** | Step up to ANY traffic car or taxi on foot, press `E` or tap mobile icon, eject the driver and steal it | ✅ Included |
| **💥 Weapon Combat & Explosions** | Fists, baseball bat, pistol tracers, and RPG rocket launcher with devastating fireball shockwaves | ✅ Included |
| **🛠️ Pay 'n' Spray Garage** | Drive into the green garage to repair 100% vehicle damage, repaint the chassis, and clear all wanted stars | ✅ Included |
| **🏁 Checkpoint Races & Taxi Jobs** | Neon checkpoint street races against the clock and interactive taxi passenger missions | ✅ Included |
| **🔥 Nitro Boost** | Twin-flame exhaust, cyan underglow neon, and top speed exceeding 245 km/h (`N` / `Shift` / Mobile fire button) | ✅ Included |
| **🏙️ Procedural 3D City** | Multi-block metropolis with multi-lane roads, sidewalks, trees, street lights, and illuminated skyscrapers | ✅ Included |
| **🎥 Dynamic Chase Camera** | Spring-arm camera with smooth follow, corner swing, and multi-angle views (`C` key) | ✅ Included |
| **⭐ Wanted Level System** | 5-Star wanted system with HUD stars and aggressive cop chase AI | ✅ Included |
| **🧭 Radar Minimap** | Real-time top-down 2D radar with car location, heading indicator, and city block layout | ✅ Included |
| **⚡ Cyber HUD** | Speedometer ($km/h$), automatic gear indicator, controls helper, and mission banner | ✅ Included |
| **🔊 Procedural Web Audio** | Dynamic engine pitch, tire screech, crashes, pedestrian hits, and horn honk synthesized via Web Audio API | ✅ Included |
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
| `W` / `Arrow Up` | Throttle forward / Fly forward |
| `S` / `Arrow Down` | Brake / Reverse / Air thrusters |
| `A` / `Arrow Left` | Steer left / Flight banking roll |
| `D` / `Arrow Right` | Steer right / Flight banking roll |
| `V` / `X` | **DeLorean Hover-Flugmodus umschalten** 🚀 |
| `Space` | Steigen im Flugmodus (oder Handbremse am Boden / Sprung zu Fuß) |
| `C` | Sinken im Flugmodus (oder Kameraperspektive wechseln) |
| `N` / `Shift` (in car) | **NITRO BOOST** (Twin flame exhaust, 245 km/h) |
| `Left Click` / `F` | Shoot weapon / Melee attack |
| `1` – `4` | Quick weapon switch (Fists, Bat, Pistol, RPG) |
| `B` | Radio-Sender wechseln 📻 (Synthwave, Electro, Chill, Aus) |
| `E` | Auto / Taxi klauen / Helikopter einsteigen / Aussteigen 🚁 |
| `G` | Open Garage & Weapon Shop |
| `J` | Start interactive Taxi passenger job |
| `H` | Honk horn (scares pedestrians!) |
| `L` | Toggle headlights |
| `R` | Reset car orientation |
| `M` | Mute / Unmute audio |

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
