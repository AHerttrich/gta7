import * as THREE from 'three';

export interface BoatInput {
  throttle: boolean;
  reverse: boolean;
  steerLeft: boolean;
  steerRight: boolean;
}

export class Boat {
  public group: THREE.Group;
  public x: number;
  public y: number = 0.2;
  public z: number;
  public heading: number = 0;
  public speed: number = 0;
  public isJetSki: boolean;
  public health: number = 200;

  constructor(startX: number, startZ: number, isJetSki: boolean = false) {
    this.x = startX;
    this.z = startZ;
    this.isJetSki = isJetSki;
    this.group = new THREE.Group();
    this.buildBoatMesh();
    this.group.position.set(this.x, this.y, this.z);
  }

  private buildBoatMesh(): void {
    if (this.isJetSki) {
      // 1. Cyber Jet-Ski (Sleek, Compact, Neon Lime)
      const hullGeo = new THREE.BoxGeometry(1.2, 0.5, 2.8);
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x39ff14, // Toxic Lime
        metalness: 0.8,
        roughness: 0.2,
      });
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.25;
      this.group.add(hull);

      // Handlebars
      const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
      barGeo.rotateZ(Math.PI / 2);
      const barMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(0, 0.75, 0.5);
      this.group.add(bar);
    } else {
      // 2. High-Performance Offshore Speedboat (V-Hull, Twin Engine)
      const hullGeo = new THREE.BoxGeometry(2.6, 0.85, 7.2);
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Vibrant Ocean Azure
        metalness: 0.85,
        roughness: 0.15,
      });
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.42;
      this.group.add(hull);

      // Pointed Bow Wedge
      const bowGeo = new THREE.ConeGeometry(1.3, 2.2, 4);
      bowGeo.rotateX(Math.PI / 2);
      bowGeo.rotateZ(Math.PI / 4);
      const bow = new THREE.Mesh(bowGeo, hullMat);
      bow.position.set(0, 0.42, 4.2);
      this.group.add(bow);

      // Tinted Cockpit Windshield
      const screenGeo = new THREE.BoxGeometry(2.2, 0.5, 1.4);
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.9,
        roughness: 0.1,
      });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(0, 0.95, 0.8);
      this.group.add(screen);

      // Twin Outboard Motors at Stern
      const motorGeo = new THREE.BoxGeometry(0.35, 0.7, 0.45);
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 });
      const motorL = new THREE.Mesh(motorGeo, motorMat);
      motorL.position.set(-0.7, 0.4, -3.7);
      const motorR = new THREE.Mesh(motorGeo, motorMat);
      motorR.position.set(0.7, 0.4, -3.7);
      this.group.add(motorL, motorR);
    }
  }

  public update(dt: number, input: BoatInput, waveTime: number): void {
    // 1. Rudder Steering (Agile turning, sharper at speed)
    const turnRate = this.isJetSki ? 3.2 : 2.2;
    if (input.steerLeft) this.heading += turnRate * dt;
    if (input.steerRight) this.heading -= turnRate * dt;

    // 2. Twin Propeller Throttle & Reverse
    const maxSpeed = this.isJetSki ? 34.0 : 42.0; // ~150 km/h!
    const accel = this.isJetSki ? 26.0 : 20.0;
    const waterDrag = 14.0;

    if (input.throttle) {
      this.speed = Math.min(maxSpeed, this.speed + accel * dt);
    } else if (input.reverse) {
      this.speed = Math.max(-8.0, this.speed - accel * 0.6 * dt);
    } else {
      // Natural water friction
      if (Math.abs(this.speed) < 0.5) {
        this.speed = 0;
      } else {
        this.speed -= Math.sign(this.speed) * waterDrag * dt;
      }
    }

    // 3. Move along water heading
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;

    // 4. Dynamic Wave Buoyancy & Roll
    const wave = Math.sin(waveTime * 2.5 + this.x * 0.08) * 0.35;
    this.y = 0.25 + wave;
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
    this.group.rotation.z = Math.sin(waveTime * 2.0) * 0.08;
    this.group.rotation.x = (this.speed / maxSpeed) * -0.15; // Bow lifts on plane!
  }
}
