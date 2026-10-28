import * as THREE from 'three';
import { CITY_CONFIG } from '../utils/Constants';
import { Road } from './Road';
import { Building, BuildingBox, BuildingStyle } from './Building';

export class City {
  public group: THREE.Group;
  public buildingBounds: BuildingBox[] = [];
  public groundMat!: THREE.MeshStandardMaterial;
  public maxBoundXPositive: number = CITY_CONFIG.MAX_BOUND_X_POS;
  public maxBoundXNegative: number = CITY_CONFIG.MAX_BOUND_X_NEG;
  public maxBoundZ: number = CITY_CONFIG.MAX_BOUND_Z;

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

    // 1. Ground asphalt plane (expanded for 7x7 grid + surroundings)
    const groundGeo = new THREE.PlaneGeometry(totalSize + 400, totalSize + 400);
    groundGeo.rotateX(-Math.PI / 2);
    this.groundMat = Road.createRoadMaterial();
    const groundMesh = new THREE.Mesh(groundGeo, this.groundMat);
    groundMesh.receiveShadow = true;
    this.group.add(groundMesh);

    // 2. City Blocks with Diverse Architectural Styles, Buildings, Sidewalks & Props
    const neonColors = [0x00d4ff, 0xff007f, 0x10b981, 0xf59e0b, 0xa855f7];
    const billboardLabels = [
      'GTA 7',
      'HOTEL VICE',
      'DELOREAN',
      'CYBER BANK',
      'NEXUS TECH',
      'NEON SPEED',
      'MATTI & CO',
      'TOKYO DRIFT',
    ];
    let billboardIdx = 0;

    // Architectural distribution across 7x7 city districts (49 blocks)
    // Note: districtStyles[0][0] is CYBER_TOWER to support centered rooftop bounds tests
    const districtStyles: BuildingStyle[][] = [
      [
        'CYBER_TOWER',
        'RESIDENTIAL_BLOCK',
        'LUXURY_RESORT',
        'RESIDENTIAL_BLOCK',
        'CLASSIC_BRICK_LOFT',
        'ROUND_TOWER',
        'CYBER_TOWER',
      ],
      [
        'RESIDENTIAL_BLOCK',
        'COMMERCIAL_HQ',
        'TWIN_TOWERS',
        'ROUND_TOWER',
        'LUXURY_RESORT',
        'COMMERCIAL_HQ',
        'RESIDENTIAL_BLOCK',
      ],
      [
        'PAGODA_NEON_TOWER',
        'ROUND_TOWER',
        'CYBER_TOWER',
        'TWIN_TOWERS',
        'LUXURY_RESORT',
        'PAGODA_NEON_TOWER',
        'ROUND_TOWER',
      ],
      [
        'RESIDENTIAL_BLOCK',
        'COMMERCIAL_HQ',
        'CYBER_TOWER',
        'CYBER_TOWER',
        'COMMERCIAL_HQ',
        'RESIDENTIAL_BLOCK',
        'TWIN_TOWERS',
      ],
      [
        'CLASSIC_BRICK_LOFT',
        'PAGODA_NEON_TOWER',
        'LUXURY_RESORT',
        'RESIDENTIAL_BLOCK',
        'CLASSIC_BRICK_LOFT',
        'ROUND_TOWER',
        'LUXURY_RESORT',
      ],
      [
        'TWIN_TOWERS',
        'COMMERCIAL_HQ',
        'ROUND_TOWER',
        'CYBER_TOWER',
        'TWIN_TOWERS',
        'COMMERCIAL_HQ',
        'PAGODA_NEON_TOWER',
      ],
      [
        'CYBER_TOWER',
        'RESIDENTIAL_BLOCK',
        'COMMERCIAL_HQ',
        'LUXURY_RESORT',
        'CLASSIC_BRICK_LOFT',
        'RESIDENTIAL_BLOCK',
        'CYBER_TOWER',
      ],
    ];

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

        // Special Handcrafted Landmark POIs
        if (i === 3 && j === 3) {
          // Grand Central Cyber Park at Block [3, 3] (Center: x=0, z=0)
          this.createCentralPark(blockCenterX, blockCenterZ, BLOCK_SIZE);
          continue;
        }

