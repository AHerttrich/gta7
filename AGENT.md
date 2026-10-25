# AGENT.md — GTA 7 🚗💨

> Quick bootstrap for AI agents and pair programmers. For full context see:
> `docs/PRD.md` · `docs/ARCH.md` · `docs/SPEC.md` · `docs/SDLC.md`

## Make Commands

```bash
make install    # Install npm dependencies
make setup      # Full setup (install + verify)
make dev        # Start Vite dev server on :3000
make test       # Run Vitest with coverage
make lint       # ESLint check
make format     # Prettier auto-format
make security   # Security scan (npm audit)
make ci         # Full CI: lint + test + build
make clean      # Remove dist/ and coverage/
make help       # List all targets
```

## Repo Map

```
src/
├── main.ts               # Entry point bootstrap & game initialization
├── engine/               # Three.js renderer, chase camera, input handling, game loop
│   ├── Game.ts
│   ├── Renderer.ts
│   ├── Camera.ts
│   └── Input.ts
├── city/                 # Procedural city generation
│   ├── City.ts
│   ├── Road.ts
│   └── Building.ts
├── vehicles/             # Vehicle meshes, wheel kinematics, arcade physics
│   ├── Car.ts
│   └── CarPhysics.ts
├── ui/                   # In-game HUD, speedometer, wanted stars, minimap radar
│   ├── HUD.ts
│   ├── Minimap.ts
│   └── Speedometer.ts
├── audio/                # Procedural Web Audio API sound generator (engine, screech, horn)
│   └── SoundManager.ts
├── utils/                # EventBus pub/sub, constants, mathematical helpers
│   ├── Constants.ts
│   └── EventBus.ts
└── __tests__/            # Vitest unit & integration test suite
docs/                     # PRD, ARCH, SPEC, SDLC
.github/workflows/        # ci.yml and deploy.yml (GitHub Pages)
```

## Key Patterns

- **Decoupled Physics & Rendering**: Physics executes at fixed or delta-time steps; visual meshes interpolate.
- **Event Bus**: Type-safe event communication between subsystems (`EventBus.on('vehicle:speed', ...)`)
- **Zero Heavy Assets**: Pure procedural geometry and Web Audio synthesis for instantaneous browser loading.
- **Naming Conventions**: `camelCase` for variables/methods, `PascalCase` for classes/types, `UPPER_SNAKE_CASE` for constants.

## Key Bindings

| Key | Action |
|---|---|
| `W` / `Arrow Up` | Throttle forward |
| `S` / `Arrow Down` | Brake / Reverse |
| `A` / `Arrow Left` | Steer left |
| `D` / `Arrow Right` | Steer right |
| `Space` | Handbrake (Drift) |
| `H` | Horn |
| `C` | Cycle Camera |
| `L` | Toggle Headlights |
| `R` | Reset Car |
| `M` | Mute / Unmute Audio |

## Deploy Info

| Key | Value |
|---|---|
| Repo | `AHerttrich/gta7` |
| Live URL | `https://AHerttrich.github.io/gta7/` |
| CI/CD Target | GitHub Actions -> GitHub Pages |
| Base URL | `/gta7/` |
