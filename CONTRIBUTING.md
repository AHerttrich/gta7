# Contributing to GTA 7 🚗💨

Welcome to the GTA 7 development team! Whether you're adding new cars, building skyscrapers, writing radio tracks, or programming police chases, here's how we build things together.

---

## 🛠️ Quick Start

1. **Clone the repo:**
   ```bash
   git clone https://github.com/AHerttrich/gta7.git
   cd gta7
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start local dev server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser!

---

## 🧪 Testing & Code Quality

Before pushing code or opening a PR, always check that everything builds and tests pass:

```bash
make ci
# or manually:
npm run lint
npm run test
npm run build
```

---

## 🌿 Branching Strategy

- `main`: Production branch (automatically deployed to GitHub Pages).
- Feature branches: `feat/car-nitro`, `feat/police-chase`, `fix/steering-drift`

---

## 💡 Ideas for Future Features

Check out `docs/PRD.md` and `docs/SPEC.md` for our game roadmap, architecture, and physics formulas.
Have fun coding! 🚀
