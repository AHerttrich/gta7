import * as THREE from 'three';
import { CITY_CONFIG } from '../utils/Constants';
import { Road } from './Road';
import { Building, BuildingBox } from './Building';

export class City {
  public group: THREE.Group;
  public buildingBounds: BuildingBox[] = [];
  public groundMat!: THREE.MeshStandardMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.generateCity();
  }

  public setWeatherMode(weather: 'clear' | 'rain' | 'thunder'): void {
    if (weather === 'rain' || weather === 'thunder') {
      this.groundMat.roughness = 0.22;
      this.groundMat.metalness = 0.75;
      this.groundMat.color.setHex(0x0c1017);
    } else {
      this.groundMat.roughness = 0.7;
      this.groundMat.metalness = 0.25;
      this.groundMat.color.setHex(0x161a23);
    }
  }

  private generateCity(): void {
    const { GRID_SIZE, BLOCK_SIZE, ROAD_WIDTH } = CITY_CONFIG;
    const step = BLOCK_SIZE + ROAD_WIDTH;
    const totalSize = GRID_SIZE * step;
    const halfSize = totalSize / 2;

    // 1. Ground asphalt plane
    const groundGeo = new THREE.PlaneGeometry(totalSize + 200, totalSize + 200);
    groundGeo.rotateX(-Math.PI / 2);
    this.groundMat = Road.createRoadMaterial();
    const groundMesh = new THREE.Mesh(groundGeo, this.groundMat);
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
  }

  public getRoofHeightAt(x: number, z: number, radius: number = 0): number {
    let maxH = 0;
    for (const b of this.buildingBounds) {
      // Check upper tier first if available
      if (
        b.tier &&
        x + radius > b.tier.minX &&
        x - radius < b.tier.maxX &&
        z + radius > b.tier.minZ &&
        z - radius < b.tier.maxZ
      ) {
        if (b.tier.height > maxH) {
          maxH = b.tier.height;
        }
      } else if (
        x + radius > b.minX &&
        x - radius < b.maxX &&
        z + radius > b.minZ &&
        z - radius < b.maxZ
      ) {
        const baseH = b.baseHeight ?? b.height;
        if (baseH > maxH) {
          maxH = baseH;
        }
      }
    }
    return maxH;
  }

  public resolveBuildingIntersection(
    x: number,
    z: number,
    radius: number = 1.2,
    y: number = 0,
  ): { x: number; z: number; corrected: boolean; roofY?: number } {
    let curX = x;
    let curZ = z;
    let wasCorrected = false;
    let resolvedRoofY: number | undefined = undefined;

    // Check all buildings
    for (const b of this.buildingBounds) {
      const baseH = b.baseHeight ?? b.height;

      // 1. Is entity inside upper tier?
      const inTier =
        b.tier !== undefined &&
        y >= baseH &&
        y < b.tier.height &&
        curX + radius > b.tier.minX &&
        curX - radius < b.tier.maxX &&
        curZ + radius > b.tier.minZ &&
        curZ - radius < b.tier.maxZ;

      // 2. Is entity inside base building?
      const inBase =
        y < baseH &&
        curX + radius > b.minX &&
        curX - radius < b.maxX &&
        curZ + radius > b.minZ &&
        curZ - radius < b.maxZ;

      if (!inTier && !inBase) continue;

      const targetBox = inTier && b.tier ? b.tier : b;
      const boxHeight = inTier && b.tier ? b.tier.height : baseH;

      // Calculate penetration overlaps from all 4 walls
      const overlapLeft = curX + radius - targetBox.minX;
      const overlapRight = targetBox.maxX - (curX - radius);
      const overlapTop = curZ + radius - targetBox.minZ;
      const overlapBottom = targetBox.maxZ - (curZ - radius);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      // If entity is deep inside the rooftop footprint (minOverlap >= 2.0m) and within 0.8m of roof top,
      // it penetrated from above while landing on the roof - snap UP onto roof level.
      // If it is near the outer building perimeter (< 2.0m overlap), it hit the wall from outside -
      // it MUST be ejected horizontally to prevent clipping or glitching into building interiors!
      if (y >= boxHeight - 0.8 && minOverlap >= 2.0) {
        resolvedRoofY = boxHeight;
        wasCorrected = true;
        continue;
      }

      // Horizontally eject out to the nearest exterior wall with safe clearance
      if (minOverlap === overlapLeft) {
        curX = targetBox.minX - radius - 0.15;
      } else if (minOverlap === overlapRight) {
        curX = targetBox.maxX + radius + 0.15;
      } else if (minOverlap === overlapTop) {
        curZ = targetBox.minZ - radius - 0.15;
      } else {
        curZ = targetBox.maxZ + radius + 0.15;
      }
      wasCorrected = true;
    }

    // 3. Enforce map boundaries (positive X <= 305, negative X >= -335, |Z| <= 305)
    const maxBoundXPositive = 305.0;
    const maxBoundXNegative = -335.0;
    const maxBoundZ = 305.0;

    if (curX > maxBoundXPositive - radius) {
      curX = maxBoundXPositive - radius - 0.2;
      wasCorrected = true;
    } else if (curX < maxBoundXNegative + radius) {
      curX = maxBoundXNegative + radius + 0.2;
      wasCorrected = true;
    }

    if (curZ > maxBoundZ - radius) {
      curZ = maxBoundZ - radius - 0.2;
      wasCorrected = true;
    } else if (curZ < -maxBoundZ + radius) {
      curZ = -maxBoundZ + radius + 0.2;
      wasCorrected = true;
    }

    return { x: curX, z: curZ, corrected: wasCorrected, roofY: resolvedRoofY };
  }

  public checkCollision(
    x: number,
    z: number,
    radius: number = 1.2,
    y: number = 0,
  ): { collided: boolean; normalX: number; normalZ: number; depth: number } {
    for (const b of this.buildingBounds) {
      const baseH = b.baseHeight ?? b.height;

      // Check upper tier if entity elevation is in upper tier range
      if (b.tier && y >= baseH && y < b.tier.height) {
        if (
          x + radius > b.tier.minX &&
          x - radius < b.tier.maxX &&
          z + radius > b.tier.minZ &&
          z - radius < b.tier.maxZ
        ) {
          const overlapLeft = x + radius - b.tier.minX;
          const overlapRight = b.tier.maxX - (x - radius);
          const overlapTop = z + radius - b.tier.minZ;
          const overlapBottom = b.tier.maxZ - (z - radius);
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          if (minOverlap === overlapLeft)
            return { collided: true, normalX: -1, normalZ: 0, depth: minOverlap };
          if (minOverlap === overlapRight)
            return { collided: true, normalX: 1, normalZ: 0, depth: minOverlap };
          if (minOverlap === overlapTop)
            return { collided: true, normalX: 0, normalZ: -1, depth: minOverlap };
          return { collided: true, normalX: 0, normalZ: 1, depth: minOverlap };
        }
      }

      // Check base tower
      if (y < baseH) {
        if (
          x + radius > b.minX &&
          x - radius < b.maxX &&
          z + radius > b.minZ &&
          z - radius < b.maxZ
        ) {
          const overlapLeft = x + radius - b.minX;
          const overlapRight = b.maxX - (x - radius);
          const overlapTop = z + radius - b.minZ;
          const overlapBottom = b.maxZ - (z - radius);
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          if (minOverlap === overlapLeft)
            return { collided: true, normalX: -1, normalZ: 0, depth: minOverlap };
          if (minOverlap === overlapRight)
            return { collided: true, normalX: 1, normalZ: 0, depth: minOverlap };
          if (minOverlap === overlapTop)
            return { collided: true, normalX: 0, normalZ: -1, depth: minOverlap };
          return { collided: true, normalX: 0, normalZ: 1, depth: minOverlap };
        }
      }
    }

    // Check map boundaries (terrain extends to 320m, west ocean to -340m)
    const maxBoundXPositive = 305.0;
    const maxBoundXNegative = -335.0; // Ocean bay
    const maxBoundZ = 305.0;

    if (x > maxBoundXPositive) {
      return {
        collided: true,
        normalX: -1,
        normalZ: 0,
        depth: x - maxBoundXPositive,
      };
    }
    if (x < maxBoundXNegative) {
      return {
        collided: true,
        normalX: 1,
        normalZ: 0,
        depth: maxBoundXNegative - x,
      };
    }
    if (Math.abs(z) > maxBoundZ) {
      return {
        collided: true,
        normalX: 0,
        normalZ: z > 0 ? -1 : 1,
        depth: Math.abs(z) - maxBoundZ,
      };
    }

    return { collided: false, normalX: 0, normalZ: 0, depth: 0 };
  }

  public checkSweptCollision(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    radius: number = 1.2,
    y: number = 0,
  ): {
    collided: boolean;
    normalX: number;
    normalZ: number;
    safeX: number;
    safeZ: number;
    depth: number;
  } {
    // 0. Anti-tunneling / interior start fix: If (x1, z1) is already inside a building, immediately eject!
    const initialFix = this.resolveBuildingIntersection(x1, z1, radius, y);
    if (initialFix.corrected) {
      return {
        collided: true,
        normalX: initialFix.x > x1 ? 1 : initialFix.x < x1 ? -1 : 0,
        normalZ: initialFix.z > z1 ? 1 : initialFix.z < z1 ? -1 : 0,
        safeX: initialFix.x,
        safeZ: initialFix.z,
        depth: Math.hypot(initialFix.x - x1, initialFix.z - z1),
      };
    }

    const dist = Math.hypot(x2 - x1, z2 - z1);
    if (dist < 0.001) {
      const col = this.checkCollision(x2, z2, radius, y);
      if (!col.collided) {
        return { collided: false, normalX: 0, normalZ: 0, safeX: x2, safeZ: z2, depth: 0 };
      }
      const safe = this.resolveBuildingIntersection(x2, z2, radius, y);
      return {
        ...col,
        safeX: safe.x,
        safeZ: safe.z,
      };
    }

    // Spatial broadphase: filter only buildings overlapping the swept AABB AND taller than entity elevation
    const sweepMinX = Math.min(x1, x2) - radius;
    const sweepMaxX = Math.max(x1, x2) + radius;
    const sweepMinZ = Math.min(z1, z2) - radius;
    const sweepMaxZ = Math.max(z1, z2) + radius;

    const candidates = this.buildingBounds.filter(
      (b) =>
        b.height > y &&
        b.maxX >= sweepMinX &&
        b.minX <= sweepMaxX &&
        b.maxZ >= sweepMinZ &&
        b.minZ <= sweepMaxZ,
    );

    const steps = Math.max(1, Math.min(12, Math.ceil(dist / 0.8)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const curX = x1 + (x2 - x1) * t;
      const curZ = z1 + (z2 - z1) * t;

      for (const b of candidates) {
        const baseH = b.baseHeight ?? b.height;
        const inTier =
          b.tier !== undefined &&
          y >= baseH &&
          y < b.tier.height &&
          curX + radius > b.tier.minX &&
          curX - radius < b.tier.maxX &&
          curZ + radius > b.tier.minZ &&
          curZ - radius < b.tier.maxZ;

        const inBase =
          y < baseH &&
          curX + radius > b.minX &&
          curX - radius < b.maxX &&
          curZ + radius > b.minZ &&
          curZ - radius < b.maxZ;

        if (inTier || inBase) {
          const targetBox = inTier && b.tier ? b.tier : b;
          const overlapLeft = curX + radius - targetBox.minX;
          const overlapRight = targetBox.maxX - (curX - radius);
          const overlapTop = curZ + radius - targetBox.minZ;
          const overlapBottom = targetBox.maxZ - (curZ - radius);

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          let normalX = 0;
          let normalZ = 0;
          let safeX = curX;
          let safeZ = curZ;

          if (minOverlap === overlapLeft) {
            normalX = -1;
            safeX = targetBox.minX - radius - 0.15;
          } else if (minOverlap === overlapRight) {
            normalX = 1;
            safeX = targetBox.maxX + radius + 0.15;
          } else if (minOverlap === overlapTop) {
            normalZ = -1;
            safeZ = targetBox.minZ - radius - 0.15;
          } else {
            normalZ = 1;
            safeZ = targetBox.maxZ + radius + 0.15;
          }

          return {
            collided: true,
            normalX,
            normalZ,
            safeX,
            safeZ,
            depth: minOverlap,
          };
        }
      }

      // Check map boundaries (terrain extends to 320m, west ocean to -340m)
      const maxBoundXPositive = 305.0;
      const maxBoundXNegative = -335.0; // Ocean bay
      const maxBoundZ = 305.0;

      if (curX > maxBoundXPositive) {
        return {
          collided: true,
          normalX: -1,
          normalZ: 0,
          safeX: maxBoundXPositive - radius - 0.2,
          safeZ: curZ,
          depth: curX - maxBoundXPositive,
        };
      }
      if (curX < maxBoundXNegative) {
        return {
          collided: true,
          normalX: 1,
          normalZ: 0,
          safeX: maxBoundXNegative + radius + 0.2,
          safeZ: curZ,
          depth: maxBoundXNegative - curX,
        };
      }
      if (Math.abs(curZ) > maxBoundZ) {
        const normalZ = curZ > 0 ? -1 : 1;
        return {
          collided: true,
          normalX: 0,
          normalZ,
          safeX: curX,
          safeZ: (maxBoundZ - radius - 0.2) * (curZ > 0 ? 1 : -1),
          depth: Math.abs(curZ) - maxBoundZ,
        };
      }
    }
    return { collided: false, normalX: 0, normalZ: 0, safeX: x2, safeZ: z2, depth: 0 };
  }
}
