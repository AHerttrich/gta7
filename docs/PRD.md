# Product Requirements Document — GTA 7 🚗🏙️

## Vision

**GTA 7** is a 3D browser-based open-world action and driving sandbox game designed and built as a collaborative creator project by Matti and his buddy, guided by Alexander Herttrich.

Players can cruise through a neon-lit 3D procedural metropolis, drift sports cars around corners, complete stunt jumps, trigger police chases with a classic 5-star wanted level system, tune vehicles, and tune into procedural synthwave radio stations — running entirely in modern web browsers with zero installation.

---

## Personas

| Persona | Name | Description | Goals |
|---|---|---|---|
| **Lead Creator** | Matti | Young visionary game developer & designer | Build cool cars, design city districts, test wild stunt ramps |
| **Co-Creator** | Kumpel / Buddy | Co-developer & creative partner | Design weapons/missions, code physics tweaks, playtest together |
| **Mentor / Architect** | Alexander | Code coach & devops guide | Teach clean architecture, Git workflows, CI/CD, Three.js math |
| **Player** | Web Gamer | Friend or gamer on web/mobile | Smooth driving, funny chaos, thrilling chases, instant loading |

---

## Core Pillars

1. **Instant Fun & Driving Physics**: Snappy, arcade-style vehicle handling with drifting, brake slides, suspension bounce, and high-speed thrills.
2. **Dynamic 3D Open World**: A procedural city grid complete with asphalt highways, intersections, neon skyscrapers, street lamps, and jump ramps.
3. **Living City & Wanted System**: Pedestrians, traffic cars, and a 1–5 star wanted level where police cars spawn and pursue reckless drivers.
4. **Vibe & Audio**: Procedural retro synthwave radio, roaring engine audio generated with Web Audio API, tire squeals, and horn honking.
5. **Modern Engineering**: TypeScript, Three.js, Vite, Vitest unit testing, GitHub Actions CI/CD with automated deployment to GitHub Pages.

---

## Functional Requirements

| ID | Feature | Priority | Phase | Status |
|---|---|---|---|---|
| **FR-01** | 3D Open World City Grid (Roads, Sidewalks, Buildings) | Must | Phase 1 | ✅ Initial Starter Ready |
| **FR-02** | Arcade Vehicle Physics (Steering, Acceleration, Drift, Brakes) | Must | Phase 1 | ✅ Initial Starter Ready |
| **FR-03** | 3rd-Person Dynamic Chase Camera with Spring Arm | Must | Phase 1 | ✅ Initial Starter Ready |
| **FR-04** | GTA-Style HUD (Speedometer km/h, Gear, Wanted Stars) | Must | Phase 1 | ✅ Initial Starter Ready |
| **FR-05** | Top-down Radar / Minimap with Player Orientation | Must | Phase 1 | ✅ Initial Starter Ready |
| **FR-06** | Procedural Web Audio (Engine sound pitch, Horn, Screech) | Should | Phase 1 | ✅ Initial Starter Ready |
| **FR-07** | Stunt Ramps & Destructible Props (Barrels, Cones) | Should | Phase 2 | 📋 Planned |
| **FR-08** | Wanted Level System (1–5 Stars with trigger events) | Must | Phase 2 | 📋 Planned |
| **FR-09** | Police AI & Chase Mechanics (Pathfinding, Intercept) | Should | Phase 2 | 📋 Planned |
| **FR-10** | Vehicle Spawner & Garage (Sports Car, Muscle, SUV, Cyber Truck) | Should | Phase 2 | 📋 Planned |
| **FR-11** | Character On-Foot Mode (Exit car, walk around, steal cars) | Could | Phase 3 | 📋 Planned |
| **FR-12** | Missions & Timed Checkpoint Challenges | Should | Phase 3 | 📋 Planned |
| **FR-13** | WebRTC P2P Multiplayer (Cruising together with PeerJS) | Could | Phase 4 | 📋 Planned |
| **FR-14** | Mobile Touch Controls & Gamepad Support | Could | Phase 4 | 📋 Planned |

---

## Non-Functional Requirements

- **Performance**: Solid 60 FPS on typical laptop / desktop hardware.
- **Portability**: Pure client-side web application — no server backend required for single-player.
- **Zero Assets Download Lock**: Procedural geometries and Web Audio synthesis allow instant loading without gigabytes of texture downloads.
- **Continuous Deployment**: Every push to `main` builds and publishes straight to GitHub Pages.
