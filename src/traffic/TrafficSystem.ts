import * as THREE from 'three';
import { CITY_CONFIG } from '../utils/Constants';

export interface TrafficCar {
  id: number;
  group: THREE.Group;
  x: number;
  z: number;
  speed: number;
  maxSpeed: number;
  direction: 'N' | 'S' | 'E' | 'W';
  heading: number;
  color: number;
  health: number;
  isWrecked: boolean;
  modelMesh: THREE.Mesh;
  wheels: THREE.Mesh[];
  wheelRotation: number;
}

export class TrafficSystem {
  public cars: TrafficCar[] = [];
  public group: THREE.Group;
  private scene: THREE.Scene;

  private roadCoordinates: number[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.calculateRoadNetwork();
    this.spawnInitialTraffic(12);
  }

  private calculateRoadNetwork(): void {
    const { GRID_SIZE, BLOCK_SIZE, ROAD_WIDTH } = CITY_CONFIG;
    const step = BLOCK_SIZE + ROAD_WIDTH;
    const halfSize = (GRID_SIZE * step) / 2;

    for (let i = 0; i <= GRID_SIZE; i++) {
      this.roadCoordinates.push(-halfSize + i * step);
    }
  }

  private spawnInitialTraffic(count: number): void {
    const carColors = [
      0xfacc15, // Yellow Cab
      0x2563eb, // Royal Blue Sedan
      0xf8fafc, // White SUV
      0x10b981, // Emerald Coupe
      0xf97316, // Sunset Orange
      0x8b5cf6, // Purple Cruiser
    ];

    const laneOffset = 4.2; // Right hand traffic lane offset

    const mapSpan = CITY_CONFIG.GRID_SIZE * (CITY_CONFIG.BLOCK_SIZE + CITY_CONFIG.ROAD_WIDTH);

    for (let i = 0; i < count; i++) {
      const roadCoord = this.roadCoordinates[i % this.roadCoordinates.length];
      const otherCoord = (Math.random() - 0.5) * mapSpan;
      const color = carColors[i % carColors.length];

      // Alternating N/S and E/W streets
      const isNorthSouth = i % 2 === 0;
      const isPositive = Math.random() > 0.5;

      let x = 0;
      let z = 0;
      let dir: 'N' | 'S' | 'E' | 'W' = 'S';
      let heading = 0;

      if (isNorthSouth) {
        x = roadCoord + (isPositive ? laneOffset : -laneOffset);
        z = otherCoord;
        dir = isPositive ? 'S' : 'N';
        heading = isPositive ? 0 : Math.PI;
      } else {
        x = otherCoord;
        z = roadCoord + (isPositive ? -laneOffset : laneOffset);
        dir = isPositive ? 'E' : 'W';
        heading = isPositive ? Math.PI / 2 : -Math.PI / 2;
      }

      this.createTrafficCar(x, z, dir, heading, color);
    }
  }

  private createTrafficCar(
    x: number,
    z: number,
    direction: 'N' | 'S' | 'E' | 'W',
    heading: number,
    color: number,
  ): TrafficCar {
    const carGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.65, 4.3);
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.6,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.55;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    carGroup.add(bodyMesh);

    // Cabin / Windows
    const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.2);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.8,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 1.05, -0.2);
    cabinMesh.castShadow = true;
    carGroup.add(cabinMesh);

    // Taxi Sign if Yellow
    if (color === 0xfacc15) {
      const taxiSignGeo = new THREE.BoxGeometry(0.7, 0.2, 0.3);
      const taxiSignMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const taxiSign = new THREE.Mesh(taxiSignGeo, taxiSignMat);
      taxiSign.position.set(0, 1.45, -0.2);
      carGroup.add(taxiSign);
    }

    // Wheels
    const wheels: THREE.Mesh[] = [];
    const wheelPositions = [
      [-1.05, 0.38, 1.3],
      [1.05, 0.38, 1.3],
      [-1.05, 0.38, -1.3],
      [1.05, 0.38, -1.3],
    ];

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      carGroup.add(wheel);
      wheels.push(wheel);
    });

    carGroup.position.set(x, 0, z);
    carGroup.rotation.y = heading;
    this.group.add(carGroup);

    const trafficCar: TrafficCar = {
      id: Math.floor(Math.random() * 1000000),
      group: carGroup,
      x,
      z,
      speed: 12 + Math.random() * 5,
      maxSpeed: 16 + Math.random() * 4,
      direction,
      heading,
      color,
      health: 80,
      isWrecked: false,
      modelMesh: bodyMesh,
      wheels,
      wheelRotation: 0,
    };

    this.cars.push(trafficCar);
    return trafficCar;
  }

  public update(dt: number, playerCarX: number, playerCarZ: number): void {
    const mapLimit =
      (CITY_CONFIG.GRID_SIZE * (CITY_CONFIG.BLOCK_SIZE + CITY_CONFIG.ROAD_WIDTH)) / 2;

    for (const car of this.cars) {
      if (car.isWrecked) continue;

      // Check distance to player car to slow down if directly in front
      const distToPlayer = Math.hypot(playerCarX - car.x, playerCarZ - car.z);
      if (distToPlayer < 7.0) {
        car.speed = Math.max(0, car.speed - 24 * dt); // Brake smoothly
      } else {
        car.speed = Math.min(car.maxSpeed, car.speed + 8 * dt);
      }

      // Move along direction
      let vx = 0;
      let vz = 0;
      if (car.direction === 'S') vz = car.speed * dt;
      else if (car.direction === 'N') vz = -car.speed * dt;
      else if (car.direction === 'E') vx = car.speed * dt;
      else if (car.direction === 'W') vx = -car.speed * dt;

      car.x += vx;
      car.z += vz;

      // Wrap around map borders so city always has bustling traffic
      if (car.z > mapLimit) car.z = -mapLimit;
      if (car.z < -mapLimit) car.z = mapLimit;
      if (car.x > mapLimit) car.x = -mapLimit;
      if (car.x < -mapLimit) car.x = mapLimit;

      car.group.position.set(car.x, 0, car.z);

      // Animate wheels
      car.wheelRotation += (car.speed * dt) / 0.38;
      car.wheels.forEach((w) => (w.rotation.x = car.wheelRotation));
    }
  }

  public damageCar(car: TrafficCar, amount: number): void {
    car.health -= amount;
    if (car.health <= 0) {
      car.isWrecked = true;
      car.speed = 0;
      (car.modelMesh.material as THREE.MeshStandardMaterial).color.setHex(0x1e293b);
    }
  }

  public removeCar(car: TrafficCar): void {
    this.group.remove(car.group);
    const index = this.cars.indexOf(car);
    if (index !== -1) {
      this.cars.splice(index, 1);
    }
  }
}
