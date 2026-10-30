export class Input {
  public keys: { [key: string]: boolean } = {};
  public justPressed: { [key: string]: boolean } = {};
  public isMouseDown: boolean = false;
  public wasMouseJustPressed: boolean = false;

  // Mobile Touch Controls State
  public touchTurnDelta: number = 0;
  public touchState: { [key: string]: boolean } = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    nitro: false,
    handbrake: false,
    fire: false,
    actionInteract: false,
    horn: false,
    hoverToggle: false,
    ascend: false,
    descend: false,
    radioCycle: false,
  };

  // Gamepad State (HTML5 Gamepad API)
  public gamepadIndex: number | null = null;
  public gamepadSteerAxis: number = 0;
  public gamepadStickY: number = 0;
  public gamepadThrottle: number = 0;
  public gamepadBrake: number = 0;
  public gamepadHandbrake: boolean = false;
  public gamepadNitro: boolean = false;
  public gamepadAction: boolean = false;
  public gamepadFire: boolean = false;
  public gamepadHover: boolean = false;
  public gamepadRadio: boolean = false;
  public gamepadPause: boolean = false;
  public gamepadReset: boolean = false;
  private lastRumbleTime: number = 0;
  private lastHapticTime: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this.onKeyDown(e));
      window.addEventListener('keyup', (e) => this.onKeyUp(e));
      window.addEventListener('mousedown', (e) => this.onMouseDown(e));
      window.addEventListener('mouseup', () => this.onMouseUp());
      window.addEventListener('blur', () => this.resetAll());
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.resetAll();
      });
    }
  }

  public static isTextInputFocused(e?: Event): boolean {
    const el = (e?.target ??
      (typeof document !== 'undefined' ? document.activeElement : null)) as HTMLElement | null;
    return (
      !!el &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable)
    );
  }

  public resetAll(): void {
    this.keys = {};
    this.justPressed = {};
    this.isMouseDown = false;
    this.wasMouseJustPressed = false;
    this.touchTurnDelta = 0;
    for (const k in this.touchState) {
      this.touchState[k] = false;
    }
  }

  public endFrame(): void {
    this.wasMouseJustPressed = false;
  }

  private onMouseDown(e: MouseEvent): void {
    // Only fire if not clicking inside modal or UI buttons
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.closest(
        'button, input, select, textarea, a, .hud-shop-modal, .hud-multi-modal, #hud-settings-modal, #hud-casino-modal, .hud-mobile-quickbar, .hud-menu, .hud-controls-helper',
      ) ||
        target.tagName === 'BUTTON')
    ) {
      return;
    }
    this.isMouseDown = true;
    this.wasMouseJustPressed = true;
  }

  private onMouseUp(): void {
    this.isMouseDown = false;
    this.wasMouseJustPressed = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (Input.isTextInputFocused(e) && e.key.toLowerCase() !== 'escape') {
      return;
    }
    const key = e.key.toLowerCase();
    if (!this.keys[key]) {
      this.justPressed[key] = true;
    }
    this.keys[key] = true;

    // Prevent scrolling for game control keys
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.keys[key] = false;
    this.justPressed[key] = false;
  }

  public isDown(key: string): boolean {
    return !!this.keys[key.toLowerCase()];
  }

  public wasJustPressed(key: string): boolean {
    const pressed = !!this.justPressed[key.toLowerCase()];
    this.justPressed[key.toLowerCase()] = false;
    return pressed;
  }

  public pollGamepad(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    let gp: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i]!.connected) {
        gp = gamepads[i];
        this.gamepadIndex = i;
        break;
      }
    }

    if (!gp) {
      this.gamepadSteerAxis = 0;
      this.gamepadStickY = 0;
      this.gamepadThrottle = 0;
      this.gamepadBrake = 0;
      this.gamepadHandbrake = false;
      this.gamepadNitro = false;
      this.gamepadAction = false;
      this.gamepadFire = false;
      this.gamepadHover = false;
      this.gamepadRadio = false;
      this.gamepadPause = false;
      this.gamepadReset = false;
      return;
    }

    // Left Stick X (-1 left, +1 right) with 0.18 deadzone
    const rawX = gp.axes[0] !== undefined ? gp.axes[0] : 0;
    this.gamepadSteerAxis = Math.abs(rawX) > 0.18 ? rawX : 0;

    // Left Stick Y (-1 forward/up, +1 backward/down) with 0.18 deadzone
    const rawY = gp.axes[1] !== undefined ? gp.axes[1] : 0;
    this.gamepadStickY = Math.abs(rawY) > 0.18 ? rawY : 0;

    // Right Trigger (RT / R2: button index 7)
    const btnRT = gp.buttons[7];
    this.gamepadThrottle = btnRT ? (typeof btnRT === 'object' ? btnRT.value : btnRT ? 1 : 0) : 0;

    // Left Trigger (LT / L2: button index 6)
    const btnLT = gp.buttons[6];
    this.gamepadBrake = btnLT ? (typeof btnLT === 'object' ? btnLT.value : btnLT ? 1 : 0) : 0;

    // Buttons
    // 0: A / Cross
    this.gamepadHandbrake = !!(gp.buttons[0] && gp.buttons[0].pressed);
    // 1: B / Circle
    this.gamepadNitro = !!(gp.buttons[1] && gp.buttons[1].pressed);
    // 2: X / Square
    this.gamepadFire = !!(gp.buttons[2] && gp.buttons[2].pressed);

    // 3: Y / Triangle
    const actPressed = !!(gp.buttons[3] && gp.buttons[3].pressed);
    if (actPressed && !this.gamepadAction) {
      this.justPressed['e'] = true;
    }
    this.gamepadAction = actPressed;

    // 4: LB / L1
    const radioPressed = !!(gp.buttons[4] && gp.buttons[4].pressed);
    if (radioPressed && !this.gamepadRadio) {
      this.justPressed['b'] = true;
    }
    this.gamepadRadio = radioPressed;

    // 5: RB / R1
    const hoverPressed = !!(gp.buttons[5] && gp.buttons[5].pressed);
    if (hoverPressed && !this.gamepadHover) {
      this.justPressed['v'] = true;
    }
    this.gamepadHover = hoverPressed;

    // 9: Start / Options
    const pausePressed = !!(gp.buttons[9] && gp.buttons[9].pressed);
    if (pausePressed && !this.gamepadPause) {
      this.justPressed['escape'] = true;
    }
    this.gamepadPause = pausePressed;

    // 8: Back / Select
    const resetPressed = !!(gp.buttons[8] && gp.buttons[8].pressed);
    if (resetPressed && !this.gamepadReset) {
      this.justPressed['r'] = true;
    }
    this.gamepadReset = resetPressed;
  }

  public triggerRumble(intensity: number = 0.5, durationMs: number = 180): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastRumbleTime < 120) return;
    this.lastRumbleTime = now;

    try {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;
        const actuator = (
          gp as unknown as {
            vibrationActuator?: {
              playEffect: (type: string, params: unknown) => Promise<unknown>;
            };
          }
        ).vibrationActuator;
        if (actuator && typeof actuator.playEffect === 'function') {
          actuator
            .playEffect('dual-rumble', {
              startDelay: 0,
              duration: durationMs,
              weakMagnitude: Math.min(1.0, Math.round(intensity * 70) / 100),
              strongMagnitude: Math.min(1.0, Math.round(intensity * 100) / 100),
            })
            .catch(() => {});
        }
      }
    } catch (_e) {
      void _e;
    }
  }

  public triggerHaptics(durationMs: number = 40): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this.lastHapticTime < 100) return;
      this.lastHapticTime = now;

      try {
        navigator.vibrate(durationMs);
      } catch (_e) {
        void _e;
      }
    }
  }

  public get forward(): boolean {
    return (
      this.isDown('w') ||
      this.isDown('arrowup') ||
      this.touchState.forward ||
      this.gamepadThrottle > 0.15 ||
      this.gamepadStickY < -0.2
    );
  }

  public get backward(): boolean {
    return (
      this.isDown('s') ||
      this.isDown('arrowdown') ||
      this.touchState.backward ||
      this.gamepadBrake > 0.15 ||
      this.gamepadStickY > 0.2
    );
  }

  public get left(): boolean {
    return (
      this.isDown('a') ||
      this.isDown('arrowleft') ||
      this.touchState.left ||
      this.gamepadSteerAxis < -0.2
    );
  }

  public get right(): boolean {
    return (
      this.isDown('d') ||
      this.isDown('arrowright') ||
      this.touchState.right ||
      this.gamepadSteerAxis > 0.2
    );
  }

  public get handbrake(): boolean {
    return this.isDown(' ') || this.touchState.handbrake || this.gamepadHandbrake;
  }

  public get sprint(): boolean {
    return this.isDown('shift') || this.touchState.forward;
  }

  public get nitro(): boolean {
    return this.isDown('n') || this.isDown('shift') || this.touchState.nitro || this.gamepadNitro;
  }

  public get actionInteract(): boolean {
    const act = this.wasJustPressed('e') || this.touchState.actionInteract;
    this.touchState.actionInteract = false;
    return act;
  }

  public get fire(): boolean {
    const fired =
      this.wasMouseJustPressed ||
      this.wasJustPressed('f') ||
      this.touchState.fire ||
      this.gamepadFire;
    this.wasMouseJustPressed = false;
    this.touchState.fire = false;
    return fired;
  }

  public get hoverToggle(): boolean {
    const toggled =
      this.wasJustPressed('v') || this.wasJustPressed('x') || this.touchState.hoverToggle;
    this.touchState.hoverToggle = false;
    return toggled;
  }

  public get ascend(): boolean {
    return this.isDown(' ') || this.touchState.ascend || this.gamepadHandbrake;
  }

  public get jump(): boolean {
    return this.isDown(' ') || this.touchState.ascend || this.gamepadHandbrake;
  }

  public get descend(): boolean {
    return this.isDown('control') || this.touchState.descend;
  }

  public get horn(): boolean {
    return this.isDown('t') || this.touchState.horn;
  }

  public get cycleRadio(): boolean {
    const act = this.wasJustPressed('b') || this.touchState.radioCycle;
    this.touchState.radioCycle = false;
    return act;
  }

  public get toggleShop(): boolean {
    return this.wasJustPressed('g');
  }

  public get toggleSettings(): boolean {
    return this.wasJustPressed('escape');
  }

  public get toggleMultiplayer(): boolean {
    return this.wasJustPressed('p');
  }

  public get startJob(): boolean {
    return this.wasJustPressed('o');
  }

  public get cycleCamera(): boolean {
    return this.wasJustPressed('c');
  }

  public get resetVehicle(): boolean {
    return this.wasJustPressed('r');
  }

  public get toggleLights(): boolean {
    return this.wasJustPressed('l');
  }

  public get toggleMute(): boolean {
    return this.wasJustPressed('m');
  }

  public get toggleMinimap(): boolean {
    return this.wasJustPressed('z');
  }
}
