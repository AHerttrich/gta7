export class Input {
  public keys: { [key: string]: boolean } = {};
  public justPressed: { [key: string]: boolean } = {};
  public isMouseDown: boolean = false;
  public wasMouseJustPressed: boolean = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
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
    return this.isDown('w') || this.isDown('arrowup');
  }

  public get backward(): boolean {
    return this.isDown('s') || this.isDown('arrowdown');
  }

  public get left(): boolean {
    return this.isDown('a') || this.isDown('arrowleft');
  }

  public get right(): boolean {
    return this.isDown('d') || this.isDown('arrowright');
  }

  public get handbrake(): boolean {
    return this.isDown(' ');
  }

  public get sprint(): boolean {
    return this.isDown('shift');
  }

  public get nitro(): boolean {
    return this.isDown('n') || this.isDown('shift');
  }

  public get actionInteract(): boolean {
    return this.wasJustPressed('e');
  }

  public get fire(): boolean {
    const fired = this.wasMouseJustPressed || this.wasJustPressed('f') || this.wasJustPressed('x');
    this.wasMouseJustPressed = false;
    return fired;
  }

  public get horn(): boolean {
    return this.isDown('h');
  }

  public get toggleShop(): boolean {
    return this.wasJustPressed('g');
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