        if (i === 5 && j === 3) {
          // GTA 7 International Airport at Block [5, 3] (Center: x=176, z=0)
          this.createAirport(blockCenterX, blockCenterZ, BLOCK_SIZE);
          continue;
        }

        if (i === 2 && j === 5) {
          // Stunt Mega Stadium at Block [2, 5] (Center: x=-88, z=176)
          this.createStuntStadium(blockCenterX, blockCenterZ, BLOCK_SIZE);
          continue;
        }

        // Place buildings in this block with varied architecture
        const distFromCenter = Math.hypot(i - GRID_SIZE / 2, j - GRID_SIZE / 2);
        const isDowntown = distFromCenter < 2.0;

        // Heights tailored by style and district
        const baseHeight = isDowntown ? 52 + Math.random() * 45 : 20 + Math.random() * 28;
        const color = neonColors[(i + j) % neonColors.length];

        const bWidth = BLOCK_SIZE * 0.74;
        const bDepth = BLOCK_SIZE * 0.74;

        const style = districtStyles[i % districtStyles.length][j % districtStyles[0].length];

        const hasBillboard =
          (isDowntown || style === 'LUXURY_RESORT') && billboardIdx < billboardLabels.length;
        const billboardText = hasBillboard ? billboardLabels[billboardIdx++] : undefined;

        const building = Building.createBuilding(
          blockCenterX,
          blockCenterZ,
          bWidth,
          bDepth,
          baseHeight,
          color,
          billboardText,
          style,
        );
        this.group.add(building.mesh);
        this.buildingBounds.push(building.bounds);
        if (building.extraBounds) {
          this.buildingBounds.push(...building.extraBounds);
        }

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

    // 3. Handcrafted Oceanic POI: Lighthouse Island in the Western Ocean Bay
    this.createLighthouseIsland();

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
    if (x >= 3800 && z >= 3800 && x <= 4800 && z <= 4800) {
      return 100.0; // Interior floor elevation
    }
    if (Math.hypot(x - 2500, z - 2500) < 600) {
      return 400.0; // Lunar surface base elevation in Other World
    }
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

    // 3. Enforce map boundaries
    // If coordinates are in the Other World realm or Interior Realm, bypass city bounds
    if (
      Math.hypot(curX - 2500, curZ - 2500) < 600 ||
      (curX >= 3800 && curZ >= 3800 && curX <= 4800 && curZ <= 4800)
    ) {
      return { x: curX, z: curZ, corrected: wasCorrected, roofY: resolvedRoofY };
    }

    const maxBoundXPositive = this.maxBoundXPositive;
    const maxBoundXNegative = this.maxBoundXNegative;
    const maxBoundZ = this.maxBoundZ;

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

    // If coordinates are in the Other World realm or Interior Realm, bypass city bounds
    if (
      Math.hypot(x - 2500, z - 2500) < 600 ||
      (x >= 3800 && z >= 3800 && x <= 4800 && z <= 4800)
    ) {
      return { collided: false, normalX: 0, normalZ: 0, depth: 0 };
    }

    // Check map boundaries
    const maxBoundXPositive = this.maxBoundXPositive;
    const maxBoundXNegative = this.maxBoundXNegative;
    const maxBoundZ = this.maxBoundZ;

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

      // If coordinates are in the Other World realm or Interior Realm, bypass city bounds
      if (
        Math.hypot(curX - 2500, curZ - 2500) < 600 ||
        (curX >= 3800 && curZ >= 3800 && curX <= 4800 && curZ <= 4800)
      ) {
        continue;
      }

      const maxBoundXPositive = this.maxBoundXPositive;
      const maxBoundXNegative = this.maxBoundXNegative;
      const maxBoundZ = this.maxBoundZ;

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

  // -------------------------------------------------------------
  // Handcrafted POI Landmark Builders
  // -------------------------------------------------------------

