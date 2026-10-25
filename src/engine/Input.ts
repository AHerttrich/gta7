export class Input {
  public keys: { [key: string]: boolean } = {};
  public justPressed: { [key: string]: boolean } = {};

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
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

  public get actionInteract(): boolean {
    return this.wasJustPressed('e') || this.wasJustPressed('f');
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
