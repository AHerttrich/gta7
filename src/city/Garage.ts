import * as THREE from 'three';
import { Car } from '../vehicles/Car';
import { PoliceSystem } from '../police/PoliceSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { HUD } from '../ui/HUD';

export class Garage {
  public group: THREE.Group;
  public x: number;
  public z: number;

  constructor() {
    this.x = 99999;
    this.z = 99999;
    this.group = new THREE.Group();
    // Removed developer placeholder black block completely from the city street
  }

  public update(
    _dt: number,
    _car: Car,
    _police: PoliceSystem,
    _economy: EconomySystem,
    _sound: SoundManager,
    _hud: HUD,
  ): void {
    // Pay 'n' Spray black block removed; vehicle repair & custom paint are handled via [R] key and HUD Shop
  }
}