  private createCentralPark(cx: number, cz: number, blockSize: number): void {
    // 1. Lush Green Park Foundation
    const parkGeo = new THREE.BoxGeometry(blockSize, 0.35, blockSize);
    const parkMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const park = new THREE.Mesh(parkGeo, parkMat);
    park.position.set(cx, 0.35 / 2, cz);
    park.receiveShadow = true;
    this.group.add(park);

    // 2. Central Reflective Pond
    const pondGeo = new THREE.CylinderGeometry(15, 17, 0.2, 20);
    const pondMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88,
    });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.position.set(cx, 0.36, cz);
    pond.receiveShadow = true;
    this.group.add(pond);

    // 3. Arched Wooden Footbridge across Pond
    const bridgeGeo = new THREE.BoxGeometry(5.5, 0.6, 26);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(cx, 0.85, cz);
    bridge.castShadow = true;
    this.group.add(bridge);

    const railMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.6 });
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 26), railMat);
    leftRail.position.set(cx - 2.6, 1.45, cz);
    const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 26), railMat);
    rightRail.position.set(cx + 2.6, 1.45, cz);
    this.group.add(leftRail, rightRail);

    // 4. Cyber Cherry Blossom Trees (Sakura)
    const treeOffsets = [
      [-22, -20],
      [22, -20],
      [-22, 20],
      [22, 20],
      [-16, 0],
      [16, 0],
    ];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const sakuraMat1 = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.4,
      emissive: 0xdb2777,
      emissiveIntensity: 0.25,
    });
    const sakuraMat2 = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      roughness: 0.4,
      emissive: 0xe11d48,
      emissiveIntensity: 0.25,
    });

    treeOffsets.forEach(([dx, dz], idx) => {
      const tx = cx + dx;
      const tz = cz + dz;

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4.5, 8), trunkMat);
      trunk.position.set(tx, 2.25, tz);
      trunk.castShadow = true;

      const foliage1 = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.6, 1),
        idx % 2 === 0 ? sakuraMat1 : sakuraMat2,
      );
      foliage1.position.set(tx, 5.2, tz);
      foliage1.castShadow = true;

      const foliage2 = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.8, 1),
        idx % 2 === 0 ? sakuraMat2 : sakuraMat1,
      );
      foliage2.position.set(tx, 6.8, tz);
      foliage2.castShadow = true;

      this.group.add(trunk, foliage1, foliage2);
      this.buildingBounds.push({
        minX: tx - 0.6,
        maxX: tx + 0.6,
        minZ: tz - 0.6,
        maxZ: tz + 0.6,
        height: 5.5,
      });
    });

    // 5. Park Benches
    const benchOffsets = [
      [-10, -14],
      [10, -14],
      [-10, 14],
      [10, 14],
    ];
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
    benchOffsets.forEach(([bx, bz]) => {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.9), benchMat);
      bench.position.set(cx + bx, 0.6, cz + bz);
      this.group.add(bench);
    });

    // 6. Central Hero Golden Cyber Statue
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0xca8a04,
      emissiveIntensity: 0.2,
    });
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 3.6), pedestalMat);
    pedestal.position.set(cx + 18, 1.1, cz - 16);
    const heroBody = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 4.2, 8), goldMat);
    heroBody.position.set(cx + 18, 4.0, cz - 16);
    const heroHead = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), goldMat);
    heroHead.position.set(cx + 18, 6.5, cz - 16);

    this.group.add(pedestal, heroBody, heroHead);
    this.buildingBounds.push({
      minX: cx + 18 - 2.0,
      maxX: cx + 18 + 2.0,
      minZ: cz - 16 - 2.0,
      maxZ: cz - 16 + 2.0,
      height: 7.5,
    });
  }

  private createAirport(cx: number, cz: number, blockSize: number): void {
    // 1. Tarmac Apron Foundation
    const airportGeo = new THREE.BoxGeometry(blockSize, 0.3, blockSize);
    const airportMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const airport = new THREE.Mesh(airportGeo, airportMat);
    airport.position.set(cx, 0.15, cz);
    airport.receiveShadow = true;
    this.group.add(airport);

    // 2. Main Runway Strip (Along Z Axis)
    const runwayGeo = new THREE.BoxGeometry(22, 0.35, blockSize);
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.position.set(cx + 10, 0.18, cz);
    runway.receiveShadow = true;
    this.group.add(runway);

    // Runway Centerline Dashes
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let dz = -26; dz <= 26; dz += 10) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.38, 5.0), dashMat);
      dash.position.set(cx + 10, 0.2, cz + dz);
      this.group.add(dash);
    }

    // Runway Approach Threshold Lights
    const lightMatGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const lightMatRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    for (let tx = -8; tx <= 8; tx += 4) {
      const tNorth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), lightMatGreen);
      tNorth.position.set(cx + 10 + tx, 0.3, cz - blockSize / 2 + 2);
      const tSouth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), lightMatRed);
      tSouth.position.set(cx + 10 + tx, 0.3, cz + blockSize / 2 - 2);
      this.group.add(tNorth, tSouth);
    }

    // 3. Airport Control Tower
    const towerX = cx - 22;
    const towerZ = cz - 15;
    const towerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(4.0, 5.4, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }),
    );
    towerBase.position.set(towerX, 16, towerZ);
    towerBase.castShadow = true;

    const controlCab = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 5.0, 4.5, 16),
      new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.82,
      }),
    );
    controlCab.position.set(towerX, 34, towerZ);

    const roofDome = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 6.8, 1.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }),
    );
    roofDome.position.set(towerX, 36.8, towerZ);

    const radarDish = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 0.4, 0.3, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    radarDish.position.set(towerX, 38.4, towerZ);
    radarDish.rotation.x = 0.5;

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    );
    beacon.position.set(towerX, 39.5, towerZ);

    this.group.add(towerBase, controlCab, roofDome, radarDish, beacon);
    this.buildingBounds.push({
      minX: towerX - 5.5,
      maxX: towerX + 5.5,
      minZ: towerZ - 5.5,
      maxZ: towerZ + 5.5,
      height: 39,
    });

    // 4. Aircraft Hangar
    const hangarX = cx - 20;
    const hangarZ = cz + 16;
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(16, 9, 22),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 }),
    );
    hangar.position.set(hangarX, 4.5, hangarZ);
    hangar.castShadow = true;
    this.group.add(hangar);
    this.buildingBounds.push({
      minX: hangarX - 8.5,
      maxX: hangarX + 8.5,
      minZ: hangarZ - 11.5,
      maxZ: hangarZ + 11.5,
      height: 9,
    });

    // 5. Parked Private Jet
    const jetGroup = new THREE.Group();
    const jetMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.7,
    });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3 });

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 13, 12), jetMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.y = 1.6;

    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.2, 12), jetMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 1.6, -7.5);

    const wings = new THREE.Mesh(new THREE.BoxGeometry(13, 0.25, 3.2), jetMat);
    wings.position.set(0, 1.6, 0);

    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.0, 2.4), blueMat);
    tailFin.position.set(0, 3.1, 5.0);

    jetGroup.add(fuselage, nose, wings, tailFin);
    jetGroup.position.set(cx - 7, 0, cz);
    this.group.add(jetGroup);

    this.buildingBounds.push({
      minX: cx - 14,
      maxX: cx,
      minZ: cz - 7,
      maxZ: cz + 7,
      height: 4.5,
    });
  }

  private createStuntStadium(cx: number, cz: number, blockSize: number): void {
    // 1. Stadium Arena Floor
    const arenaGeo = new THREE.BoxGeometry(blockSize, 0.35, blockSize);
    const arenaMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    const arena = new THREE.Mesh(arenaGeo, arenaMat);
    arena.position.set(cx, 0.17, cz);
    this.group.add(arena);

    // 2. Mega Launch Ramp
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.5 });
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(14, 4.2, 16), rampMat);
    ramp.position.set(cx, 2.1, cz - 14);
    ramp.rotation.x = 0.22;
    ramp.castShadow = true;
    this.group.add(ramp);
    this.buildingBounds.push({
      minX: cx - 7.5,
      maxX: cx + 7.5,
      minZ: cz - 22.5,
      maxZ: cz - 5.5,
      height: 4.8,
    });

    // 3. Glowing Speed Booster Pad
    const boostMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const booster = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 8), boostMat);
    booster.position.set(cx, 0.38, cz - 28);
    this.group.add(booster);

    // 4. Ring of Fire (Hovering Torus downstream of launch ramp)
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.45, 12, 24), fireMat);
    ring.position.set(cx, 8.0, cz + 6);
    this.group.add(ring);

    // Ring support pylons
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const pylonL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 12, 8), pylonMat);
    pylonL.position.set(cx - 5.2, 4.5, cz + 6);
    const pylonR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 12, 8), pylonMat);
    pylonR.position.set(cx + 5.2, 4.5, cz + 6);
    this.group.add(pylonL, pylonR);

    // 5. Opposing Half-Pipe Ramps on East and West
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
    const pipeWest = new THREE.Mesh(new THREE.BoxGeometry(10, 5.0, 16), pipeMat);
    pipeWest.position.set(cx - 22, 2.5, cz);
    pipeWest.rotation.z = -0.3;
    const pipeEast = new THREE.Mesh(new THREE.BoxGeometry(10, 5.0, 16), pipeMat);
    pipeEast.position.set(cx + 22, 2.5, cz);
    pipeEast.rotation.z = 0.3;
    this.group.add(pipeWest, pipeEast);

    this.buildingBounds.push(
      { minX: cx - 27.5, maxX: cx - 16.5, minZ: cz - 8.5, maxZ: cz + 8.5, height: 5.5 },
      { minX: cx + 16.5, maxX: cx + 27.5, minZ: cz - 8.5, maxZ: cz + 8.5, height: 5.5 },
    );

    // 6. High-Intensity Stadium Floodlight Poles
    const floodPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const floodLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const corners = [
      [-blockSize / 2 + 4, -blockSize / 2 + 4],
      [blockSize / 2 - 4, -blockSize / 2 + 4],
      [-blockSize / 2 + 4, blockSize / 2 - 4],
      [blockSize / 2 - 4, blockSize / 2 - 4],
    ];
    corners.forEach(([dx, dz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 20, 8), floodPoleMat);
      pole.position.set(cx + dx, 10, cz + dz);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), floodLightMat);
      lamp.position.set(cx + dx, 20.2, cz + dz);
      this.group.add(pole, lamp);
    });
  }

  private createLighthouseIsland(): void {
    const islandX = -350;
    const islandZ = 0;

    // 1. Craggy Rocky Island Base
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.95 });
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 4.0, 14), rockMat);
    rock.position.set(islandX, 1.8, islandZ);
    rock.receiveShadow = true;
    this.group.add(rock);

    this.buildingBounds.push({
      minX: islandX - 25,
      maxX: islandX + 25,
      minZ: islandZ - 25,
      maxZ: islandZ + 25,
      height: 3.8,
    });

    // 2. Lighthouse Tower with Alternating Red & White Segments
    const towerX = islandX - 4;
    const towerZ = islandZ;
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 6.0, 16), whiteMat);
    s1.position.set(towerX, 6.8, towerZ);
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 6.0, 16), redMat);
    s2.position.set(towerX, 12.8, towerZ);
    const s3 = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.6, 6.0, 16), whiteMat);
    s3.position.set(towerX, 18.8, towerZ);
    const s4 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.0, 6.0, 16), redMat);
    s4.position.set(towerX, 24.8, towerZ);

    const gallery = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.5, 0.6, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b }),
    );
    gallery.position.set(towerX, 28.1, towerZ);

    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 3.0, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      }),
    );
    lantern.position.set(towerX, 29.8, towerZ);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 2.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f766e }),
    );
    roof.position.set(towerX, 32.2, towerZ);

    // Glowing amber Searchlight Beam directed toward the city bay
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(16, 65, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.set(towerX + 32, 29.8, towerZ);
    beam.rotation.z = -Math.PI / 2;

    this.group.add(s1, s2, s3, s4, gallery, lantern, roof, beam);

    this.buildingBounds.push({
      minX: towerX - 5.0,
      maxX: towerX + 5.0,
      minZ: towerZ - 5.0,
      maxZ: towerZ + 5.0,
      height: 33.0,
    });

    // 3. Keeper's Cottage
    const cottage = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 3.5, 5.5),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 }),
    );
    cottage.position.set(islandX + 12, 5.2, islandZ - 6);
    this.group.add(cottage);
    this.buildingBounds.push({
      minX: islandX + 12 - 3.5,
      maxX: islandX + 12 + 3.5,
      minZ: islandZ - 6 - 3.0,
      maxZ: islandZ - 6 + 3.0,
      height: 7.0,
    });

    // 4. Wooden Pier Dock extending toward the east
    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.6, 4.5),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }),
    );
    dock.position.set(islandX + 26, 2.0, islandZ);
    this.group.add(dock);
  }
}
