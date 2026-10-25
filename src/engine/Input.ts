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

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this.onKeyDown(e));
      window.addEventListener('keyup', (e) => this.onKeyUp(e));
      window.addEventListener('mousedown', (e) => this.onMouseDown(e));
      window.addEventListener('mouseup', () => this.onMouseUp());
    }
  }

  private onMouseDown(e: MouseEvent): void {
    // Only fire if not clicking inside shop modal or UI buttons
    const target = e.target as HTMLElement;
    if (target && (target.closest('.hud-shop-modal') || target.tagName === 'BUTTON')) {
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

  public get forward(): boolean {
    return this.isDown('w') || this.isDown('arrowup') || this.touchState.forward;
  }

  public get backward(): boolean {
    return this.isDown('s') || this.isDown('arrowdown') || this.touchState.backward;
  }

  public get left(): boolean {
    return this.isDown('a') || this.isDown('arrowleft') || this.touchState.left;
  }

  public get right(): boolean {
    return this.isDown('d') || this.isDown('arrowright') || this.touchState.right;
  }

  public get handbrake(): boolean {
    return this.isDown(' ') || this.touchState.handbrake;
  }

  public get sprint(): boolean {
    return this.isDown('shift') || this.touchState.forward;
  }

  public get nitro(): boolean {
    return this.isDown('n') || this.isDown('shift') || this.touchState.nitro;
  }

  public get actionInteract(): boolean {
    const act = this.wasJustPressed('e') || this.touchState.actionInteract;
    this.touchState.actionInteract = false;
    return act;
  }

  public get fire(): boolean {
    const fired = this.wasMouseJustPressed || this.wasJustPressed('f') || this.touchState.fire;
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
    return this.isDown(' ') || this.touchState.ascend;
  }

  public get jump(): boolean {
    return this.isDown(' ') || this.touchState.ascend;
  }

  public get descend(): boolean {
    return this.isDown('c') || this.isDown('control') || this.touchState.descend;
  }

  public get horn(): boolean {
    return this.isDown('h') || this.touchState.horn;
  }

  public get cycleRadio(): boolean {
    const act = this.wasJustPressed('b') || this.touchState.radioCycle;
    this.touchState.radioCycle = false;
    return act;
  }

  public get toggleShop(): boolean {
    return this.wasJustPressed('g');
  }

  public get toggleMultiplayer(): boolean {
    return this.wasJustPressed('p');
  }

  public get startJob(): boolean {
    return this.wasJustPressed('j');
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
}
