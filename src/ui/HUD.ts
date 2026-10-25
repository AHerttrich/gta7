import { eventBus } from '../utils/EventBus';
import { EVENTS, WeaponData, CITY_CONFIG } from '../utils/Constants';
import { EconomySystem } from '../economy/EconomySystem';

export class HUD {
  private overlay: HTMLElement;
  private speedElement!: HTMLElement;
  private gearElement!: HTMLElement;
  private healthFillElement!: HTMLElement;
  private healthTextElement!: HTMLElement;
  private starsContainer!: HTMLElement;
  private cashElement!: HTMLElement;
  private weaponElement!: HTMLElement;
  private notificationElement!: HTMLElement;
  private promptElement!: HTMLElement;
  private shopModalElement!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;

  private isShopOpen: boolean = false;
  private economy: EconomySystem;

  constructor(overlayId: string, economy: EconomySystem) {
    this.economy = economy;
    const el = document.getElementById(overlayId);
    if (!el) {
      throw new Error(`HUD overlay element #${overlayId} not found.`);
    }
    this.overlay = el;

    this.createHudElements();
    this.bindEvents();
  }

  private createHudElements(): void {
    this.overlay.innerHTML = `
      <style>
        .hud-top-right {
          position: absolute;
          top: 24px;
          right: 28px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }
        .hud-cash {
          font-family: 'Impact', 'Arial Black', sans-serif;
          font-size: 38px;
          color: #22c55e;
          text-shadow: 2px 2px 0px #000, 0 0 12px rgba(34, 197, 94, 0.6);
          letter-spacing: 2px;
        }
        .hud-stars {
          display: flex;
          gap: 6px;
          font-size: 26px;
        }
        .hud-star {
          color: #334155;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
          transition: all 0.2s ease;
        }
        .hud-star.active {
          color: #eab308;
          text-shadow: 0 0 10px #f59e0b;
          animation: pulseStar 0.8s infinite alternate;
        }
        @keyframes pulseStar {
          from { transform: scale(1); }
          to { transform: scale(1.2); }
        }
        .hud-weapon {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid #38bdf8;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 700;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }

        .hud-crosshair {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 22px;
          height: 22px;
          pointer-events: none;
        }
        .hud-crosshair::before, .hud-crosshair::after {
          content: '';
          position: absolute;
          background: rgba(255, 255, 255, 0.7);
        }
        .hud-crosshair::before {
          top: 10px;
          left: 0;
          width: 22px;
          height: 2px;
        }
        .hud-crosshair::after {
          top: 0;
          left: 10px;
          width: 2px;
          height: 22px;
        }

        .hud-bottom-right {
          position: absolute;
          bottom: 24px;
          right: 28px;
          background: rgba(11, 15, 25, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 170px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        .hud-speed-val {
          font-family: 'Impact', sans-serif;
          font-size: 48px;
          color: #00d4ff;
          text-shadow: 0 0 14px rgba(0, 212, 255, 0.7);
          line-height: 1;
        }
        .hud-speed-unit {
          font-size: 13px;
          font-weight: 700;
          color: #94a3b8;
          margin-top: -2px;
        }
        .hud-gear {
          margin-top: 6px;
          font-size: 14px;
          font-weight: 800;
          color: #f59e0b;
        }
        .hud-health-bar {
          width: 100%;
          height: 8px;
          background: #1e293b;
          border-radius: 4px;
          margin-top: 10px;
          overflow: hidden;
        }
        .hud-health-fill {
          height: 100%;
          width: 100%;
          background: #22c55e;
          transition: width 0.2s ease, background-color 0.2s ease;
        }
        .hud-health-label {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
          font-weight: 600;
        }

        .hud-bottom-left {
          position: absolute;
          bottom: 24px;
          left: 28px;
          border: 3px solid rgba(0, 212, 255, 0.6);
          border-radius: 50%;
          width: 150px;
          height: 150px;
          overflow: hidden;
          background: rgba(11, 15, 25, 0.9);
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
        }
        #minimap-canvas {
          width: 100%;
          height: 100%;
        }

        .hud-top-center {
          position: absolute;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          pointer-events: none;
        }
        .hud-notification {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid #38bdf8;
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          padding: 8px 20px;
          border-radius: 30px;
          opacity: 0;
          transition: opacity 0.3s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }
        .hud-prompt {
          background: rgba(234, 179, 8, 0.95);
          color: #000;
          font-weight: 800;
          font-size: 14px;
          padding: 6px 16px;
          border-radius: 6px;
          display: none;
          box-shadow: 0 4px 14px rgba(234, 179, 8, 0.5);
          animation: bouncePrompt 0.6s infinite alternate;
        }
        @keyframes bouncePrompt {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }

        .hud-controls-helper {
          position: absolute;
          top: 24px;
          left: 28px;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          color: #cbd5e1;
          line-height: 1.5;
        }
        .hud-controls-helper kbd {
          background: #334155;
          color: #fff;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          font-family: monospace;
        }

        /* Shop Modal */
        .hud-shop-modal {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #0f172a;
          border: 2px solid #00d4ff;
          border-radius: 16px;
          padding: 28px;
          width: 520px;
          max-width: 90vw;
          display: none;
          pointer-events: auto;
          box-shadow: 0 0 40px rgba(0, 212, 255, 0.4);
          z-index: 100;
        }
        .hud-shop-title {
          font-size: 24px;
          font-weight: 800;
          color: #00d4ff;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .hud-shop-section {
          margin-bottom: 20px;
        }
        .hud-shop-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          margin-top: 8px;
          background: #1e293b;
          border-radius: 8px;
        }
        .hud-shop-btn {
          background: #22c55e;
          color: #000;
          border: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-weight: 700;
          cursor: pointer;
        }
        .hud-shop-btn:disabled {
          background: #475569;
          color: #94a3b8;
          cursor: not-allowed;
        }
      </style>

      <div class="hud-crosshair"></div>

      <div class="hud-controls-helper">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>: Fahren / Laufen</div>
        <div><kbd>Klick</kbd> / <kbd>F</kbd>: Schießen / Schlagen 💥</div>
        <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>: Waffe wechseln</div>
        <div><kbd>E</kbd>: Auto klauen / Ein-/Aussteigen</div>
        <div><kbd>G</kbd>: Garage & Waffenladen | <kbd>J</kbd>: Job ($)</div>
        <div><kbd>H</kbd>: Hupe | <kbd>C</kbd>: Kamera | <kbd>R</kbd>: Reset</div>
      </div>

      <div class="hud-top-right">
        <div class="hud-cash" id="hud-cash">$500</div>
        <div class="hud-stars" id="hud-stars">
          <span class="hud-star">★</span>
          <span class="hud-star">★</span>
          <span class="hud-star">★</span>
          <span class="hud-star">★</span>
          <span class="hud-star">★</span>
        </div>
        <div class="hud-weapon" id="hud-weapon">🥊 Faustschlag</div>
      </div>

      <div class="hud-top-center">
        <div class="hud-prompt" id="hud-prompt">Drücke [E] um ins Auto einzusteigen</div>
        <div class="hud-notification" id="hud-notification">Willkommen in GTA 7!</div>
      </div>

      <div class="hud-bottom-left">
        <canvas id="minimap-canvas" width="150" height="150"></canvas>
      </div>

      <div class="hud-bottom-right">
        <div class="hud-speed-val" id="hud-speed">0</div>
        <div class="hud-speed-unit">KM/H</div>
        <div class="hud-gear" id="hud-gear">GANG: P</div>
        <div class="hud-health-bar">
          <div class="hud-health-fill" id="hud-health-fill"></div>
        </div>
        <div class="hud-health-label" id="hud-health-label">AUTO INTEGRITÄT 100%</div>
      </div>

      <!-- Garage & Weapon Shop Modal -->
      <div class="hud-shop-modal" id="hud-shop-modal">
        <div class="hud-shop-title">
          <span>🏎️ GTA 7 GARAGE & SHOP</span>
          <button id="hud-shop-close-btn" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div class="hud-shop-section">
          <h4 style="color:#f59e0b;margin-bottom:6px;">🚗 Autos kaufen:</h4>
          <div id="hud-car-list"></div>
        </div>
        <div class="hud-shop-section">
          <h4 style="color:#f59e0b;margin-bottom:6px;">🔫 Waffen & Munition:</h4>
          <div id="hud-weapon-list"></div>
        </div>
      </div>
    `;

    this.speedElement = document.getElementById('hud-speed')!;
    this.gearElement = document.getElementById('hud-gear')!;
    this.healthFillElement = document.getElementById('hud-health-fill')!;
    this.healthTextElement = document.getElementById('hud-health-label')!;
    this.starsContainer = document.getElementById('hud-stars')!;
    this.cashElement = document.getElementById('hud-cash')!;
    this.weaponElement = document.getElementById('hud-weapon')!;
    this.notificationElement = document.getElementById('hud-notification')!;
    this.promptElement = document.getElementById('hud-prompt')!;
    this.shopModalElement = document.getElementById('hud-shop-modal')!;

    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;

    document.getElementById('hud-shop-close-btn')!.addEventListener('click', () => {
      this.toggleShop(false);
    });
  }

