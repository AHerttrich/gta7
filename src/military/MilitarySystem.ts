import * as THREE from 'three';
import { Tank } from '../vehicles/Tank';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';

export interface MilitaryBaseConfig {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export class MilitarySystem {
  public group: THREE.Group;
  public baseConfig: MilitaryBaseConfig = {
    x: 150,
    z: 150,
    width: 90,
    depth: 90,
  };

  public parkedTank: Tank;
  private scene: THREE.Scene;
  private watchtowerLights: THREE.SpotLight[] = [];
  private searchlightTargets: THREE.Object3D[] = [];
  private searchlightAngle: number = 0;
  private isPlayerInBase: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildArea77Base();

    // Park a drivable Rhino Tank in the military hangar
    this.parkedTank = new Tank(this.baseConfig.x, this.baseConfig.z, Math.PI / 4);
    this.scene.add(this.parkedTank.group);
  }

  private buildArea77Base(): void {
    const { x, z, width, depth } = this.baseConfig;

    // 1. Perimeter fence walls removed completely - no more solid black barrier walls blocking city roads!

    // 2. Watchtowers with Rotating Searchlights at Corners
    const corners = [
      { cx: x - width / 2 + 2, cz: z - depth / 2 + 2 },
      { cx: x + width / 2 - 2, cz: z - depth / 2 + 2 },
      { cx: x - width / 2 + 2, cz: z + depth / 2 - 2 },
      { cx: x + width / 2 - 2, cz: z + depth / 2 - 2 },
    ];

    corners.forEach((c) => {
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(3.5, 14, 3.5), towerMat);
      tower.position.set(c.cx, 7, c.cz);
      this.group.add(tower);

      // Cabin Platform on top
      const cab = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.5, 5.0), towerMat);
      cab.position.set(c.cx, 14.5, c.cz);
      this.group.add(cab);

      // Searchlight
      const spot = new THREE.SpotLight(0xfffaed, 8, 80, Math.PI / 6, 0.4, 1.5);
      spot.position.set(c.cx, 15.5, c.cz);
      const target = new THREE.Object3D();
      target.position.set(c.cx, 0, c.cz);
      this.group.add(spot, target);
      spot.target = target;

      this.watchtowerLights.push(spot);
      this.searchlightTargets.push(target);
    });

    // 3. Heavy Armored Tank Hangar
    const hangarMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.6,
    });
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 24), hangarMat);
    hangar.position.set(x, 4.5, z);
    this.group.add(hangar);

    // Neon Area 77 Warning Hologram
    const signMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 0.4), signMat);
    sign.position.set(x, 10.2, z - 12.2);
    this.group.add(sign);
  }

  public update(dt: number, playerX: number, playerZ: number): { triggerArea77Alarm: boolean } {
    this.searchlightAngle += dt * 0.8;

    // Sweep searchlights
    for (let i = 0; i < this.searchlightTargets.length; i++) {
      const offset = (i * Math.PI) / 2;
      const target = this.searchlightTargets[i];
      target.position.x = this.baseConfig.x + Math.sin(this.searchlightAngle + offset) * 35;
      target.position.z = this.baseConfig.z + Math.cos(this.searchlightAngle + offset) * 35;
    }

    // Check if player penetrates Area 77 perimeter
    const inBounds =
      Math.abs(playerX - this.baseConfig.x) < this.baseConfig.width / 2 &&
      Math.abs(playerZ - this.baseConfig.z) < this.baseConfig.depth / 2;

    let triggerAlarm = false;
    if (inBounds && !this.isPlayerInBase) {
      this.isPlayerInBase = true;
      triggerAlarm = true;
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: '🚨 MILITÄRISCHES SPERRGEBIET BETRETEN! Maximaler Alarm!',
      });
    } else if (!inBounds && this.isPlayerInBase) {
      this.isPlayerInBase = false;
    }

    return { triggerArea77Alarm: triggerAlarm };
  }
}
