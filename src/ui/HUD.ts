import { eventBus } from '../utils/EventBus';
import { EVENTS, WeaponData, CITY_CONFIG } from '../utils/Constants';
import { EconomySystem } from '../economy/EconomySystem';
import { NetworkManager } from '../network/NetworkManager';
import { Input } from '../engine/Input';
import { CasinoSystem } from '../casino/CasinoSystem';
import { SoundManager } from '../audio/SoundManager';
import { RadioSystem } from '../audio/RadioSystem';
import { Renderer } from '../engine/Renderer';

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
  private casinoModalElement!: HTMLElement;
  private multiStatusBadge!: HTMLElement;
  private raceLeaderboardElement!: HTMLElement;
  private racePosBadge!: HTMLElement;
  private raceCheckpointInfo!: HTMLElement;
  private raceTimeInfo!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;

  public isShopOpen: boolean = false;
  public isMultiOpen: boolean = false;
  public isCasinoOpen: boolean = false;
  public isSettingsOpen: boolean = false;
  private settingsModalElement!: HTMLElement;
  private rpmFillElement!: HTMLElement;
  private minimapHintElement!: HTMLElement;
  public isMinimapZoomed: boolean = false;
  private economy: EconomySystem;
  private network: NetworkManager | null = null;
  private input: Input | null = null;
  private casino: CasinoSystem | null = null;
  private sound: SoundManager | null = null;
  private radio: RadioSystem | null = null;
  private rendererRef: Renderer | null = null;
  private lastSpeed: number = -999;
  private lastGear: string | number = '';
  private lastHealth: number = -999;
  private lastNitro: number = -999;
  private lastInCar: boolean | null = null;
  private lastIsHover: boolean | null = null;
  private lastRpm: number = -999;
  private lastMinimapTime: number = 0;

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

  public setCasino(casino: CasinoSystem): void {
    this.casino = casino;
  }

  public setAudioSystems(sound: SoundManager, radio: RadioSystem, renderer?: Renderer): void {
    this.sound = sound;
    this.radio = radio;
    if (renderer) this.rendererRef = renderer;
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
          transform-origin: left;
          transition: transform 0.1s ease;
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
          transform-origin: left;
          transition: transform 0.2s ease, background-color 0.2s ease;
        }
        .hud-health-label {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 3px;
          font-weight: 600;
        }

        .hud-bottom-left {
          position: absolute;
          bottom: 84px;
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
          user-select: text;
          -webkit-user-select: text;
          pointer-events: auto;
        }
      </style>

      <div class="hud-crosshair"></div>

      <!-- Quick Buttons on Top -->
      <div class="hud-mobile-quickbar">
        <button class="hud-quick-btn" id="m-btn-mute" style="border-color:#ef4444;color:#ef4444;">🔊 TON</button>
        <button class="hud-quick-btn" id="m-btn-radio" style="border-color:#a855f7;color:#a855f7;">📻 RADIO</button>
        <button class="hud-quick-btn" id="m-btn-hover" style="border-color:#06b6d4;color:#06b6d4;">🚀 HOVER</button>
        <button class="hud-quick-btn" id="m-btn-jetpack" style="border-color:#38bdf8;color:#38bdf8;">🚀 JETPACK</button>
        <button class="hud-quick-btn" id="m-btn-house" style="border-color:#f59e0b;color:#f59e0b;">👑 HAUS</button>
        <button class="hud-quick-btn" id="m-btn-casino" style="border-color:#facc15;color:#facc15;">🎰 CASINO</button>
        <button class="hud-quick-btn" id="m-btn-build" style="border-color:#f97316;color:#f97316;">🏗️ BAUEN</button>
        <button class="hud-quick-btn" id="m-btn-time" style="border-color:#f59e0b;color:#f59e0b;">☀️ ZEIT</button>
        <button class="hud-quick-btn" id="m-btn-weather" style="border-color:#38bdf8;color:#38bdf8;">🌧️ WETTER</button>
        <button class="hud-quick-btn" id="m-btn-multi">🌐 MULTI</button>
        <button class="hud-quick-btn" id="m-btn-shop">🛒 SHOP</button>
        <button class="hud-quick-btn" id="m-btn-cam">🎥 CAM</button>
        <button class="hud-quick-btn" id="m-btn-vr" style="border-color:#10b981;color:#10b981;">🥽 VR</button>
        <button class="hud-quick-btn" id="m-btn-settings" style="border-color:#38bdf8;color:#38bdf8;">⚙️ OPTION</button>
        <button class="hud-quick-btn" id="m-btn-fullscreen" style="border-color:#eab308;color:#eab308;">⛶ VOLL</button>
        <button class="hud-quick-btn" id="m-btn-reset">🔄 RESET</button>
      </div>

      <div class="hud-controls-helper">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>: Fahren / Laufen / Fliegen | <kbd>Strg</kbd>: Sinken</div>
        <div><kbd>V</kbd> / <kbd>X</kbd>: DeLorean Flug | <kbd>J</kbd>: Jetpack 🚀 | <kbd>H</kbd>: Eigenes Haus 👑</div>
        <div><kbd>E</kbd>: Interaktion / Ein-/Aussteigen | <kbd>Tab</kbd>: Stunt-Editor 🏗️ | <kbd>C</kbd>: Kamera 🎥</div>
        <div><kbd>Esc</kbd>: Optionen & Pause ⚙️ | <kbd>G</kbd>: Shop 🛒 | <kbd>P</kbd>: Koop 🌐</div>
        <div><kbd>I</kbd>: Tag/Nacht ☀️🌙 | <kbd>K</kbd>: Wetter 🌦️ | <kbd>O</kbd>: Taxi-Job 🚕</div>
        <div><kbd>B</kbd>: Radio 📻 | <kbd>M</kbd>: Stumm 🔇 | <kbd>Z</kbd>: Radar 🗺️ | <kbd>T</kbd>: Hupe 📢 | <kbd>N</kbd>: Nitro 🔥 | <kbd>F</kbd>: Schuss 💥</div>
      </div>

      <div class="hud-top-right">
        <div class="hud-cash" id="hud-cash">$500</div>
        <div class="hud-stars" id="hud-stars">
          <span class="hud-star">★</span>
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
        <div id="hud-race-leaderboard" style="display:none;background:rgba(15,23,42,0.92);border:2px solid #00e5ff;border-radius:10px;padding:6px 16px;margin-top:6px;box-shadow:0 0 20px rgba(0,229,255,0.4);text-align:center;">
          <div id="race-pos-badge" style="font-size:16px;font-weight:900;color:#ffea00;text-shadow:0 0 10px rgba(255,234,0,0.6);">🥇 1. PLATZ</div>
          <div style="display:flex;gap:12px;font-size:12px;font-weight:700;color:#94a3b8;margin-top:2px;justify-content:center;">
            <span id="race-checkpoint-info">CP: 1/9</span>
            <span id="race-time-info">⏱️ 0.0s</span>
          </div>
        </div>
      </div>

      <div class="hud-bottom-left" id="hud-minimap-container" style="cursor:pointer;" title="Klicken für Stadt-Übersicht / Nahbereich (Taste [Z])">
        <canvas id="minimap-canvas" width="140" height="140"></canvas>
        <div id="hud-minimap-hint" style="font-size:10px;text-align:center;color:#64748b;font-weight:700;margin-top:2px;">[Z] RADAR NAH</div>
      </div>

      <div class="hud-bottom-right">
        <div class="hud-speed-val" id="hud-speed">0</div>
        <div class="hud-speed-unit">KM/H</div>
        <div class="hud-gear" id="hud-gear">GANG: P</div>
        <div class="hud-rpm-bar" style="width:100%;height:5px;background:#1e293b;border-radius:3px;overflow:hidden;margin:4px 0;">
          <div id="hud-rpm-fill" style="width:100%;height:100%;background:#00f0ff;box-shadow:0 0 6px #00f0ff;transform-origin:left;transition:transform 0.05s ease-out;"></div>
        </div>

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
        <div class="hud-shop-section">
          <h4 style="color:#00d4ff;margin-bottom:6px;">🛠️ Performance-Tuning & Styling:</h4>
          <div id="hud-tuning-list"></div>
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

      <!-- Casino Modal -->
      <div class="hud-shop-modal" id="hud-casino-modal" style="border-color:#facc15;box-shadow:0 0 40px rgba(250,204,21,0.4);">
        <div class="hud-shop-title" style="color:#facc15;">
          <span>🎰 DIAMOND CYBER CASINO</span>
          <button id="hud-casino-close-btn" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div class="hud-shop-section" style="background:#1e293b;padding:14px;border-radius:8px;text-align:center;">
          <h4 style="color:#facc15;margin-bottom:8px;">🎰 Cyber-Spielautomat (Slots)</h4>
          <div id="casino-slot-reels" style="font-size:36px;letter-spacing:12px;margin:12px 0;">🎰 🎰 🎰</div>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button class="hud-shop-btn" onclick="window.gtaSpinSlots(50)">Dreh ($50)</button>
            <button class="hud-shop-btn" onclick="window.gtaSpinSlots(200)">Dreh ($200)</button>
            <button class="hud-shop-btn" onclick="window.gtaSpinSlots(1000)" style="background:#facc15;color:#000;">Highroller ($1000)</button>
          </div>
        </div>
        <div class="hud-shop-section" style="background:#1e293b;padding:14px;border-radius:8px;text-align:center;margin-top:10px;">
          <h4 style="color:#38bdf8;margin-bottom:8px;">🎡 Tägliches Glücksrad (Lucky Wheel)</h4>
          <button class="hud-shop-btn" id="hud-wheel-btn" onclick="window.gtaSpinWheel()" style="background:#38bdf8;color:#000;font-size:15px;padding:8px 24px;">Am Glücksrad drehen!</button>
        </div>
      </div>

      <!-- Settings & Pause Modal -->
      <div class="hud-shop-modal" id="hud-settings-modal" style="border-color:#38bdf8;box-shadow:0 0 45px rgba(56,189,248,0.45);max-width:440px;">
        <div class="hud-shop-title" style="color:#38bdf8;">
          <span>⚙️ OPTIONEN & PAUSE</span>
          <button id="hud-settings-close-btn" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
        </div>

        <div class="hud-shop-section" style="background:#1e293b;padding:12px;border-radius:8px;margin-bottom:10px;">
          <h4 style="color:#38bdf8;margin-bottom:8px;font-size:14px;">🔊 Audio-Lautstärke</h4>
          <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;font-size:12px;">
            <span>Gesamtlautstärke (Master):</span>
            <input type="range" id="setting-vol-master" min="0" max="100" value="100" style="width:130px;accent-color:#38bdf8;">
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;font-size:12px;">
            <span>Radio / Musik:</span>
            <input type="range" id="setting-vol-music" min="0" max="100" value="80" style="width:130px;accent-color:#a855f7;">
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;font-size:12px;">
            <span>Effekte (SFX & Motoren):</span>
            <input type="range" id="setting-vol-sfx" min="0" max="100" value="0" style="width:130px;accent-color:#22c55e;">
          </div>
        </div>

        <div class="hud-shop-section" style="background:#1e293b;padding:12px;border-radius:8px;margin-bottom:10px;">
          <h4 style="color:#facc15;margin-bottom:8px;font-size:14px;">✨ Grafik-Qualität</h4>
          <div style="display:flex;gap:6px;">
            <button class="hud-shop-btn" id="btn-gfx-low" style="flex:1;font-size:11px;padding:6px 0;">Niedrig</button>
            <button class="hud-shop-btn" id="btn-gfx-med" style="flex:1;font-size:11px;padding:6px 0;">Mittel</button>
            <button class="hud-shop-btn" id="btn-gfx-ultra" style="flex:1;font-size:11px;padding:6px 0;background:#00f0ff;color:#000;">Ultra (HD)</button>
          </div>
        </div>

        <div class="hud-shop-section" style="background:#1e293b;padding:12px;border-radius:8px;margin-bottom:10px;">
          <h4 style="color:#eab308;margin-bottom:8px;font-size:14px;">🖥️ Bildmodus</h4>
          <button class="hud-shop-btn" id="btn-toggle-fullscreen" style="width:100%;font-size:12px;padding:8px 0;background:#eab308;color:#000;font-weight:700;">⛶ Vollbild aktivieren</button>
        </div>

        <div class="hud-shop-section" style="background:#1e293b;padding:12px;border-radius:8px;font-size:11px;color:#94a3b8;line-height:1.5;">
          <h4 style="color:#e2e8f0;margin-bottom:6px;font-size:13px;">🎮 Gamepad-Steuerung</h4>
          <div>• <strong>Linker Stick:</strong> Lenken (Analog)</div>
          <div>• <strong>RT / R2:</strong> Gaspedal | <strong>LT / L2:</strong> Bremse</div>
          <div>• <strong>A / Cross:</strong> Handbremse | <strong>B / Circle:</strong> Nitro</div>
          <div>• <strong>Y / Dreieck:</strong> Einsteigen | <strong>X:</strong> Schießen</div>
        </div>
      </div>

      <!-- Floating Virtual Touch Joystick -->
      <div id="hud-joystick-base" style="position:absolute;width:96px;height:96px;border-radius:50%;border:2px solid rgba(0,240,255,0.45);background:rgba(15,23,42,0.5);pointer-events:none;display:none;transform:translate(-50%,-50%);z-index:45;">
        <div id="hud-joystick-knob" style="position:absolute;top:50%;left:50%;width:44px;height:44px;border-radius:50%;background:rgba(0,240,255,0.85);box-shadow:0 0 14px #00f0ff;transform:translate(-50%,-50%);"></div>
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
    this.casinoModalElement = document.getElementById('hud-casino-modal')!;
    this.settingsModalElement = document.getElementById('hud-settings-modal')!;
    this.raceLeaderboardElement = document.getElementById('hud-race-leaderboard')!;
    this.racePosBadge = document.getElementById('race-pos-badge')!;
    this.raceCheckpointInfo = document.getElementById('race-checkpoint-info')!;
    this.raceTimeInfo = document.getElementById('race-time-info')!;

    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.rpmFillElement = document.getElementById('hud-rpm-fill')!;
    this.minimapHintElement = document.getElementById('hud-minimap-hint')!;

    document.getElementById('hud-minimap-container')?.addEventListener('click', () => {
      this.toggleMinimapZoom();
    });

    document.getElementById('hud-shop-close-btn')!.addEventListener('click', () => {
      this.toggleShop(false);
    });
    document.getElementById('hud-multi-close-btn')!.addEventListener('click', () => {
      this.toggleMultiplayer(false);
    });
    document.getElementById('hud-casino-close-btn')!.addEventListener('click', () => {
      this.toggleCasino(false);
    });
    document.getElementById('hud-settings-close-btn')!.addEventListener('click', () => {
      this.toggleSettings(false);
    });

    this.bindCasinoHandlers();
    this.setupMultiplayerControls();
    this.setupSettingsControls();
    if (this.network) {
      this.setupNetworkCallbacks();
    }
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
    const muteBtn = document.getElementById('m-btn-mute');
    muteBtn?.addEventListener('click', () => {
      if (this.sound) {
        const isMuted = this.sound.toggleMute();
        this.updateMuteButton(isMuted);
        this.showNotification(isMuted ? 'Ton stummgeschaltet 🔇' : 'Ton aktiviert 🔊');
      }
    });

    document.getElementById('m-btn-radio')?.addEventListener('click', () => {
      if (this.input) this.input.touchState.radioCycle = true;
    });
    document.getElementById('m-btn-hover')?.addEventListener('click', () => {
      if (this.input) this.input.touchState.hoverToggle = true;
    });
    document.getElementById('m-btn-jetpack')?.addEventListener('click', () => {
      if (this.input) this.input.justPressed['j'] = true;
    });
    document.getElementById('m-btn-house')?.addEventListener('click', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    });
    document.getElementById('m-btn-casino')?.addEventListener('click', () => {
      this.toggleCasino();
    });
    document.getElementById('m-btn-build')?.addEventListener('click', () => {
      if (this.input) this.input.justPressed['tab'] = true;
    });
    document
      .getElementById('m-btn-multi')
      ?.addEventListener('click', () => this.toggleMultiplayer());
    document.getElementById('m-btn-shop')?.addEventListener('click', () => this.toggleShop());
    document.getElementById('m-btn-cam')?.addEventListener('click', () => {
      if (this.input) this.input.justPressed['c'] = true;
    });
    document.getElementById('m-btn-vr')?.addEventListener('click', () => {
      eventBus.emit('vr:toggle', {});
    });
    document.getElementById('m-btn-settings')?.addEventListener('click', () => {
      this.toggleSettings();
    });
    document.getElementById('m-btn-reset')?.addEventListener('click', () => {
      if (this.input) this.input.justPressed['r'] = true;
    });

    // Touch controls: Floating Virtual Joystick (Left) + Swipe Camera (Right)
    if (typeof window !== 'undefined') {
      const touchControls = document.getElementById('hud-touch-controls');
      const mobileQuickbar = document.querySelector('.hud-mobile-quickbar') as HTMLElement | null;
      let fadeTimer: number | null = null;
      const resetFade = (): void => {
        if (touchControls) touchControls.style.opacity = '1.0';
        if (mobileQuickbar) mobileQuickbar.style.opacity = '1.0';
        if (fadeTimer) window.clearTimeout(fadeTimer);
        fadeTimer = window.setTimeout(() => {
          if (touchControls) touchControls.style.opacity = '0.65';
          if (mobileQuickbar) mobileQuickbar.style.opacity = '0.55';
        }, 5000);
      };
      window.addEventListener('touchstart', resetFade, { passive: true });

      let lastTouchX: number | null = null;
      let swipeTouchId: number | null = null;

      let joystickTouchId: number | null = null;
      let joystickOriginX: number = 0;
      let joystickOriginY: number = 0;
      const joystickBase = document.getElementById('hud-joystick-base');
      const joystickKnob = document.getElementById('hud-joystick-knob');

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
              !target.closest('button') &&
              !target.closest('input')
            ) {
              if (t.clientX < window.innerWidth * 0.45 && joystickTouchId === null) {
                // Spawn floating joystick
                joystickTouchId = t.identifier;
                joystickOriginX = t.clientX;
                joystickOriginY = t.clientY;
                if (joystickBase && joystickKnob) {
                  joystickBase.style.left = `${joystickOriginX}px`;
                  joystickBase.style.top = `${joystickOriginY}px`;
                  joystickBase.style.display = 'block';
                  joystickKnob.style.transform = 'translate(-50%, -50%)';
                }
                if (this.input) {
                  this.input.triggerHaptics(25);
                }
              } else if (t.clientX >= window.innerWidth * 0.45 && swipeTouchId === null) {
                // Swipe turn
                lastTouchX = t.clientX;
                swipeTouchId = t.identifier;
              }
            }
          }
        },
        { passive: true },
      );

      window.addEventListener(
        'touchmove',
        (e: TouchEvent) => {
          if (!this.input) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === joystickTouchId && joystickBase && joystickKnob) {
              const dx = t.clientX - joystickOriginX;
              const dy = t.clientY - joystickOriginY;
              const dist = Math.hypot(dx, dy);
              const maxR = 38;
              const clamped = Math.min(dist, maxR);
              const angle = Math.atan2(dy, dx);
              const kx = Math.cos(angle) * clamped;
              const ky = Math.sin(angle) * clamped;
              joystickKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

              const threshold = 10;
              this.input.touchState.left = dx < -threshold;
              this.input.touchState.right = dx > threshold;
              this.input.touchState.forward = dy < -threshold;
              this.input.touchState.backward = dy > threshold;

              if (Math.abs(dx) > threshold) {
                this.input.touchTurnDelta += (dx / maxR) * 0.04;
              }
            } else if (t.identifier === swipeTouchId && lastTouchX !== null) {
              const dx = t.clientX - lastTouchX;
              lastTouchX = t.clientX;
              this.input.touchTurnDelta += dx * 0.007;
            }
          }
        },
        { passive: true },
      );

      const endTouch = (e: TouchEvent): void => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === joystickTouchId) {
            joystickTouchId = null;
            if (joystickBase) joystickBase.style.display = 'none';
            if (this.input) {
              this.input.touchState.left = false;
              this.input.touchState.right = false;
              this.input.touchState.forward = false;
              this.input.touchState.backward = false;
            }
          } else if (t.identifier === swipeTouchId) {
            swipeTouchId = null;
            lastTouchX = null;
          }
        }
      };

      window.addEventListener('touchend', endTouch, { passive: true });
      window.addEventListener('touchcancel', endTouch, { passive: true });
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
        this.showNotification('Bitte gültigen Code eingeben!');
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

  private setupSettingsControls(): void {
    const volMaster = document.getElementById('setting-vol-master') as HTMLInputElement | null;
    const volMusic = document.getElementById('setting-vol-music') as HTMLInputElement | null;
    const volSfx = document.getElementById('setting-vol-sfx') as HTMLInputElement | null;

    if (volMaster) {
      volMaster.addEventListener('input', () => {
        const val = parseFloat(volMaster.value) / 100;
        if (this.sound) this.sound.setMasterVolume(val);
      });
    }

    if (volMusic) {
      volMusic.addEventListener('input', () => {
        const val = parseFloat(volMusic.value) / 100;
        if (this.radio) this.radio.setMusicVolume(val);
      });
    }

    if (volSfx) {
      volSfx.addEventListener('input', () => {
        const val = parseFloat(volSfx.value) / 100;
        if (this.sound) this.sound.setSfxVolume(val);
      });
    }

    const btnLow = document.getElementById('btn-gfx-low');
    const btnMed = document.getElementById('btn-gfx-med');
    const btnUltra = document.getElementById('btn-gfx-ultra');

    const setGfxActive = (
      activeBtn: HTMLElement | null,
      quality: 'low' | 'med' | 'ultra',
    ): void => {
      [btnLow, btnMed, btnUltra].forEach((b) => {
        if (b) {
          b.style.background = '#0f172a';
          b.style.color = '#fff';
        }
      });
      if (activeBtn) {
        activeBtn.style.background = '#00f0ff';
        activeBtn.style.color = '#000';
      }
      if (this.rendererRef) {
        this.rendererRef.setGraphicsQuality(quality);
      }
      this.showNotification(`Grafik-Preset: ${quality.toUpperCase()}`);
    };

    btnLow?.addEventListener('click', () => setGfxActive(btnLow, 'low'));
    btnMed?.addEventListener('click', () => setGfxActive(btnMed, 'med'));
    btnUltra?.addEventListener('click', () => setGfxActive(btnUltra, 'ultra'));

    const toggleFs = (): void => {
      this.toggleFullscreen();
    };
    document.getElementById('m-btn-fullscreen')?.addEventListener('click', toggleFs);
    document.getElementById('btn-toggle-fullscreen')?.addEventListener('click', toggleFs);

    const updateFsButtons = (): void => {
      if (typeof document === 'undefined') return;
      const isFs = !!document.fullscreenElement;
      const mBtn = document.getElementById('m-btn-fullscreen');
      const setBtn = document.getElementById('btn-toggle-fullscreen');
      if (mBtn) mBtn.textContent = isFs ? '🗗 FENSTER' : '⛶ VOLL';
      if (setBtn) setBtn.textContent = isFs ? '🗗 Vollbild beenden' : '⛶ Vollbild aktivieren';
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', updateFsButtons);
      document.addEventListener('webkitfullscreenchange', updateFsButtons);
    }
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

    let lastRaceUpdate = 0;
    eventBus.on(EVENTS.RACE_UPDATE, (data) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastRaceUpdate < 100) return;
      lastRaceUpdate = now;
      const d = data as {
        position: number;
        totalRacers: number;
        currentCheckpoint: number;
        totalCheckpoints: number;
        elapsedTime: number;
      };
      if (this.raceLeaderboardElement) {
        this.raceLeaderboardElement.style.display = 'block';
        const medals = ['🥇 1.', '🥈 2.', '🥉 3.'];
        const badge = medals[d.position - 1] || `${d.position}.`;
        this.racePosBadge.textContent = `${badge} PLATZ (${d.position}/${d.totalRacers})`;
        this.racePosBadge.style.color =
          d.position === 1 ? '#ffea00' : d.position === 2 ? '#e2e8f0' : '#f97316';
        this.raceCheckpointInfo.textContent = `CP: ${d.currentCheckpoint}/${d.totalCheckpoints}`;
        this.raceTimeInfo.textContent = `⏱️ ${d.elapsedTime.toFixed(1)}s`;
      }
    });

    eventBus.on(EVENTS.RACE_COMPLETE, () => {
      setTimeout(() => {
        if (this.raceLeaderboardElement) {
          this.raceLeaderboardElement.style.display = 'none';
        }
      }, 5000);
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

  public updateMuteButton(isMuted: boolean): void {
    const muteBtn = document.getElementById('m-btn-mute');
    if (muteBtn) {
      muteBtn.textContent = isMuted ? '🔇 STUMM' : '🔊 TON';
      muteBtn.style.color = isMuted ? '#9ca3af' : '#ef4444';
      muteBtn.style.borderColor = isMuted ? '#9ca3af' : '#ef4444';
    }
  }

  private lastPrompt: string | null = null;

  public setPrompt(text: string | null): void {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    if (text) {
      this.promptElement.textContent = text;
      this.promptElement.style.display = 'block';
    } else {
      this.promptElement.style.display = 'none';
    }
  }

  public get isAnyModalOpen(): boolean {
    return this.isSettingsOpen || this.isShopOpen || this.isMultiOpen || this.isCasinoOpen;
  }

  public closeAllModals(except?: 'settings' | 'shop' | 'multi' | 'casino'): void {
    if (except !== 'settings' && this.isSettingsOpen) {
      this.isSettingsOpen = false;
      this.settingsModalElement.style.display = 'none';
    }
    if (except !== 'shop' && this.isShopOpen) {
      this.isShopOpen = false;
      this.shopModalElement.style.display = 'none';
    }
    if (except !== 'multi' && this.isMultiOpen) {
      this.isMultiOpen = false;
      this.multiModalElement.style.display = 'none';
    }
    if (except !== 'casino' && this.isCasinoOpen) {
      this.isCasinoOpen = false;
      this.casinoModalElement.style.display = 'none';
    }
  }

  public toggleShop(force?: boolean): boolean {
    const nextState = force !== undefined ? force : !this.isShopOpen;
    if (nextState) {
      this.closeAllModals('shop');
    }
    this.isShopOpen = nextState;
    this.shopModalElement.style.display = this.isShopOpen ? 'block' : 'none';
    if (this.isShopOpen) {
      this.renderShopContent();
    }
    return this.isShopOpen;
  }

  public toggleMultiplayer(force?: boolean): boolean {
    const nextState = force !== undefined ? force : !this.isMultiOpen;
    if (nextState) {
      this.closeAllModals('multi');
    }
    this.isMultiOpen = nextState;
    this.multiModalElement.style.display = this.isMultiOpen ? 'block' : 'none';
    return this.isMultiOpen;
  }

  public toggleCasino(force?: boolean): boolean {
    const nextState = force !== undefined ? force : !this.isCasinoOpen;
    if (nextState) {
      this.closeAllModals('casino');
    }
    this.isCasinoOpen = nextState;
    this.casinoModalElement.style.display = this.isCasinoOpen ? 'block' : 'none';
    if (this.isCasinoOpen) {
      this.bindCasinoHandlers();
    }
    return this.isCasinoOpen;
  }

  public toggleSettings(force?: boolean): boolean {
    const nextState = force !== undefined ? force : !this.isSettingsOpen;
    if (nextState) {
      this.closeAllModals('settings');
    }
    this.isSettingsOpen = nextState;
    this.settingsModalElement.style.display = this.isSettingsOpen ? 'block' : 'none';
    return this.isSettingsOpen;
  }

  public toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement as unknown as {
          requestFullscreen?: () => Promise<void>;
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (typeof el.requestFullscreen === 'function') {
          el.requestFullscreen().catch(() => {});
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          el.webkitRequestFullscreen().catch(() => {});
        }
      } else {
        if (typeof document.exitFullscreen === 'function') {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch (_e) {
      void _e;
    }
  }

  public toggleMinimapZoom(): void {
    this.isMinimapZoomed = !this.isMinimapZoomed;
    if (this.minimapHintElement) {
      this.minimapHintElement.textContent = this.isMinimapZoomed
        ? '[Z] STADT VOLL'
        : '[Z] RADAR NAH';
    }
    this.showNotification(
      this.isMinimapZoomed ? '🗺️ Minimap: Stadt-Übersicht (Weit)' : '🗺️ Minimap: Nahbereich-Radar',
    );
  }

  private bindCasinoHandlers(): void {
    (window as unknown as { gtaSpinSlots: (bet: number) => void }).gtaSpinSlots = (
      bet: number,
    ): void => {
      if (this.casino) {
        const res = this.casino.spinSlots(bet);
        const reelsEl = document.getElementById('casino-slot-reels');
        if (reelsEl) {
          reelsEl.textContent = `${res.reels[0]} ${res.reels[1]} ${res.reels[2]}`;
        }
      }
    };

    (window as unknown as { gtaSpinWheel: () => void }).gtaSpinWheel = (): void => {
      if (this.casino) {
        this.casino.spinLuckyWheel();
        const btn = document.getElementById('hud-wheel-btn');
        if (btn) {
          btn.textContent = 'Morgen wieder drehen! ✓';
          (btn as HTMLButtonElement).disabled = true;
        }
      }
    };
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

    const tuningList = document.getElementById('hud-tuning-list');
    if (tuningList && this.economy.tuningUpgrades) {
      tuningList.innerHTML = this.economy.tuningUpgrades
        .map(
          (u) => `
        <div class="hud-shop-item">
          <div>
            <strong>${u.name}</strong>
            <div style="font-size:12px;color:#94a3b8;">${u.description}</div>
          </div>
          <div>
            ${
              u.purchased
                ? `<span style="color:#22c55e;font-weight:700;">Installiert ✓</span>`
                : `<button class="hud-shop-btn" onclick="window.gtaBuyTuning('${u.id}')">$${u.price}</button>`
            }
          </div>
        </div>
      `,
        )
        .join('');
    }

    (window as unknown as { gtaBuyCar: (id: string) => void }).gtaBuyCar = (id: string): void => {
      if (this.economy.buyCar(id)) {
        this.renderShopContent();
      } else {
        this.showNotification('❌ Nicht genug Geld!');
      }
    };
    (window as unknown as { gtaBuyWeapon: (id: string) => void }).gtaBuyWeapon = (
      id: string,
    ): void => {
      if (this.economy.buyWeapon(id)) {
        this.renderShopContent();
      } else {
        this.showNotification('❌ Nicht genug Geld!');
      }
    };
    (window as unknown as { gtaEquipWeapon: (id: string) => void }).gtaEquipWeapon = (
      id: string,
    ): void => {
      this.economy.equipWeapon(id);
      this.renderShopContent();
    };
    (window as unknown as { gtaBuyTuning: (id: string) => void }).gtaBuyTuning = (
      id: string,
    ): void => {
      if (this.economy.buyTuning(id)) {
        this.renderShopContent();
        eventBus.emit('tuning:applied', { id });
      }
    };
  }

  public updateVehicleStats(
    speedKmh: number,
    gear: string | number,
    health: number,
    nitro: number = 100,
    inCar: boolean = true,
    isHoverMode: boolean = false,
    rpm: number = 0.2,
  ): void {
    const absSpeed = Math.abs(speedKmh);
    if (absSpeed !== this.lastSpeed) {
      this.lastSpeed = absSpeed;
      this.speedElement.textContent = String(absSpeed);
    }

    if (isHoverMode !== this.lastIsHover || gear !== this.lastGear) {
      this.lastIsHover = isHoverMode;
      this.lastGear = gear;
      if (isHoverMode) {
        this.gearElement.textContent = 'MODUS: 🚀 HOVER FLUG';
        this.gearElement.style.color = '#00f0ff';
        this.gearElement.style.textShadow = '0 0 10px #00f0ff';
      } else {
        this.gearElement.textContent = `GANG: ${gear}`;
        this.gearElement.style.color = '#38bdf8';
        this.gearElement.style.textShadow = 'none';
      }
    }

    if (this.rpmFillElement) {
      if (Math.abs(rpm - this.lastRpm) > 0.01) {
        this.lastRpm = rpm;
        const rpmScale = Math.max(0.08, Math.min(1, rpm));
        this.rpmFillElement.style.transform = `scaleX(${rpmScale})`;
        if (rpm >= 0.82) {
          this.rpmFillElement.style.backgroundColor = '#ef4444';
          this.rpmFillElement.style.boxShadow = '0 0 8px #ef4444';
        } else {
          this.rpmFillElement.style.backgroundColor = '#00f0ff';
          this.rpmFillElement.style.boxShadow = '0 0 6px #00f0ff';
        }
      }
    }

    if (inCar !== this.lastInCar) {
      this.lastInCar = inCar;
      this.nitroContainerElement.style.display = inCar ? 'block' : 'none';
    }

    if (Math.abs(nitro - this.lastNitro) > 0.5) {
      this.lastNitro = nitro;
      const nitroScale = Math.max(0, Math.min(1, nitro / 100));
      this.nitroFillElement.style.transform = `scaleX(${nitroScale})`;
    }

    if (Math.abs(health - this.lastHealth) > 0.5 || inCar !== this.lastInCar) {
      this.lastHealth = health;
      const healthPct = Math.max(0, Math.min(100, Math.round(health)));
      this.healthFillElement.style.transform = `scaleX(${healthPct / 100})`;

      if (healthPct > 50) {
        this.healthFillElement.style.backgroundColor = '#22c55e';
      } else if (healthPct > 25) {
        this.healthFillElement.style.backgroundColor = '#f59e0b';
      } else {
        this.healthFillElement.style.backgroundColor = '#ef4444';
      }

      this.healthTextElement.textContent =
        healthPct <= 0
          ? inCar
            ? 'AUTO ZERSTÖRT 💥'
            : 'AUSSER GEFECHT 💀'
          : inCar
            ? `INTEGRITÄT ${healthPct}%`
            : `LEBEN ${healthPct}%`;
    }
  }

  public updateMinimap(
    playerX: number,
    playerZ: number,
    heading: number,
    cops: { x: number; z: number }[],
    trafficCars: { x: number; z: number }[] = [],
    activeTarget: { x: number; z: number; color?: string } | null = null,
    remotePeer: { x: number; z: number } | null = null,
    alienBlips: { x: number; z: number; isUfo?: boolean }[] = [],
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastMinimapTime < 33) {
      return;
    }
    this.lastMinimapTime = now;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const center = w / 2;
    const scale = this.isMinimapZoomed ? 0.16 : 0.38;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(center, center);

    const isMoon = Math.hypot(playerX - 2500, playerZ - 2500) < 600;

    if (isMoon) {
      // Lunar surface background (Mare Tranquillitatis Gray Regolith)
      const ox = (2500 - playerX) * scale;
      const oz = (2500 - playerZ) * scale;
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(ox, oz, 280 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Tycho Crater (South Mega Stunt Crater)
      const tcx = (2500 - playerX) * scale;
      const tcz = (2680 - playerZ) * scale;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(tcx, tcz, 48 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.fill();

      // Copernicus Crater (West Impact Crater)
      const ccx = (2360 - playerX) * scale;
      const ccz = (2500 - playerZ) * scale;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ccx, ccz, 36 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.fill();

      // Lunar Rover Highway (Snake Way)
      const swx = (2500 - playerX) * scale;
      const swz1 = (2550 - playerZ) * scale;
      const swz2 = (2670 - playerZ) * scale;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(swx, swz1);
      ctx.lineTo(swx, swz2);
      ctx.stroke();

      // Apollo 11 Lunar Module Site (Eagle 🚀)
      const ax = (2420 - playerX) * scale;
      const az = (2430 - playerZ) * scale;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(ax, az, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚀', ax, az);

      // Moon Base Alpha Bio-Dome (🌐)
      const bdx = (2500 - playerX) * scale;
      const bdz = (2440 - playerZ) * scale;
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(bdx, bdz, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌐', bdx, bdz);

      // Deep Space Earth Communications Dish (📡)
      const dsx = (2565 - playerX) * scale;
      const dsz = (2480 - playerZ) * scale;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(dsx, dsz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📡', dsx, dsz);

      // Alien Monolith (⬛)
      const mx = (2620 - playerX) * scale;
      const mz = (2380 - playerZ) * scale;
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(mx - 4, mz - 4, 8, 8);
      ctx.font = '7px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⬛', mx, mz);

      // Return Stargate Portal (🌀)
      const rpx = (2500 - playerX) * scale;
      const rpz = (2500 - playerZ) * scale;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rpx, rpz, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌀', rpx, rpz);

      // Lunar Alien Threat Blips (Xenomorphs 👽 & Scout UFOs 🛸)
      alienBlips.forEach((alien) => {
        const ax = (alien.x - playerX) * scale;
        const az = (alien.z - playerZ) * scale;

        ctx.fillStyle = alien.isUfo ? '#06b6d4' : '#22c55e';
        ctx.beginPath();
        ctx.arc(ax, az, alien.isUfo ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = alien.isUfo ? '#38bdf8' : '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(alien.isUfo ? '🛸' : '👽', ax, az - 5);
      });
    } else {
      // City grid roads (expanded 7x7 grid)
      const maxRoad = 308;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 5;
      for (let x = -maxRoad; x <= maxRoad; x += 88) {
        ctx.beginPath();
        ctx.moveTo((x - playerX) * scale, (-maxRoad - playerZ) * scale);
        ctx.lineTo((x - playerX) * scale, (maxRoad - playerZ) * scale);
        ctx.stroke();
      }
      for (let z = -maxRoad; z <= maxRoad; z += 88) {
        ctx.beginPath();
        ctx.moveTo((-maxRoad - playerX) * scale, (z - playerZ) * scale);
        ctx.lineTo((maxRoad - playerX) * scale, (z - playerZ) * scale);
        ctx.stroke();
      }

      // Grand Central Cyber Park (Emerald Green 🌳)
      const cpx = (0 - playerX) * scale;
      const cpz = (0 - playerZ) * scale;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(cpx - 5, cpz - 5, 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌳', cpx, cpz);

      // GTA 7 Airport (Sky Blue ✈️)
      const apx = (176 - playerX) * scale;
      const apz = (0 - playerZ) * scale;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(apx - 6, apz - 6, 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✈️', apx, apz);

      // Stunt Mega Stadium (Amber 🛹)
      const ssx = (-88 - playerX) * scale;
      const ssz = (176 - playerZ) * scale;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(ssx - 5, ssz - 5, 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛹', ssx, ssz);

      // Lighthouse Island in Western Ocean (Crimson 🗼)
      const lhx = (-350 - playerX) * scale;
      const lhz = (0 - playerZ) * scale;
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(lhx, lhz, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🗼', lhx, lhz);

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

      // Dimensional Portal Icon (Pulsing Violet Ring with Cyan Core 🌀)
      const px = (-185 - playerX) * scale;
      const pz = (132 - playerZ) * scale;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(px, pz, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, pz, 2, 0, Math.PI * 2);
      ctx.fill();

      // Enterable Buildings Icons (Safehouse, Gun Store, Club, Hacker Loft, Bank)
      const enterableBuildings = [
        { x: -88, z: -56, icon: '🏠', bg: '#facc15' }, // Penthouse Safehouse
        { x: 56, z: -88, icon: '🔫', bg: '#ef4444' }, // Ammu-Nation Waffenladen
        { x: 88, z: 56, icon: '🍸', bg: '#ec4899' }, // Club Neon Dreams
        { x: -144, z: 0, icon: '💻', bg: '#00f0ff' }, // Hacker Syndikat Loft
        { x: 0, z: 56, icon: '🏦', bg: '#eab308' }, // Cyber City Bank
      ];
      enterableBuildings.forEach((b) => {
        const bx = (b.x - playerX) * scale;
        const bz = (b.z - playerZ) * scale;
        ctx.fillStyle = b.bg;
        ctx.beginPath();
        ctx.arc(bx, bz, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.icon, bx, bz);
      });

      // Player's Own Luxury Villa ("Dein Eigenes Haus" 👑)
      const vhx = (-176 - playerX) * scale;
      const vhz = (-172 - playerZ) * scale;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(vhx, vhz, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', vhx, vhz);
    }

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

    // Local Player Arrow at center (inverted heading to match 2D canvas Y-axis)
    ctx.rotate(-heading);
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