  private bindEvents(): void {
    eventBus.on(EVENTS.MONEY_CHANGE, (data) => {
      const d = data as { cash: number };
      this.cashElement.textContent = `$${d.cash.toLocaleString()}`;
    });

    eventBus.on(EVENTS.WANTED_CHANGE, (data) => {
      const d = data as { wantedLevel: number };
      const stars = this.starsContainer.querySelectorAll('.hud-star');
      stars.forEach((star, index) => {
        if (index < d.wantedLevel) {
          star.classList.add('active');
        } else {
          star.classList.remove('active');
        }
      });
    });

    eventBus.on(EVENTS.NOTIFICATION, (data) => {
      const d = data as { text: string };
      this.showNotification(d.text);
    });

    eventBus.on(EVENTS.WEAPON_CHANGE, (data) => {
      const w = data as WeaponData;
      this.updateWeaponDisplay(w);
    });
  }

  public updateWeaponDisplay(weapon: WeaponData): void {
    const ammoStr = weapon.ammo === Infinity ? '∞' : `${weapon.ammo}`;
    const icon =
      weapon.id === 'rocket_launcher'
        ? '🚀'
        : weapon.id === 'pistol'
          ? '🔫'
          : weapon.id === 'baseball_bat'
            ? '🏏'
            : '🥊';
    this.weaponElement.textContent = `${icon} ${weapon.name} (${ammoStr})`;
  }

