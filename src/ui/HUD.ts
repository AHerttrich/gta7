import { eventBus } from '../utils/EventBus';
import { EVENTS, WeaponData, CITY_CONFIG } from '../utils/Constants';
import { EconomySystem } from '../economy/EconomySystem';
import { NetworkManager } from '../network/NetworkManager';

export class HUD {
  private overlay: HTMLElement;
  private speedElement!: HTMLElement;
  private gearElement!: HTMLElement;
  private healthFillElement!: HTMLElement;
  private healthTextElement!: HTMLElement;
  private nitroFillElement!: HTMLElement;
  private nitroContainerElement!: HTMLElement;
  private starsContainer!: HTMLElement;
  private cashElement!: HTMLElement;
  private weaponElement!: HTMLElement;
  private notificationElement!: HTMLElement;
  private promptElement!: HTMLElement;
  private shopModalElement!: HTMLElement;
  private multiModalElement!: HTMLElement;
  private multiStatusBadge!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;

  private isShopOpen: boolean = false;
  private isMultiOpen: boolean = false;
  private economy: EconomySystem;
  private network: NetworkManager | null = null;

  constructor(overlayId: string, economy: EconomySystem, network?: NetworkManager) {
    this.economy = economy;
    this.network = network || null;

    const el = document.getElementById(overlayId);
    if (!el) {
      throw new Error(`HUD overlay element #${overlayId} not found.`);
    }
    this.overlay = el;

    this.createHudElements();
    this.bindEvents();
  }

