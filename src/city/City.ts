import * as THREE from 'three';
import { CITY_CONFIG } from '../utils/Constants';
import { Road } from './Road';
import { Building, BuildingBox } from './Building';

export class City {
  public group: THREE.Group;
  public buildingBounds: BuildingBox[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.generateCity();
  }

  private generateCity(): void {
    const { GRID_SIZE, BLOCK_SIZE, ROAD_WIDTH } = CITY_CONFIG;
    const step = BLOCK_SIZE + ROAD_WIDTH;
    const totalSize = GRID_SIZE * step;
    const halfSize = totalSize / 2;

    // 1. Ground asphalt plane
    const groundGeo = new THREE.PlaneGeometry(totalSize + 200, totalSize + 200);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = Road.createRoadMaterial();
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    this.group.add(groundMesh);

    // 2. City Blocks with Buildings, Sidewalks, Palm Trees & Street Lamps
    const neonColors = [0x00d4ff, 0xff007f, 0x10b981, 0xf59e0b, 0xa855f7];
    const billboardLabels = ['GTA 7', 'DELOREAN', 'MATTI & CO', 'CYBER CITY', 'NEON SPEED'];
    let billboardIdx = 0;

    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const blockCenterX = -halfSize + i * step + step / 2;
        const blockCenterZ = -halfSize + j * step + step / 2;

        // Sidewalk foundation under block
        const sidewalkGeo = new THREE.BoxGeometry(
          BLOCK_SIZE,
          CITY_CONFIG.SIDEWALK_HEIGHT,
          BLOCK_SIZE,
        );
        const sidewalkMat = Road.createSidewalkMaterial();
        const sidewalkMesh = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        sidewalkMesh.position.set(blockCenterX, CITY_CONFIG.SIDEWALK_HEIGHT / 2, blockCenterZ);
        sidewalkMesh.receiveShadow = true;
        this.group.add(sidewalkMesh);

        // Place buildings in this block
        const distFromCenter = Math.hypot(i - GRID_SIZE / 2, j - GRID_SIZE / 2);
        const isDowntown = distFromCenter < 1.5;

        // Heights
        const baseHeight = isDowntown ? 52 + Math.random() * 45 : 20 + Math.random() * 28;
        const color = neonColors[(i + j) % neonColors.length];

        const bWidth = BLOCK_SIZE * 0.74;
        const bDepth = BLOCK_SIZE * 0.74;

        const hasBillboard = isDowntown && billboardIdx < billboardLabels.length;
        const billboardText = hasBillboard ? billboardLabels[billboardIdx++] : undefined;

        const building = Building.createBuilding(
          blockCenterX,
          blockCenterZ,
          bWidth,
          bDepth,
          baseHeight,
          color,
          billboardText,
        );
        this.group.add(building.mesh);
        this.buildingBounds.push(building.bounds);

        // Boulevard Palm Trees at sidewalk edges
        const halfB = BLOCK_SIZE / 2 - 3.5;
        const palm1 = Road.createPalmTree(blockCenterX - halfB, blockCenterZ - halfB);
        const palm2 = Road.createPalmTree(blockCenterX + halfB, blockCenterZ + halfB);
        this.group.add(palm1, palm2);

        // Modern Street Lamps at opposite sidewalk corners
        const lamp1 = Road.createStreetLamp(blockCenterX - halfB, blockCenterZ + halfB, 0);
        const lamp2 = Road.createStreetLamp(blockCenterX + halfB, blockCenterZ - halfB, Math.PI);
        this.group.add(lamp1, lamp2);
      }
    }

    // 3. Lane Dash Markings & Crosswalks along roads
    for (let i = 0; i <= GRID_SIZE; i++) {
      const roadCoord = -halfSize + i * step;

      // Horizontal road lane line
      const lineH = Road.createLaneDashes(-halfSize, roadCoord, halfSize, roadCoord, true);
      this.group.add(lineH);

      // Vertical road lane line
      const lineV = Road.createLaneDashes(roadCoord, -halfSize, roadCoord, halfSize, true);
      this.group.add(lineV);

      // Cyber Crosswalks at intersections
      for (let j = 0; j <= GRID_SIZE; j++) {
        const roadCoord2 = -halfSize + j * step;
        const cw1 = Road.createCrosswalk(roadCoord2 + 10, roadCoord, true);
        const cw2 = Road.createCrosswalk(roadCoord2, roadCoord + 10, false);
        this.group.add(cw1, cw2);
      }
    }

    // 4. Stunt Ramps in selected intersections
    const ramp1 = Building.createRamp(0, 40, 10, 14, 4, 0);
    this.group.add(ramp1.mesh);

    const ramp2 = Building.createRamp(88, -40, 10, 14, 4, Math.PI / 2);
    this.group.add(ramp2.mesh);
  }

  public checkCollision(
    x: number,
    z: number,
    radius: number = 1.2,
  ): { collided: boolean; normalX: number; normalZ: number } {
    for (const b of this.buildingBounds) {
      if (
        x + radius > b.minX &&
        x - radius < b.maxX &&
        z + radius > b.minZ &&
        z - radius < b.maxZ
      ) {
        // Calculate collision normal (bounce away)
        const overlapLeft = x + radius - b.minX;
        const overlapRight = b.maxX - (x - radius);
        const overlapTop = z + radius - b.minZ;
        const overlapBottom = b.maxZ - (z - radius);

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapLeft) return { collided: true, normalX: -1, normalZ: 0 };
        if (minOverlap === overlapRight) return { collided: true, normalX: 1, normalZ: 0 };
        if (minOverlap === overlapTop) return { collided: true, normalX: 0, normalZ: -1 };
        return { collided: true, normalX: 0, normalZ: 1 };
      }
    }

    // Check map boundaries
    const maxBoundary =
      (CITY_CONFIG.GRID_SIZE * (CITY_CONFIG.BLOCK_SIZE + CITY_CONFIG.ROAD_WIDTH)) / 2;
    if (Math.abs(x) > maxBoundary) {
      return { collided: true, normalX: x > 0 ? -1 : 1, normalZ: 0 };
    }
    if (Math.abs(z) > maxBoundary) {
      return { collided: true, normalX: 0, normalZ: z > 0 ? -1 : 1 };
    }

    return { collided: false, normalX: 0, normalZ: 0 };
  }
}
