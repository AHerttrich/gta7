import { eventBus } from '../utils/EventBus';
import { EVENTS, WeaponData, CITY_CONFIG } from '../utils/Constants';
import { EconomySystem } from '../economy/EconomySystem';
import { NetworkManager } from '../network/NetworkManager';
import { Input } from '../engine/Input';

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
  private input: Input | null = null;

  constructor(overlayId: string, economy: EconomySystem, network?: NetworkManager, input?: Input) {
    this.economy = economy;
    this.network = network || null;
    this.input = input || null;

    const el = document.getElementById(overlayId);
    if (!el) {
      throw new Error(`HUD overlay element #${overlayId} not found.`);
    }
    this.overlay = el;

    this.createHudElements();
    this.bindEvents();
    this.setupTouchControls();
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
          top: 16px;
          right: 18px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          z-index: 40;
        }
        .hud-cash {
          font-family: 'Impact', 'Arial Black', sans-serif;
          font-size: 34px;
          color: #22c55e;
          text-shadow: 2px 2px 0px #000, 0 0 12px rgba(34, 197, 94, 0.6);
          letter-spacing: 2px;
        }
        .hud-stars {
          display: flex;
          gap: 5px;
          font-size: 22px;
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
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .hud-multi-badge {
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid #10b981;
          color: #10b981;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
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
          bottom: 120px;
          right: 18px;
          background: rgba(11, 15, 25, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 160px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          z-index: 30;
        }
        @media (min-width: 900px) {
          .hud-bottom-right {
            bottom: 24px;
            right: 28px;
          }
        }
        .hud-speed-val {
          font-family: 'Impact', sans-serif;
          font-size: 42px;
          color: #00d4ff;
          text-shadow: 0 0 14px rgba(0, 212, 255, 0.7);
          line-height: 1;
        }
        .hud-speed-unit {
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
          margin-top: -2px;
        }
        .hud-gear {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 800;
          color: #f59e0b;
        }

        .hud-nitro-container {
          width: 100%;
          margin-top: 8px;
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
          font-size: 9px;
          font-weight: 800;
          color: #38bdf8;
          margin-top: 2px;
          text-align: right;
          letter-spacing: 1px;
        }

        .hud-health-bar {
          width: 100%;
          height: 7px;
          background: #1e293b;
          border-radius: 4px;
          margin-top: 6px;
          overflow: hidden;
        }
        .hud-health-fill {
          height: 100%;
          width: 100%;
          background: #22c55e;
          transition: width 0.2s ease, background-color 0.2s ease;
        }
        .hud-health-label {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 3px;
          font-weight: 600;
        }

        .hud-bottom-left {
          position: absolute;
          bottom: 120px;
          left: 18px;
          border: 3px solid rgba(0, 212, 255, 0.6);
          border-radius: 50%;
          width: 120px;
          height: 120px;
          overflow: hidden;
          background: rgba(11, 15, 25, 0.9);
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
          z-index: 30;
        }
        @media (min-width: 900px) {
          .hud-bottom-left {
            bottom: 24px;
            left: 28px;
            width: 140px;
            height: 140px;
          }
        }
        #minimap-canvas {
          width: 100%;
          height: 100%;
        }

        .hud-top-center {
          position: absolute;
          top: 50px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          pointer-events: none;
          z-index: 35;
        }
        .hud-notification {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid #38bdf8;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          padding: 6px 18px;
          border-radius: 30px;
          opacity: 0;
          transition: opacity 0.3s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          text-align: center;
        }
        .hud-prompt {
          background: rgba(234, 179, 8, 0.95);
          color: #000;
          font-weight: 800;
          font-size: 13px;
          padding: 5px 14px;
          border-radius: 6px;
          display: none;
          box-shadow: 0 4px 14px rgba(234, 179, 8, 0.5);
          animation: bouncePrompt 0.6s infinite alternate;
          text-align: center;
        }
        @keyframes bouncePrompt {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }

        .hud-controls-helper {
          position: absolute;
          top: 16px;
          left: 18px;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 11px;
          color: #cbd5e1;
          line-height: 1.4;
          z-index: 30;
        }
        @media (max-width: 900px) {
          .hud-controls-helper {
            display: none;
          }
        }
        .hud-controls-helper kbd {
          background: #334155;
          color: #fff;
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 700;
          font-family: monospace;
        }

        /* Mobile Quick Bar at Top */
        .hud-mobile-quickbar {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 6px;
          pointer-events: auto;
          z-index: 45;
        }
        .hud-quick-btn {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          padding: 6px 10px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        /* Mobile Touch Controls */
        .hud-touch-controls {
          position: absolute;
          bottom: 12px;
          left: 0;
          width: 100%;
          display: flex;
          justify-content: space-between;
          padding: 0 16px;
          box-sizing: border-box;
          pointer-events: none;
          z-index: 50;
        }
        .hud-touch-cluster {
          display: flex;
          gap: 10px;
          pointer-events: auto;
        }
        .hud-touch-btn {
          background: rgba(15, 23, 42, 0.85);
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: #fff;
          border-radius: 50%;
          width: 62px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          box-shadow: 0 4px 16px rgba(0,0,0,0.6);
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }
        .hud-touch-btn:active, .hud-touch-btn.active {
          background: rgba(0, 212, 255, 0.6);
          border-color: #00d4ff;
          transform: scale(0.92);
        }
        .hud-touch-gas {
          background: rgba(34, 197, 94, 0.5);
          border-color: #22c55e;
          width: 68px;
          height: 68px;
        }
        .hud-touch-brake {
          background: rgba(239, 68, 68, 0.5);
          border-color: #ef4444;
          width: 64px;
          height: 64px;
        }
        .hud-touch-nitro {
          background: rgba(6, 182, 212, 0.5);
          border-color: #06b6d4;
        }
        .hud-touch-fire {
          background: rgba(245, 158, 11, 0.5);
          border-color: #f59e0b;
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
          padding: 24px;
          width: 500px;
          max-width: 90vw;
          display: none;
          pointer-events: auto;
          box-shadow: 0 0 40px rgba(0, 212, 255, 0.4);
          z-index: 100;
        }
        .hud-shop-title {
          font-size: 22px;
          font-weight: 800;
          color: #00d4ff;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .hud-shop-section {
          margin-bottom: 16px;
        }
        .hud-shop-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-top: 6px;
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

        .hud-multi-modal {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #0f172a;
          border: 2px solid #10b981;
          border-radius: 16px;
          padding: 24px;
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

      <!-- Quick Buttons on Top -->
      <div class="hud-mobile-quickbar">
        <button class="hud-quick-btn" id="m-btn-radio" style="border-color:#a855f7;color:#a855f7;">📻 RADIO</button>
        <button class="hud-quick-btn" id="m-btn-hover" style="border-color:#06b6d4;color:#06b6d4;">🚀 HOVER</button>
        <button class="hud-quick-btn" id="m-btn-multi">🌐 MULTI</button>
        <button class="hud-quick-btn" id="m-btn-shop">🛒 SHOP</button>
        <button class="hud-quick-btn" id="m-btn-job">🚖 TAXI</button>
        <button class="hud-quick-btn" id="m-btn-cam">🎥 CAM</button>
        <button class="hud-quick-btn" id="m-btn-reset">🔄 RESET</button>
      </div>

      <div class="hud-controls-helper">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>: Fahren / Laufen / Fliegen</div>
        <div><kbd>V</kbd> / <kbd>X</kbd>: DeLorean Flugmodus 🚀</div>
        <div><kbd>Leertaste</kbd>: Steigen | <kbd>C</kbd>: Sinken</div>
        <div><kbd>B</kbd>: Radio wechseln 📻 | <kbd>N</kbd>: Nitro 🔥</div>
        <div><kbd>Klick</kbd> / <kbd>F</kbd>: Schießen / Schlagen 💥</div>
        <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>: Waffe | <kbd>P</kbd>: Multiplayer</div>
        <div><kbd>E</kbd>: Auto/Heli einsteigen | <kbd>G</kbd>: Shop</div>
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
        <div class="hud-radio-banner" id="hud-radio-banner" style="display:none;background:rgba(15,23,42,0.92);border:2px solid #a855f7;padding:8px 16px;border-radius:8px;box-shadow:0 0 15px rgba(168,85,247,0.5);margin-top:8px;text-align:center;"></div>
      </div>

      <div class="hud-bottom-left">
        <canvas id="minimap-canvas" width="140" height="140"></canvas>
      </div>

      <div class="hud-bottom-right">
        <div class="hud-speed-val" id="hud-speed">0</div>
        <div class="hud-speed-unit">KM/H</div>
        <div class="hud-gear" id="hud-gear">GANG: P</div>

        <div class="hud-nitro-container" id="hud-nitro-container">
          <div class="hud-nitro-bar">
            <div class="hud-nitro-fill" id="hud-nitro-fill"></div>
          </div>
          <div class="hud-nitro-label">NITRO BOOST</div>
        </div>

        <div class="hud-health-bar">
          <div class="hud-health-fill" id="hud-health-fill"></div>
        </div>
        <div class="hud-health-label" id="hud-health-label">AUTO INTEGRITÄT 100%</div>
      </div>

      <!-- Touch Controls Cluster -->
      <div class="hud-touch-controls" id="hud-touch-controls">
        <div class="hud-touch-cluster" style="align-items:flex-end;">
          <button class="hud-touch-btn" id="t-btn-left">◀</button>
          <button class="hud-touch-btn" id="t-btn-right">▶</button>
          <button class="hud-touch-btn" id="t-btn-horn" style="width:48px;height:48px;font-size:16px;">📢</button>
        </div>

        <div class="hud-touch-cluster" style="align-items:flex-end;flex-wrap:wrap;justify-content:flex-end;max-width:230px;">
          <button class="hud-touch-btn hud-touch-nitro" id="t-btn-nitro">🔥</button>
          <button class="hud-touch-btn" id="t-btn-hover" style="font-size:16px;background:rgba(6,182,212,0.45);border-color:#06b6d4;">🚀</button>
          <button class="hud-touch-btn hud-touch-fire" id="t-btn-fire">💥</button>
          <button class="hud-touch-btn" id="t-btn-action" style="font-size:16px;">🚗</button>
          <button class="hud-touch-btn hud-touch-brake" id="t-btn-brake">▼</button>
          <button class="hud-touch-btn hud-touch-gas" id="t-btn-gas">▲</button>
        </div>
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

  private setupTouchControls(): void {
    if (!this.input) return;

    const bindTouch = (btnId: string, controlKey: string, isTrigger: boolean = false): void => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      const activate = (e: Event): void => {
        e.preventDefault();
        btn.classList.add('active');
        if (this.input) {
          this.input.touchState[controlKey] = true;
        }
      };

      const deactivate = (e: Event): void => {
        e.preventDefault();
        btn.classList.remove('active');
        if (!isTrigger && this.input) {
          this.input.touchState[controlKey] = false;
        }
      };

      btn.addEventListener('touchstart', activate, { passive: false });
      btn.addEventListener('touchend', deactivate, { passive: false });
      btn.addEventListener('touchcancel', deactivate, { passive: false });
      btn.addEventListener('mousedown', activate);
      btn.addEventListener('mouseup', deactivate);
      btn.addEventListener('mouseleave', deactivate);
    };

    bindTouch('t-btn-left', 'left');
    bindTouch('t-btn-right', 'right');
    bindTouch('t-btn-gas', 'forward');
    bindTouch('t-btn-brake', 'backward');
    bindTouch('t-btn-nitro', 'nitro');
    bindTouch('t-btn-horn', 'horn');
    bindTouch('t-btn-hover', 'hoverToggle', true);
    bindTouch('t-btn-action', 'actionInteract', true);
    bindTouch('t-btn-fire', 'fire', true);

    // Mobile Top Quickbar Hooks
    document.getElementById('m-btn-radio')?.addEventListener('click', () => {
      if (this.input) this.input.touchState.radioCycle = true;
    });
    document.getElementById('m-btn-hover')?.addEventListener('click', () => {
      if (this.input) this.input.touchState.hoverToggle = true;
    });
    document
      .getElementById('m-btn-multi')
      ?.addEventListener('click', () => this.toggleMultiplayer());
    document.getElementById('m-btn-shop')?.addEventListener('click', () => this.toggleShop());
    document.getElementById('m-btn-job')?.addEventListener('click', () => {
      if (this.input) this.input.justPressed['j'] = true;
    });
    document.getElementById('m-btn-cam')?.addEventListener('click', () => {
      if (this.input) this.input.justPressed['c'] = true;
    });
    document.getElementById('m-btn-reset')?.addEventListener('click', () => {
      if (this.input) this.input.justPressed['r'] = true;
    });

    // Touch swipe look/turn on the game screen
    if (typeof window !== 'undefined') {
      let lastTouchX: number | null = null;
      let touchIdentifier: number | null = null;

      window.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const target = t.target as HTMLElement;
            if (
              target &&
              !target.closest('.hud-touch-btn') &&
              !target.closest('.hud-shop-modal') &&
              !target.closest('.hud-multi-modal') &&
              !target.closest('button')
            ) {
              lastTouchX = t.clientX;
              touchIdentifier = t.identifier;
              break;
            }
          }
        },
        { passive: true },
      );

      window.addEventListener(
        'touchmove',
        (e: TouchEvent) => {
          if (lastTouchX === null || touchIdentifier === null || !this.input) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === touchIdentifier) {
              const dx = t.clientX - lastTouchX;
              lastTouchX = t.clientX;
              this.input.touchTurnDelta += dx * 0.007;
              break;
            }
          }
        },
        { passive: true },
      );

      const endTouchSwipe = (e: TouchEvent): void => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchIdentifier) {
            lastTouchX = null;
            touchIdentifier = null;
            break;
          }
        }
      };

      window.addEventListener('touchend', endTouchSwipe, { passive: true });
      window.addEventListener('touchcancel', endTouchSwipe, { passive: true });
    }
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

  public showRadioStation(stationName: string, genre: string): void {
    const el = document.getElementById('hud-radio-banner');
    if (!el) return;
    el.innerHTML = `<div style="color:#a855f7;font-weight:900;font-size:16px;letter-spacing:1px;">📻 ${stationName}</div><div style="color:#94a3b8;font-size:12px;">${genre}</div>`;
    el.style.display = 'block';
    setTimeout(() => {
      if (el) el.style.display = 'none';
    }, 3000);
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
    isHoverMode: boolean = false,
  ): void {
    this.speedElement.textContent = String(Math.abs(speedKmh));

    if (isHoverMode) {
      this.gearElement.textContent = 'MODUS: 🚀 HOVER FLUG';
      this.gearElement.style.color = '#00f0ff';
      this.gearElement.style.textShadow = '0 0 10px #00f0ff';
    } else {
      this.gearElement.textContent = `GANG: ${gear}`;
      this.gearElement.style.color = '#38bdf8';
      this.gearElement.style.textShadow = 'none';
    }

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