  public setNetwork(network: NetworkManager): void {
    this.network = network;
    this.setupNetworkCallbacks();
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
        .hud-multi-badge {
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid #10b981;
          color: #10b981;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 800;
          display: none;
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
          min-width: 180px;
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

        .hud-nitro-container {
          width: 100%;
          margin-top: 10px;
        }
        .hud-nitro-bar {
          width: 100%;
          height: 6px;
          background: #1e293b;
          border-radius: 3px;
          overflow: hidden;
        }
        .hud-nitro-fill {
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #00d4ff, #38bdf8);
          box-shadow: 0 0 8px #00d4ff;
          transition: width 0.1s ease;
        }
        .hud-nitro-label {
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
          margin-top: 3px;
          text-align: right;
          letter-spacing: 1px;
        }

        .hud-health-bar {
          width: 100%;
          height: 8px;
          background: #1e293b;
          border-radius: 4px;
          margin-top: 8px;
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

        /* Modals */
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

        /* Multiplayer Modal */
        .hud-multi-modal {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #0f172a;
          border: 2px solid #10b981;
          border-radius: 16px;
          padding: 28px;
          width: 480px;
          max-width: 90vw;
          display: none;
          pointer-events: auto;
          box-shadow: 0 0 40px rgba(16, 185, 129, 0.4);
          z-index: 100;
        }
        .hud-input {
          background: #1e293b;
          border: 1px solid #475569;
          color: #fff;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 16px;
          width: 100%;
          box-sizing: border-box;
          margin: 8px 0;
          letter-spacing: 2px;
          font-weight: 700;
        }
      </style>

      <div class="hud-crosshair"></div>

      <div class="hud-controls-helper">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>: Fahren / Laufen</div>
        <div><kbd>N</kbd> / <kbd>Shift</kbd>: NITRO BOOST 🔥</div>
        <div><kbd>Klick</kbd> / <kbd>F</kbd>: Schießen / Schlagen 💥</div>
        <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>: Waffe wechseln</div>
        <div><kbd>P</kbd>: MULTIPLAYER (Mit Kumpel zocken) 🌐</div>
        <div><kbd>G</kbd>: Garage & Shop | <kbd>J</kbd>: Taxi-Job</div>
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
        <div class="hud-multi-badge" id="hud-multi-badge">🟢 KUMPEL VERBUNDEN</div>
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

        <div class="hud-nitro-container" id="hud-nitro-container">
          <div class="hud-nitro-bar">
            <div class="hud-nitro-fill" id="hud-nitro-fill"></div>
          </div>
          <div class="hud-nitro-label">NITRO BOOST [N]</div>
        </div>

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

      <!-- Multiplayer P2P Modal -->
      <div class="hud-multi-modal" id="hud-multi-modal">
        <div class="hud-shop-title" style="color:#10b981;">
          <span>🌐 GTA 7 P2P MULTIPLAYER</span>
          <button id="hud-multi-close-btn" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:14px;">
          Zocke direkt im Browser mit deinem Kumpel — ohne Installation & ohne Serverkosten!
        </div>

        <div class="hud-shop-section" style="background:#1e293b;padding:14px;border-radius:8px;">
          <h4 style="color:#38bdf8;">1. Spiel hosten (Raum erstellen)</h4>
          <div style="margin-top:6px;">
            <button class="hud-shop-btn" id="hud-host-btn">Raum erstellen</button>
            <div id="hud-room-code-display" style="display:none;margin-top:10px;font-size:15px;color:#facc15;">
              Dein Raumcode: <strong id="hud-room-code" style="font-size:22px;letter-spacing:3px;">------</strong>
              <button class="hud-shop-btn" id="hud-copy-code-btn" style="margin-left:8px;padding:3px 8px;font-size:12px;">Kopieren</button>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Schicke diesen Code deinem Kumpel!</div>
            </div>
          </div>
        </div>

        <div class="hud-shop-section" style="background:#1e293b;padding:14px;border-radius:8px;">
          <h4 style="color:#38bdf8;">2. Spiel beitreten</h4>
          <input type="text" id="hud-join-input" class="hud-input" placeholder="6-STELLIGEN CODE EINGEBEN" maxlength="6" />
          <button class="hud-shop-btn" id="hud-join-btn">Verbinden</button>
        </div>
      </div>
    `;

    this.speedElement = document.getElementById('hud-speed')!;
    this.gearElement = document.getElementById('hud-gear')!;
    this.healthFillElement = document.getElementById('hud-health-fill')!;
    this.healthTextElement = document.getElementById('hud-health-label')!;
    this.nitroFillElement = document.getElementById('hud-nitro-fill')!;
    this.nitroContainerElement = document.getElementById('hud-nitro-container')!;
    this.starsContainer = document.getElementById('hud-stars')!;
    this.cashElement = document.getElementById('hud-cash')!;
    this.weaponElement = document.getElementById('hud-weapon')!;
    this.multiStatusBadge = document.getElementById('hud-multi-badge')!;
    this.notificationElement = document.getElementById('hud-notification')!;
    this.promptElement = document.getElementById('hud-prompt')!;
    this.shopModalElement = document.getElementById('hud-shop-modal')!;
    this.multiModalElement = document.getElementById('hud-multi-modal')!;

    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;

    document.getElementById('hud-shop-close-btn')!.addEventListener('click', () => {
      this.toggleShop(false);
    });
    document.getElementById('hud-multi-close-btn')!.addEventListener('click', () => {
      this.toggleMultiplayer(false);
    });

    this.setupMultiplayerControls();
  }

  private setupMultiplayerControls(): void {
    const hostBtn = document.getElementById('hud-host-btn')!;
    const codeDisplay = document.getElementById('hud-room-code-display')!;
    const codeSpan = document.getElementById('hud-room-code')!;
    const copyBtn = document.getElementById('hud-copy-code-btn')!;
    const joinBtn = document.getElementById('hud-join-btn')!;
    const joinInput = document.getElementById('hud-join-input') as HTMLInputElement;

    hostBtn.addEventListener('click', async () => {
      if (!this.network) return;
      hostBtn.textContent = 'Erstelle Raum...';
      try {
        const code = await this.network.host();
        codeSpan.textContent = code;
        codeDisplay.style.display = 'block';
        hostBtn.style.display = 'none';
        this.showNotification(`Raum ${code} erstellt! Warte auf Kumpel...`);
      } catch {
        hostBtn.textContent = 'Fehler beim Erstellen';
      }
    });

    copyBtn.addEventListener('click', () => {
      const code = codeSpan.textContent || '';
      navigator.clipboard?.writeText(code);
      copyBtn.textContent = 'Kopiert!';
      setTimeout(() => (copyBtn.textContent = 'Kopieren'), 2000);
    });

    joinBtn.addEventListener('click', async () => {
      if (!this.network) return;
      const code = joinInput.value.trim();
      if (code.length < 4) {
        alert('Bitte gültigen Code eingeben!');
        return;
      }
      joinBtn.textContent = 'Verbinde...';
      try {
        await this.network.join(code);
        this.showNotification(`Verbinde mit Raum ${code}...`);
      } catch {
        joinBtn.textContent = 'Verbindung fehlgeschlagen';
      }
    });
  }

  private setupNetworkCallbacks(): void {
    if (!this.network) return;

    this.network.onStatus((status) => {
      if (status === 'connected') {
        this.multiStatusBadge.style.display = 'block';
        this.toggleMultiplayer(false);
        this.showNotification('🎉 Kumpel verbunden! Ihr spielt jetzt zusammen!');
      } else if (status === 'disconnected') {
        this.multiStatusBadge.style.display = 'none';
        this.showNotification('Verbindung zum Kumpel getrennt.');
      }
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

  public toggleMultiplayer(force?: boolean): boolean {
    this.isMultiOpen = force !== undefined ? force : !this.isMultiOpen;
    this.multiModalElement.style.display = this.isMultiOpen ? 'block' : 'none';
    return this.isMultiOpen;
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

  public updateVehicleStats(
    speedKmh: number,
    gear: string | number,
    health: number,
    nitro: number = 100,
    inCar: boolean = true,
  ): void {
    this.speedElement.textContent = String(Math.abs(speedKmh));
    this.gearElement.textContent = `GANG: ${gear}`;

    this.nitroContainerElement.style.display = inCar ? 'block' : 'none';
    this.nitroFillElement.style.width = `${Math.max(0, Math.min(100, nitro))}%`;

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
    activeTarget: { x: number; z: number; color?: string } | null = null,
    remotePeer: { x: number; z: number } | null = null,
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

    // Street Race Start Line (Cyan Diamond 🔷)
    const rx = (CITY_CONFIG.RACE_START_X - playerX) * scale;
    const rz = (CITY_CONFIG.RACE_START_Z - playerZ) * scale;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(rx, rz - 6);
    ctx.lineTo(rx + 6, rz);
    ctx.lineTo(rx, rz + 6);
    ctx.lineTo(rx - 6, rz);
    ctx.closePath();
    ctx.fill();

    // Active Mission Target
    if (activeTarget) {
      const ax = (activeTarget.x - playerX) * scale;
      const az = (activeTarget.z - playerZ) * scale;
      ctx.fillStyle = activeTarget.color || '#ff007f';
      ctx.beginPath();
      ctx.arc(ax, az, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Traffic Cars (Yellow dots)
    trafficCars.forEach((tc) => {
      const tx = (tc.x - playerX) * scale;
      const tz = (tc.z - playerZ) * scale;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(tx, tz, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Remote Buddy Player (Pulsating Blue Dot with Ring)
    if (remotePeer) {
      const px = (remotePeer.x - playerX) * scale;
      const pz = (remotePeer.z - playerZ) * scale;
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(px, pz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Police Cops (Red dots)
    cops.forEach((cop) => {
      const cx = (cop.x - playerX) * scale;
      const cz = (cop.z - playerZ) * scale;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cz, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Local Player Arrow at center
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