  public showNotification(text: string): void {
    this.notificationElement.textContent = text;
    this.notificationElement.style.opacity = '1';
    setTimeout(() => {
      this.notificationElement.style.opacity = '0';
    }, 3500);
  }

  public setPrompt(text: string | null): void {
    if (text) {
      this.promptElement.textContent = text;
      this.promptElement.style.display = 'block';
    } else {
      this.promptElement.style.display = 'none';
    }
  }

  public toggleShop(force?: boolean): boolean {
    this.isShopOpen = force !== undefined ? force : !this.isShopOpen;
    this.shopModalElement.style.display = this.isShopOpen ? 'block' : 'none';
    if (this.isShopOpen) {
      this.renderShopContent();
    }
    return this.isShopOpen;
  }

  private renderShopContent(): void {
    const carList = document.getElementById('hud-car-list')!;
    carList.innerHTML = this.economy.cars
      .map(
        (c) => `
      <div class="hud-shop-item">
        <div>
          <strong>${c.name}</strong>
          <div style="font-size:12px;color:#94a3b8;">Topspeed: ${c.topSpeed * 3.6} km/h</div>
        </div>
        <div>
          ${
            c.unlocked
              ? `<span style="color:#22c55e;font-weight:700;">Im Besitz</span>`
              : `<button class="hud-shop-btn" onclick="window.gtaBuyCar('${c.id}')">$${c.price}</button>`
          }
        </div>
      </div>
    `,
      )
      .join('');

    const weaponList = document.getElementById('hud-weapon-list')!;
    weaponList.innerHTML = this.economy.weapons
      .map(
        (w) => `
      <div class="hud-shop-item">
        <div>
          <strong>${w.name}</strong>
          <div style="font-size:12px;color:#94a3b8;">Schaden: ${w.damage} | Munition: ${w.ammo === Infinity ? 'Unbegrenzt' : w.ammo}</div>
        </div>
        <div>
          ${
            w.unlocked
              ? `<button class="hud-shop-btn" onclick="window.gtaEquipWeapon('${w.id}')">Ausrüsten</button>`
              : `<button class="hud-shop-btn" onclick="window.gtaBuyWeapon('${w.id}')">$${w.price}</button>`
          }
        </div>
      </div>
    `,
      )
      .join('');

    (window as unknown as { gtaBuyCar: (id: string) => void }).gtaBuyCar = (id: string): void => {
      if (this.economy.buyCar(id)) {
        this.renderShopContent();
      } else {
        alert('Nicht genug Geld!');
      }
    };
    (window as unknown as { gtaBuyWeapon: (id: string) => void }).gtaBuyWeapon = (
      id: string,
    ): void => {
      if (this.economy.buyWeapon(id)) {
        this.renderShopContent();
      } else {
        alert('Nicht genug Geld!');
      }
    };
    (window as unknown as { gtaEquipWeapon: (id: string) => void }).gtaEquipWeapon = (
      id: string,
    ): void => {
      this.economy.equipWeapon(id);
      this.renderShopContent();
    };
  }

  public updateVehicleStats(speedKmh: number, gear: string | number, health: number): void {
    this.speedElement.textContent = String(Math.abs(speedKmh));
    this.gearElement.textContent = `GANG: ${gear}`;

    const healthPct = Math.max(0, Math.min(100, health));
    this.healthFillElement.style.width = `${healthPct}%`;

    if (healthPct > 50) {
      this.healthFillElement.style.backgroundColor = '#22c55e';
    } else if (healthPct > 25) {
      this.healthFillElement.style.backgroundColor = '#f59e0b';
    } else {
      this.healthFillElement.style.backgroundColor = '#ef4444';
    }

    this.healthTextElement.textContent =
      healthPct <= 0 ? 'AUTO ZERSTÖRT 💥' : `INTEGRITÄT ${healthPct}%`;
  }

  public updateMinimap(
    playerX: number,
    playerZ: number,
    heading: number,
    cops: { x: number; z: number }[],
    trafficCars: { x: number; z: number }[] = [],
  ): void {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const center = w / 2;
    const scale = 0.45;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(center, center);

    // City grid roads
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    for (let x = -200; x <= 200; x += 88) {
      ctx.beginPath();
      ctx.moveTo((x - playerX) * scale, (-200 - playerZ) * scale);
      ctx.lineTo((x - playerX) * scale, (200 - playerZ) * scale);
      ctx.stroke();
    }
    for (let z = -200; z <= 200; z += 88) {
      ctx.beginPath();
      ctx.moveTo((-200 - playerX) * scale, (z - playerZ) * scale);
      ctx.lineTo((200 - playerX) * scale, (z - playerZ) * scale);
      ctx.stroke();
    }

    // Pay 'n' Spray Garage Icon (Green Square 🟩)
    const gx = (CITY_CONFIG.GARAGE_X - playerX) * scale;
    const gz = (CITY_CONFIG.GARAGE_Z - playerZ) * scale;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(gx - 4, gz - 4, 8, 8);

    // Traffic Cars (Yellow dots)
    trafficCars.forEach((tc) => {
      const tx = (tc.x - playerX) * scale;
      const tz = (tc.z - playerZ) * scale;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(tx, tz, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Police Cops (Red dots)
    cops.forEach((cop) => {
      const cx = (cop.x - playerX) * scale;
      const cz = (cop.z - playerZ) * scale;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cz, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Player Arrow at center
    ctx.rotate(heading);
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(-6, -8);
    ctx.lineTo(0, -5);
    ctx.lineTo(6, -8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
