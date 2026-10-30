import * as THREE from 'three';

export interface BuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  baseHeight?: number;
  isSlope?: boolean;
  slopeStartZ?: number;
  slopeEndZ?: number;
  slopeStartHeight?: number;
  slopeEndHeight?: number;
  tier?: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    height: number;
  };
}

export type BuildingStyle =
  | 'CYBER_TOWER'
  | 'LUXURY_RESORT'
  | 'RESIDENTIAL_BLOCK'
  | 'COMMERCIAL_HQ'
  | 'CLASSIC_BRICK_LOFT'
  | 'ROUND_TOWER'
  | 'PAGODA_NEON_TOWER'
  | 'TWIN_TOWERS'
  | 'SUBURBAN_HOUSE';

export class Building {
  private static textureCache: Map<string, THREE.CanvasTexture> = new Map();
  private static repeatedTextureCache: Map<string, THREE.Texture> = new Map();
  private static billboardCache: Map<string, THREE.CanvasTexture> = new Map();

  private static getRepeatedTexture(
    baseTex: THREE.Texture | null,
    cacheKey: string,
    repeatX: number,
    repeatY: number,
  ): THREE.Texture | null {
    if (!baseTex) return null;
    const fullKey = `${cacheKey}_${repeatX}_${repeatY}`;
    let tex = this.repeatedTextureCache.get(fullKey);
    if (!tex) {
      tex = baseTex.clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.needsUpdate = true;
      this.repeatedTextureCache.set(fullKey, tex);
    }
    return tex;
  }

  // 1. Standard Cyberspace Office Window Texture
  public static getWindowTexture(): THREE.CanvasTexture | null {
    return this.getOfficeWindowTexture('cyan');
  }

  public static getOfficeWindowTexture(
    theme: 'cyan' | 'gold' | 'emerald' | 'purple' = 'cyan',
  ): THREE.CanvasTexture | null {
    const cacheKey = `office_${theme}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark sleek skyscraper glass background with metallic mullions
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    for (let y = 0; y <= 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    const cols = 16;
    const rows = 16;
    const padX = 5;
    const padY = 7;
    const winW = (512 - padX * (cols + 1)) / cols;
    const winH = (512 - padY * (rows + 1)) / rows;

    const themeColors: Record<string, string[]> = {
      cyan: ['#38bdf8', '#0284c7', '#fde047', '#f8fafc', '#090d16'],
      gold: ['#f59e0b', '#fbbf24', '#fef08a', '#f8fafc', '#171109'],
      emerald: ['#10b981', '#34d399', '#a7f3d0', '#f8fafc', '#061a12'],
      purple: ['#a855f7', '#c084fc', '#f43f5e', '#38bdf8', '#14081f'],
    };
    const palette = themeColors[theme] || themeColors.cyan;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = padX + c * (winW + padX);
        const wy = padY + r * (winH + padY);

        const rand = (Math.sin(r * 31 + c * 17) + 1) / 2;
        if (rand < 0.28) {
          ctx.fillStyle = palette[0];
        } else if (rand < 0.44) {
          ctx.fillStyle = palette[1];
        } else if (rand < 0.6) {
          ctx.fillStyle = palette[2];
        } else if (rand < 0.72) {
          ctx.fillStyle = palette[3];
        } else {
          ctx.fillStyle = palette[4];
        }
        ctx.fillRect(wx, wy, winW, winH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.textureCache.set(cacheKey, tex);
    return tex;
  }

  // 2. Luxury Art Deco / Hotel Facade Texture (warm sandstone & champagne glass)
  public static getLuxuryHotelTexture(): THREE.CanvasTexture | null {
    const cacheKey = 'luxury_hotel';
    if (this.textureCache.has(cacheKey)) return this.textureCache.get(cacheKey)!;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Elegant warm limestone / travertine stone background
    ctx.fillStyle = '#f8f5f0';
    ctx.fillRect(0, 0, 512, 512);

    // Decorative Art Deco vertical piers & horizontal stone bands
    ctx.fillStyle = '#e2d9cc';
    for (let x = 0; x < 512; x += 64) {
      ctx.fillRect(x, 0, 8, 512);
    }
    for (let y = 0; y < 512; y += 64) {
      ctx.fillRect(0, y, 512, 6);
    }

    // Windows with bronze frames & warm interior glows
    const cols = 8;
    const rows = 8;
    const winW = 42;
    const winH = 46;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = 12 + c * 64;
        const wy = 10 + r * 64;

        // Dark bronze frame
        ctx.fillStyle = '#45372b';
        ctx.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);

        const rand = (Math.sin(r * 43 + c * 29) + 1) / 2;
        if (rand < 0.45) {
          ctx.fillStyle = '#fef08a'; // Warm cozy suite light
        } else if (rand < 0.7) {
          ctx.fillStyle = '#fed7aa'; // Sunset amber bedroom light
        } else {
          ctx.fillStyle = '#1c1917'; // Curtains drawn / dark
        }
        ctx.fillRect(wx, wy, winW, winH);

        // Window mullion cross
        ctx.strokeStyle = '#45372b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wx + winW / 2, wy);
        ctx.lineTo(wx + winW / 2, wy + winH);
        ctx.moveTo(wx, wy + winH * 0.4);
        ctx.lineTo(wx + winW, wy + winH * 0.4);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.textureCache.set(cacheKey, tex);
    return tex;
  }

  // 3. Residential Apartment Facade Texture (terracotta brick & individual home windows)
  public static getResidentialTexture(
    brickHue: 'terracotta' | 'sage' = 'terracotta',
  ): THREE.CanvasTexture | null {
    const cacheKey = `residential_${brickHue}`;
    if (this.textureCache.has(cacheKey)) return this.textureCache.get(cacheKey)!;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = brickHue === 'terracotta' ? '#9a3412' : '#334e44';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle brick mortar pattern
    ctx.fillStyle = '#7c2d12';
    for (let y = 0; y < 512; y += 8) {
      ctx.fillRect(0, y, 512, 1);
    }

    const cols = 8;
    const rows = 12;
    const winW = 34;
    const winH = 26;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = 15 + c * 64;
        const wy = 8 + r * 42;

        // White concrete window sill and lintel
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(wx - 3, wy - 3, winW + 6, winH + 6);

        const rand = (Math.sin(r * 23 + c * 13) + 1) / 2;
        if (rand < 0.35) {
          ctx.fillStyle = '#fde68a'; // Living room yellow
        } else if (rand < 0.55) {
          ctx.fillStyle = '#bfdbfe'; // TV flicker cool white
        } else if (rand < 0.7) {
          ctx.fillStyle = '#fed7aa'; // Peach bedroom
        } else {
          ctx.fillStyle = '#0f172a'; // Night dark
        }
        ctx.fillRect(wx, wy, winW, winH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.textureCache.set(cacheKey, tex);
    return tex;
  }

  // 4. Commercial Ribbon Glass & Brushed Steel Texture
  public static getCommercialRibbonTexture(): THREE.CanvasTexture | null {
    const cacheKey = 'commercial_ribbon';
    if (this.textureCache.has(cacheKey)) return this.textureCache.get(cacheKey)!;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Alternating horizontal ribbon glass bands and titanium composite panels
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    const floorH = 64;
    for (let y = 0; y < 512; y += floorH) {
      // Titanium spandrel band
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, y, 512, 22);

      // Continuous reflective ribbon window
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, y + 22, 512, 40);

      // Vertical mullions along the glass ribbon
      ctx.fillStyle = '#0f172a';
      for (let x = 0; x < 512; x += 32) {
        ctx.fillRect(x, y + 22, 3, 40);
        const rand = (Math.sin(y * 19 + x * 37) + 1) / 2;
        if (rand < 0.4) {
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(x + 3, y + 24, 26, 36);
          ctx.fillStyle = '#0f172a';
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.textureCache.set(cacheKey, tex);
    return tex;
  }

  // 5. Classic Red Brick Industrial Loft Texture
  public static getBrickWarehouseTexture(): THREE.CanvasTexture | null {
    const cacheKey = 'brick_warehouse';
    if (this.textureCache.has(cacheKey)) return this.textureCache.get(cacheKey)!;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Classic weathered red brick wall
    ctx.fillStyle = '#832a19';
    ctx.fillRect(0, 0, 512, 512);

    // Weathering & brick details
    ctx.fillStyle = '#6a2114';
    for (let y = 0; y < 512; y += 12) {
      ctx.fillRect(0, y, 512, 2);
    }

    // Industrial warehouse multi-pane arched windows
    const cols = 6;
    const rows = 8;
    const winW = 54;
    const winH = 44;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = 16 + c * 84;
        const wy = 12 + r * 64;

        // Brick lintel arch
        ctx.fillStyle = '#3a110a';
        ctx.fillRect(wx - 3, wy - 3, winW + 6, winH + 6);

        // Window glass with warm workshop light or dark panes
        const rand = (Math.sin(r * 29 + c * 17) + 1) / 2;
        ctx.fillStyle = rand < 0.5 ? '#fde047' : '#1e1b18';
        ctx.fillRect(wx, wy, winW, winH);

        // Black iron industrial window grid (3x3 panes)
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(wx + (winW / 3) * i, wy);
          ctx.lineTo(wx + (winW / 3) * i, wy + winH);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(wx, wy + (winH / 3) * i);
          ctx.lineTo(wx + winW, wy + (winH / 3) * i);
          ctx.stroke();
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.textureCache.set(cacheKey, tex);
    return tex;
  }

  // Main Entry Point
  public static createBuilding(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0x00d4ff,
    billboardText?: string,
    style?: BuildingStyle,
  ): { mesh: THREE.Group; bounds: BuildingBox; extraBounds?: BuildingBox[] } {
    const selectedStyle = style || 'CYBER_TOWER';

    switch (selectedStyle) {
      case 'LUXURY_RESORT':
        return this.createLuxuryResort(x, z, width, depth, height, accentColor, billboardText);
      case 'RESIDENTIAL_BLOCK':
        return this.createResidentialBlock(x, z, width, depth, height, accentColor, billboardText);
      case 'COMMERCIAL_HQ':
        return this.createCommercialHQ(x, z, width, depth, height, accentColor, billboardText);
      case 'CLASSIC_BRICK_LOFT':
        return this.createClassicBrickLoft(x, z, width, depth, height, accentColor, billboardText);
      case 'ROUND_TOWER':
        return this.createRoundTower(x, z, width, depth, height, accentColor, billboardText);
      case 'PAGODA_NEON_TOWER':
        return this.createPagodaTower(x, z, width, depth, height, accentColor, billboardText);
      case 'TWIN_TOWERS':
        return this.createTwinTowers(x, z, width, depth, height, accentColor, billboardText);
      case 'SUBURBAN_HOUSE':
        return this.createSuburbanHouse(x, z, width, depth, height, accentColor, billboardText);
      case 'CYBER_TOWER':
      default:
        return this.createCyberTower(x, z, width, depth, height, accentColor, billboardText);
    }
  }

  // 1. Cyber Skyscraper Tower (Flagship Futuristic High-Rise)
  public static createCyberTower(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0x00d4ff,
    billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();
    const winTex = this.getOfficeWindowTexture('cyan');

    // Main Skyscraper Tower
    const geo = new THREE.BoxGeometry(width, height, depth);
    const rx = Math.max(2, Math.round(width / 12));
    const ry = Math.max(2, Math.round(height / 10));
    const towerTex = this.getRepeatedTexture(winTex, 'office_cyan', rx, ry);

    const mat = new THREE.MeshStandardMaterial({
      color: towerTex ? 0xffffff : 0x334155,
      roughness: 0.35,
      metalness: 0.5,
      ...(towerTex ? { map: towerTex } : {}),
    });

    const mainMesh = new THREE.Mesh(geo, mat);
    mainMesh.position.set(x, height / 2, z);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    // High-rise Setback / Upper Tier for taller skyscrapers
    let topY = height;
    let tierBounds: BuildingBox['tier'] = undefined;
    if (height > 35) {
      const tierWidth = width * 0.72;
      const tierDepth = depth * 0.72;
      const tierHeight = height * 0.28;

      const tierRx = Math.max(1, Math.round(tierWidth / 12));
      const tierRy = Math.max(1, Math.round(tierHeight / 10));
      const tierTex = this.getRepeatedTexture(winTex, 'office_cyan', tierRx, tierRy);

      const tierGeo = new THREE.BoxGeometry(tierWidth, tierHeight, tierDepth);
      const tierMat = new THREE.MeshStandardMaterial({
        color: tierTex ? 0xffffff : 0x1e293b,
        roughness: 0.3,
        metalness: 0.55,
        ...(tierTex ? { map: tierTex } : {}),
      });
      const tierMesh = new THREE.Mesh(tierGeo, tierMat);
      tierMesh.position.set(x, height + tierHeight / 2, z);
      tierMesh.castShadow = true;
      tierMesh.receiveShadow = true;
      group.add(tierMesh);

      topY = height + tierHeight;
      tierBounds = {
        minX: x - tierWidth / 2,
        maxX: x + tierWidth / 2,
        minZ: z - tierDepth / 2,
        maxZ: z + tierDepth / 2,
        height: topY,
      };

      // Rooftop Telecommunication Spire / Antenna
      const antennaGeo = new THREE.CylinderGeometry(0.15, 0.4, 12, 8);
      const antennaMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const antenna = new THREE.Mesh(antennaGeo, antennaMat);
      antenna.position.set(x, topY + 6, z);
      group.add(antenna);

      // Blinking Red Aviation Safety Beacon Light
      const beaconGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(x, topY + 12, z);
      group.add(beacon);
    }

    // Neon Glowing Edge Strip along Roof
    const neonGeo = new THREE.BoxGeometry(width + 0.3, 0.45, depth + 0.3);
    const neonMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const neonRoof = new THREE.Mesh(neonGeo, neonMat);
    neonRoof.position.set(x, height + 0.22, z);
    group.add(neonRoof);

    // Vertical Cyber Neon Corner Pillars on taller skyscrapers
    if (height > 30) {
      const pillarGeo = new THREE.BoxGeometry(0.3, height, 0.3);
      const pillarMat = new THREE.MeshBasicMaterial({ color: accentColor });
      const hw = width / 2;
      const hd = depth / 2;
      const cornerOffsets = [
        [-hw, -hd],
        [hw, -hd],
        [-hw, hd],
        [hw, hd],
      ];
      for (const [ox, oz] of cornerOffsets) {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(x + ox, height / 2, z + oz);
        group.add(pillar);
      }
    }

    // Helipad on selected wide buildings
    if (width > 30 && height < 45) {
      const padGeo = new THREE.CylinderGeometry(width * 0.35, width * 0.35, 0.1, 24);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(x - width * 0.1, topY + 0.05, z + depth * 0.1);
      group.add(padMesh);

      const ringGeo = new THREE.TorusGeometry(width * 0.3, 0.3, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(x - width * 0.1, topY + 0.12, z + depth * 0.1);
      group.add(ringMesh);
    }

    // Giant Glowing Rooftop Neon Billboards
    if (billboardText && typeof document !== 'undefined') {
      const signGroup = this.createNeonBillboard(billboardText, accentColor);
      signGroup.position.set(x, topY + 3.2, z);
      group.add(signGroup);
    }

    return {
      mesh: group,
      bounds: {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        height: topY,
        baseHeight: height,
        tier: tierBounds,
      },
    };
  }

  // 2. Luxury Resort / Art Deco Hotel (Vice City Luxury with Rooftop Pool & Marquee)
  public static createLuxuryResort(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0xf59e0b,
    billboardText: string = 'HOTEL VICE',
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();
    const hotelTex = this.getLuxuryHotelTexture();

    // Main Grand Hotel Tower
    const geo = new THREE.BoxGeometry(width, height, depth);
    const rx = Math.max(2, Math.round(width / 14));
    const ry = Math.max(2, Math.round(height / 10));
    const tex = this.getRepeatedTexture(hotelTex, 'luxury_hotel', rx, ry);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.2,
      ...(tex ? { map: tex } : {}),
    });

    const hotelMesh = new THREE.Mesh(geo, mat);
    hotelMesh.position.set(x, height / 2, z);
    hotelMesh.castShadow = true;
    hotelMesh.receiveShadow = true;
    group.add(hotelMesh);

    // Penthouse Terrace Tier
    const tierW = width * 0.7;
    const tierD = depth * 0.7;
    const tierH = Math.max(6, height * 0.22);
    const tierGeo = new THREE.BoxGeometry(tierW, tierH, tierD);
    const tierMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 });
    const tierMesh = new THREE.Mesh(tierGeo, tierMat);
    tierMesh.position.set(x, height + tierH / 2, z);
    group.add(tierMesh);

    const topY = height + tierH;

    // Rooftop Luxury Swimming Pool on the Terrace
    const poolW = width * 0.35;
    const poolD = depth * 0.25;
    const poolDeckGeo = new THREE.BoxGeometry(poolW + 4, 0.3, poolD + 4);
    const poolDeckMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 }); // Teak wood deck
    const poolDeck = new THREE.Mesh(poolDeckGeo, poolDeckMat);
    poolDeck.position.set(x - width * 0.15, height + 0.15, z);
    group.add(poolDeck);

    // Glowing Turquoise Pool Water
    const waterGeo = new THREE.BoxGeometry(poolW, 0.35, poolD);
    const waterMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const poolWater = new THREE.Mesh(waterGeo, waterMat);
    poolWater.position.set(x - width * 0.15, height + 0.2, z);
    group.add(poolWater);

    // Poolside Sun Loungers
    const loungerGeo = new THREE.BoxGeometry(1.6, 0.4, 0.8);
    const loungerMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (let l = -1; l <= 1; l++) {
      const lounger = new THREE.Mesh(loungerGeo, loungerMat);
      lounger.position.set(x - width * 0.15 + l * 2.5, height + 0.4, z + poolD / 2 + 1.2);
      group.add(lounger);
    }

    // Street-Level Grand Entrance Canopy & Marquee
    const canopyGeo = new THREE.BoxGeometry(width * 0.5, 0.6, 6);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(x, 4.2, z + depth / 2 + 2.5);
    group.add(canopy);

    // Glowing Neon Edge on Canopy
    const canopyNeonGeo = new THREE.BoxGeometry(width * 0.5 + 0.2, 0.2, 6.2);
    const canopyNeonMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const canopyNeon = new THREE.Mesh(canopyNeonGeo, canopyNeonMat);
    canopyNeon.position.set(x, 4.4, z + depth / 2 + 2.5);
    group.add(canopyNeon);

    // Entrance Support Pillars
    const pillGeo = new THREE.CylinderGeometry(0.3, 0.3, 4.2, 8);
    const pillMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9 });
    const p1 = new THREE.Mesh(pillGeo, pillMat);
    p1.position.set(x - width * 0.22, 2.1, z + depth / 2 + 5.2);
    const p2 = new THREE.Mesh(pillGeo, pillMat);
    p2.position.set(x + width * 0.22, 2.1, z + depth / 2 + 5.2);
    group.add(p1, p2);

    // Glowing Rooftop Neon Billboard
    if (typeof document !== 'undefined') {
      const billboard = this.createNeonBillboard(billboardText || 'HOTEL VICE', accentColor);
      billboard.position.set(x, topY + 3.2, z);
      group.add(billboard);
    }

    return {
      mesh: group,
      bounds: {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        height: topY,
        baseHeight: height,
        tier: {
          minX: x - tierW / 2,
          maxX: x + tierW / 2,
          minZ: z - tierD / 2,
          maxZ: z + tierD / 2,
          height: topY,
        },
      },
    };
  }

  // 3. Residential High-Rise Apartments (3D Balconies & Rooftop AC / Pergola)
  public static createResidentialBlock(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0x10b981,
    billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();
    const resTex = this.getResidentialTexture('terracotta');

    // Main Residential Building
    const geo = new THREE.BoxGeometry(width, height, depth);
    const rx = Math.max(2, Math.round(width / 12));
    const ry = Math.max(2, Math.round(height / 8));
    const tex = this.getRepeatedTexture(resTex, 'res_terracotta', rx, ry);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.1,
      ...(tex ? { map: tex } : {}),
    });

    const buildingMesh = new THREE.Mesh(geo, mat);
    buildingMesh.position.set(x, height / 2, z);
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    group.add(buildingMesh);

    // 3D Protruding Balconies on multiple floors
    const numFloors = Math.min(6, Math.floor(height / 10));
    const balconyGeo = new THREE.BoxGeometry(width * 0.35, 0.4, 2.8);
    const balconyMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
    const railingGeo = new THREE.BoxGeometry(width * 0.35, 1.0, 0.15);
    const railingMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });

    for (let f = 1; f <= numFloors; f++) {
      const by = f * 8.5;
      // Front Balcony
      const bFront = new THREE.Mesh(balconyGeo, balconyMat);
      bFront.position.set(x, by, z + depth / 2 + 1.4);
      const rFront = new THREE.Mesh(railingGeo, railingMat);
      rFront.position.set(x, by + 0.6, z + depth / 2 + 2.7);
      group.add(bFront, rFront);

      // Back Balcony
      const bBack = new THREE.Mesh(balconyGeo, balconyMat);
      bBack.position.set(x, by, z - depth / 2 - 1.4);
      const rBack = new THREE.Mesh(railingGeo, railingMat);
      rBack.position.set(x, by + 0.6, z - depth / 2 - 2.7);
      group.add(bBack, rBack);
    }

    // Rooftop Stairwell / Penthouse Access Structure
    const stairW = width * 0.3;
    const stairD = depth * 0.3;
    const stairH = 5.0;
    const stairGeo = new THREE.BoxGeometry(stairW, stairH, stairD);
    const stairMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });
    const stairMesh = new THREE.Mesh(stairGeo, stairMat);
    stairMesh.position.set(x, height + stairH / 2, z);
    group.add(stairMesh);

    // Rooftop Industrial Air Conditioning Units (AC boxes with fan grilles)
    const acGeo = new THREE.BoxGeometry(3.5, 2.2, 3.5);
    const acMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 });
    const ac1 = new THREE.Mesh(acGeo, acMat);
    ac1.position.set(x + width * 0.28, height + 1.1, z + depth * 0.2);
    const ac2 = new THREE.Mesh(acGeo, acMat);
    ac2.position.set(x + width * 0.28, height + 1.1, z - depth * 0.2);
    group.add(ac1, ac2);

    // Rooftop Pergola with sunshades
    const pergolaGeo = new THREE.BoxGeometry(width * 0.28, 3.0, depth * 0.28);
    const pergolaMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.9,
      wireframe: true,
    });
    const pergola = new THREE.Mesh(pergolaGeo, pergolaMat);
    pergola.position.set(x - width * 0.28, height + 1.5, z);
    group.add(pergola);

    // Rooftop Neon Edge Line
    const neonGeo = new THREE.BoxGeometry(width + 0.2, 0.4, depth + 0.2);
    const neonMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.position.set(x, height + 0.2, z);
    group.add(neon);

    if (billboardText && typeof document !== 'undefined') {
      const sign = this.createNeonBillboard(billboardText, accentColor);
      sign.position.set(x, height + stairH + 2.8, z);
      group.add(sign);
    }

    const topY = height + stairH;
    return {
      mesh: group,
      bounds: {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        height: topY,
        baseHeight: height,
        tier: {
          minX: x - stairW / 2,
          maxX: x + stairW / 2,
          minZ: z - stairD / 2,
          maxZ: z + stairD / 2,
          height: topY,
        },
      },
    };
  }

  // 4. Commercial Tech Hub (Ribbon Glass & Tilted Solar Panels & Atrium)
  public static createCommercialHQ(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0x38bdf8,
    billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();
    const ribbonTex = this.getCommercialRibbonTexture();

    // Main Corporate Tower
    const geo = new THREE.BoxGeometry(width, height, depth);
    const rx = Math.max(2, Math.round(width / 14));
    const ry = Math.max(2, Math.round(height / 10));
    const tex = this.getRepeatedTexture(ribbonTex, 'comm_ribbon', rx, ry);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.6,
      ...(tex ? { map: tex } : {}),
    });

    const towerMesh = new THREE.Mesh(geo, mat);
    towerMesh.position.set(x, height / 2, z);
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    group.add(towerMesh);

    // Angled Glass Roof Atrium Crown
    const atriumW = width * 0.6;
    const atriumD = depth * 0.6;
    const atriumH = Math.max(6, height * 0.18);
    const atriumGeo = new THREE.ConeGeometry(atriumW * 0.6, atriumH, 4);
    atriumGeo.rotateY(Math.PI / 4);
    const atriumMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    });
    const atrium = new THREE.Mesh(atriumGeo, atriumMat);
    atrium.position.set(x, height + atriumH / 2, z);
    group.add(atrium);

    const topY = height + atriumH;

    // Rooftop Solar Panel Arrays
    const solarGeo = new THREE.BoxGeometry(4.5, 0.2, 3.0);
    solarGeo.rotateX(0.35); // 20-degree tilt toward the sun
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.2,
      metalness: 0.9,
    });

    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const panel = new THREE.Mesh(solarGeo, solarMat);
        panel.position.set(x + sx * (width * 0.32), height + 1.2, z + sz * (depth * 0.32));
        group.add(panel);
      }
    }

    // Street-Level Double-Height Glass Lobby
    const lobbyGeo = new THREE.BoxGeometry(width + 0.8, 5.0, depth + 0.8);
    const lobbyMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
    });
    const lobby = new THREE.Mesh(lobbyGeo, lobbyMat);
    lobby.position.set(x, 2.5, z);
    group.add(lobby);

    // Neon Accent Band at Mid-Height
    const bandGeo = new THREE.BoxGeometry(width + 0.3, 0.4, depth + 0.3);
    const bandMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const midBand = new THREE.Mesh(bandGeo, bandMat);
    midBand.position.set(x, height * 0.6, z);
    group.add(midBand);

    if (billboardText && typeof document !== 'undefined') {
      const sign = this.createNeonBillboard(billboardText, accentColor);
      sign.position.set(x, topY + 2.8, z);
      group.add(sign);
    }

    return {
      mesh: group,
      bounds: {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        height: topY,
        baseHeight: height,
        tier: {
          minX: x - atriumW / 2,
          maxX: x + atriumW / 2,
          minZ: z - atriumD / 2,
          maxZ: z + atriumD / 2,
          height: topY,
        },
      },
    };
  }

  // 5. Classic Red Brick Industrial Loft (Iconic Rooftop Water Tower & Fire Escapes)
  public static createClassicBrickLoft(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0xf59e0b,
    billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();
    const brickTex = this.getBrickWarehouseTexture();

    // Main Brick Warehouse Body
    const geo = new THREE.BoxGeometry(width, height, depth);
    const rx = Math.max(2, Math.round(width / 12));
    const ry = Math.max(2, Math.round(height / 8));
    const tex = this.getRepeatedTexture(brickTex, 'brick_warehouse', rx, ry);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.1,
      ...(tex ? { map: tex } : {}),
    });

    const building = new THREE.Mesh(geo, mat);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);

    // Iconic Rooftop Cylindrical Wooden Water Tower on 4 Steel Legs
    const towerR = 3.2;
    const towerH = 5.5;
    const legH = 4.5;

    // Steel leg trestle
    const legGeo = new THREE.CylinderGeometry(0.18, 0.18, legH, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x + lx * (towerR * 0.7), height + legH / 2, z + lz * (towerR * 0.7));
        group.add(leg);
      }
    }

    // Wooden Barrel Tank
    const tankGeo = new THREE.CylinderGeometry(towerR, towerR, towerH, 16);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(x, height + legH + towerH / 2, z);
    group.add(tank);

    // Conical Roof on Water Tower
    const coneGeo = new THREE.ConeGeometry(towerR * 1.08, 2.5, 16);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(x, height + legH + towerH + 1.25, z);
    group.add(cone);

    const topY = height + legH + towerH + 2.5;

    // Exterior Black Iron Fire Escapes on the Street Facade
    const numEscapes = Math.min(5, Math.floor(height / 10));
    const escapePlatGeo = new THREE.BoxGeometry(7.0, 0.35, 2.5);
    const escapeMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.8,
      roughness: 0.5,
    });
    const ladderGeo = new THREE.BoxGeometry(0.8, 8.0, 0.1);

    for (let e = 1; e <= numEscapes; e++) {
      const ey = e * 8.5;
      const plat = new THREE.Mesh(escapePlatGeo, escapeMat);
      plat.position.set(x + width * 0.15, ey, z + depth / 2 + 1.3);
      const ladder = new THREE.Mesh(ladderGeo, escapeMat);
      ladder.position.set(x + width * 0.15 + 2.6, ey - 4.0, z + depth / 2 + 1.3);
      group.add(plat, ladder);
    }

    // Industrial Rooftop Chimneys & Exhaust Ducts
    const ductGeo = new THREE.CylinderGeometry(0.7, 0.7, 4.0, 8);
    const ductMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const duct1 = new THREE.Mesh(ductGeo, ductMat);
    duct1.position.set(x + width * 0.25, height + 2.0, z - depth * 0.2);
    const duct2 = new THREE.Mesh(ductGeo, ductMat);
    duct2.position.set(x + width * 0.15, height + 2.0, z - depth * 0.2);
    group.add(duct1, duct2);

    if (billboardText && typeof document !== 'undefined') {
      const sign = this.createNeonBillboard(billboardText, accentColor);
      sign.position.set(x, topY + 2.8, z);
      group.add(sign);
    }

    return {
      mesh: group,
      bounds: {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        height: topY,
        baseHeight: height,
        tier: {
          minX: x - towerR * 1.5,
          maxX: x + towerR * 1.5,
          minZ: z - towerR * 1.5,
          maxZ: z + towerR * 1.5,
          height: topY,
        },
      },
    };
  }

  // 6. Futuristic Cylindrical / Round Tower with Helipad
  public static createRoundTower(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0xa855f7,
    billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();
    const radius = Math.min(width, depth) / 2;
    const ribbonTex = this.getCommercialRibbonTexture();

    // Cylindrical Faceted Tower Geometry (24 radial segments)
    const geo = new THREE.CylinderGeometry(radius, radius, height, 24);
    const ry = Math.max(2, Math.round(height / 10));
    const tex = this.getRepeatedTexture(ribbonTex, 'comm_ribbon_round', 4, ry);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.6,
      ...(tex ? { map: tex } : {}),
    });

    const tower = new THREE.Mesh(geo, mat);
    tower.position.set(x, height / 2, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    // Glowing Neon Rings circling the cylinder at 1/3, 2/3, and roof
    const ringHeights = [height * 0.33, height * 0.66, height + 0.1];
    const ringMat = new THREE.MeshBasicMaterial({ color: accentColor });

    for (const rh of ringHeights) {
      const ringGeo = new THREE.TorusGeometry(radius + 0.25, 0.25, 8, 32);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(x, rh, z);
      group.add(ringMesh);
    }

    // Full Circular Rooftop Helipad
    const padGeo = new THREE.CylinderGeometry(radius * 0.75, radius * 0.75, 0.2, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(x, height + 0.15, z);
    group.add(pad);

    const yellowRingGeo = new THREE.TorusGeometry(radius * 0.65, 0.25, 8, 24);
    yellowRingGeo.rotateX(Math.PI / 2);
    const yellowRingMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const yellowRing = new THREE.Mesh(yellowRingGeo, yellowRingMat);
    yellowRing.position.set(x, height + 0.3, z);
    group.add(yellowRing);

    // Central 'H' mark for helipad
    const barGeo = new THREE.BoxGeometry(0.8, 0.1, radius * 0.6);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const h1 = new THREE.Mesh(barGeo, barMat);
    h1.position.set(x - radius * 0.2, height + 0.32, z);
    const h2 = new THREE.Mesh(barGeo, barMat);
    h2.position.set(x + radius * 0.2, height + 0.32, z);
    const crossGeo = new THREE.BoxGeometry(radius * 0.4, 0.1, 0.8);
    const hCross = new THREE.Mesh(crossGeo, barMat);
    hCross.position.set(x, height + 0.32, z);
    group.add(h1, h2, hCross);

    if (billboardText && typeof document !== 'undefined') {
      const sign = this.createNeonBillboard(billboardText, accentColor);
      sign.position.set(x, height + 4.0, z);
      group.add(sign);
    }

    return {
      mesh: group,
      bounds: {
        minX: x - radius,
        maxX: x + radius,
        minZ: z - radius,
        maxZ: z + radius,
        height,
      },
    };
  }

  // 7. Neo-Tokyo / Cyber Pagoda Tower (Tiered Eaved Roofs & Asian Neon Lanterns)
  public static createPagodaTower(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0xef4444,
    billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();
    const officeTex = this.getOfficeWindowTexture('purple');

    // Central Shaft Tower
    const geo = new THREE.BoxGeometry(width * 0.8, height, depth * 0.8);
    const rx = Math.max(2, Math.round(width / 12));
    const ry = Math.max(2, Math.round(height / 10));
    const tex = this.getRepeatedTexture(officeTex, 'office_purple', rx, ry);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.4,
      metalness: 0.5,
      ...(tex ? { map: tex } : {}),
    });

    const tower = new THREE.Mesh(geo, mat);
    tower.position.set(x, height / 2, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    // Ground Lobby Podium Base
    const podiumGeo = new THREE.BoxGeometry(width, 4.5, depth);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.5,
      metalness: 0.4,
    });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.set(x, 2.25, z);
    podium.castShadow = true;
    podium.receiveShadow = true;
    group.add(podium);

    // Multi-Tiered Flared Pagoda Roofs with Glowing Red / Gold Eaves
    const tierRatios = [0.45, 0.75, 1.0];
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const crimsonMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    for (let t = 0; t < tierRatios.length; t++) {
      const ty = height * tierRatios[t];
      const scale = 1.0 - t * 0.12;
      const roofW = width * 1.15 * scale;
      const roofD = depth * 1.15 * scale;

      // Sloped flared roof tier
      const roofGeo = new THREE.ConeGeometry(roofW * 0.65, 3.2, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(x, ty + 1.6, z);
      group.add(roof);

      // Glowing Neon Edge along the flared eaves
      const edgeGeo = new THREE.BoxGeometry(roofW, 0.35, roofD);
      const edge = new THREE.Mesh(edgeGeo, t % 2 === 0 ? crimsonMat : goldMat);
      edge.position.set(x, ty, z);
      group.add(edge);

      // Hanging Red Cyber Lanterns on 4 Corners
      const lanternGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.9, 8);
      const lanternMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
      const hw = roofW / 2;
      const hd = roofD / 2;
      const corners = [
        [-hw, -hd],
        [hw, -hd],
        [-hw, hd],
        [hw, hd],
      ];
      for (const [cx, cz] of corners) {
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.set(x + cx, ty - 0.7, z + cz);
        group.add(lantern);
      }
    }

    // Imperial Golden Spire / Finial on top
    const spireGeo = new THREE.CylinderGeometry(0.1, 0.6, 9.0, 8);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.1,
    });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.set(x, height + 6.0, z);
    group.add(spire);

    const topY = height + 10.5;

    if (billboardText && typeof document !== 'undefined') {
      const sign = this.createNeonBillboard(billboardText, accentColor);
      sign.position.set(x, topY + 2.5, z);
      group.add(sign);
    }

    return {
      mesh: group,
      bounds: {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        height: topY,
        baseHeight: height,
      },
    };
  }

  // 8. Twin Towers with Skybridge
  public static createTwinTowers(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0x00d4ff,
    billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox; extraBounds?: BuildingBox[] } {
    const group = new THREE.Group();
    const officeTex = this.getOfficeWindowTexture('cyan');

    // Shared Podium Base (Height 7m)
    const baseH = 7.0;
    const baseGeo = new THREE.BoxGeometry(width, baseH, depth);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.4,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(x, baseH / 2, z);
    group.add(baseMesh);

    // Two Slender Symmetrical Towers
    const towerW = width * 0.38;
    const towerD = depth * 0.75;
    const towerH = height - baseH;
    const offsetW = width * 0.28;

    const rx = Math.max(1, Math.round(towerW / 10));
    const ry = Math.max(2, Math.round(towerH / 10));
    const tex = this.getRepeatedTexture(officeTex, 'office_cyan', rx, ry);

    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.5,
      ...(tex ? { map: tex } : {}),
    });

    // West Tower
    const towerGeo = new THREE.BoxGeometry(towerW, towerH, towerD);
    const westTower = new THREE.Mesh(towerGeo, towerMat);
    westTower.position.set(x - offsetW, baseH + towerH / 2, z);
    westTower.castShadow = true;
    westTower.receiveShadow = true;

    // East Tower
    const eastTower = new THREE.Mesh(towerGeo, towerMat);
    eastTower.position.set(x + offsetW, baseH + towerH / 2, z);
    eastTower.castShadow = true;
    eastTower.receiveShadow = true;
    group.add(westTower, eastTower);

    // Glowing Neon Rims on both Tower Roofs
    const roofRimGeo = new THREE.BoxGeometry(towerW + 0.3, 0.4, towerD + 0.3);
    const roofRimMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const rWest = new THREE.Mesh(roofRimGeo, roofRimMat);
    rWest.position.set(x - offsetW, height + 0.2, z);
    const rEast = new THREE.Mesh(roofRimGeo, roofRimMat);
    rEast.position.set(x + offsetW, height + 0.2, z);
    group.add(rWest, rEast);

    // Illuminated Glass Skybridge connecting the two towers at mid-height
    const bridgeY = Math.min(height * 0.65, height - 8);
    const bridgeSpan = offsetW * 2 - towerW;
    const bridgeGeo = new THREE.BoxGeometry(bridgeSpan + 2.0, 4.0, towerD * 0.5);
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.7,
      roughness: 0.2,
      transparent: true,
      opacity: 0.75,
    });
    const skybridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    skybridge.position.set(x, bridgeY, z);
    group.add(skybridge);

    // Glowing Under-bridge Neon Strip
    const bridgeNeonGeo = new THREE.BoxGeometry(bridgeSpan + 2.0, 0.3, towerD * 0.5 + 0.2);
    const bridgeNeonMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const bridgeNeon = new THREE.Mesh(bridgeNeonGeo, bridgeNeonMat);
    bridgeNeon.position.set(x, bridgeY - 2.1, z);
    group.add(bridgeNeon);

    if (billboardText && typeof document !== 'undefined') {
      const sign = this.createNeonBillboard(billboardText, accentColor);
      sign.position.set(x - offsetW, height + 3.0, z);
      group.add(sign);
    }

    const boundsWest: BuildingBox = {
      minX: x - offsetW - towerW / 2,
      maxX: x - offsetW + towerW / 2,
      minZ: z - towerD / 2,
      maxZ: z + towerD / 2,
      height,
      baseHeight: height,
    };

    const boundsEast: BuildingBox = {
      minX: x + offsetW - towerW / 2,
      maxX: x + offsetW + towerW / 2,
      minZ: z - towerD / 2,
      maxZ: z + towerD / 2,
      height,
      baseHeight: height,
    };

    const boundsPodium: BuildingBox = {
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      height: baseH,
      baseHeight: baseH,
    };

    return {
      mesh: group,
      bounds: boundsWest,
      extraBounds: [boundsEast, boundsPodium],
    };
  }

  // Giant Neon Billboards
  public static createNeonBillboard(text: string, glowColor: number): THREE.Group {
    const signGroup = new THREE.Group();
    if (typeof document === 'undefined') return signGroup;

    const cacheKey = `billboard_${text}_${glowColor}`;
    let tex = this.billboardCache.get(cacheKey);

    if (!tex) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return signGroup;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(0, 0, 512, 128);

      const hexStr = `#${glowColor.toString(16).padStart(6, '0')}`;
      ctx.strokeStyle = hexStr;
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 504, 120);

      ctx.font = '900 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = hexStr;
      ctx.shadowColor = hexStr;
      ctx.shadowBlur = 18;
      ctx.fillText(text, 256, 64);

      tex = new THREE.CanvasTexture(canvas);
      this.billboardCache.set(cacheKey, tex);
    }

    const signMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const signGeo = new THREE.PlaneGeometry(16, 4.5);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signGroup.add(signMesh);

    // Support framework
    const frameGeo = new THREE.BoxGeometry(16.4, 0.3, 0.4);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const topFrame = new THREE.Mesh(frameGeo, frameMat);
    topFrame.position.y = 2.4;
    const botFrame = new THREE.Mesh(frameGeo, frameMat);
    botFrame.position.y = -2.4;
    signGroup.add(topFrame, botFrame);

    return signGroup;
  }

  // Stunt jump ramp generator
  public static createRamp(
    x: number,
    z: number,
    width: number,
    length: number,
    height: number,
    rotY: number = 0,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height);
    shape.closePath();

    const extrudeSettings = { depth: width, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Hazard Yellow/Orange
      roughness: 0.5,
      metalness: 0.4,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Neon hazard arrow indicators on ramp
    const arrowGeo = new THREE.PlaneGeometry(width * 0.8, 1.2);
    arrowGeo.rotateX(-Math.atan2(height, length));
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.position.set(x, height * 0.5 + 0.1, z);
    arrowMesh.rotation.y = rotY;
    group.add(arrowMesh);

    return {
      mesh: group,
      bounds: {
        minX: x - width,
        maxX: x + width,
        minZ: z - length,
        maxZ: z + length,
        height,
      },
    };
  }

  // 9. Suburban Residential House ("Wohnhaus" with Gabled Roof, Chimney & Porch)
  public static createSuburbanHouse(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0x3b82f6,
    _billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();

    // House scale (2-story residential family home)
    const houseW = Math.min(width * 0.75, 24);
    const houseD = Math.min(depth * 0.75, 20);
    const houseH = Math.max(height * 0.45, 9.5);

    // 1. House Body (Warm wood / painted brick siding)
    const houseMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Clean off-white clapboard
      roughness: 0.6,
      metalness: 0.1,
    });
    const houseMesh = new THREE.Mesh(new THREE.BoxGeometry(houseW, houseH, houseD), houseMat);
    houseMesh.position.set(x, houseH / 2, z);
    houseMesh.castShadow = true;
    houseMesh.receiveShadow = true;
    group.add(houseMesh);

    // 2. Gabled Roof (Satteldach mit Ziegeln)
    const roofH = 4.2;
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark architectural slate tiles
      roughness: 0.7,
    });
    const roofSlopeL = new THREE.Mesh(
      new THREE.BoxGeometry(houseW * 0.58, 0.4, houseD + 1.2),
      roofMat,
    );
    roofSlopeL.position.set(x - houseW * 0.25, houseH + roofH * 0.45, z);
    roofSlopeL.rotation.z = Math.PI / 6;

    const roofSlopeR = new THREE.Mesh(
      new THREE.BoxGeometry(houseW * 0.58, 0.4, houseD + 1.2),
      roofMat,
    );
    roofSlopeR.position.set(x + houseW * 0.25, houseH + roofH * 0.45, z);
    roofSlopeR.rotation.z = -Math.PI / 6;
    group.add(roofSlopeL, roofSlopeR);

    // Triangular Gable End Walls
    const gableGeo = new THREE.ConeGeometry(houseW * 0.5, roofH, 4);
    gableGeo.rotateY(Math.PI / 4);
    const gableMesh = new THREE.Mesh(gableGeo, houseMat);
    gableMesh.scale.set(1, 1, (houseD * 0.8) / (houseW * 0.5));
    gableMesh.position.set(x, houseH + roofH * 0.5, z);
    group.add(gableMesh);

    // 3. Brick Chimney with Top Flue
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 });
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.2, 1.4), chimneyMat);
    chimney.position.set(x + houseW * 0.28, houseH + roofH * 0.65, z + houseD * 0.2);
    group.add(chimney);

    // 4. Covered Front Porch
    const porchMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.35, 3.2), roofMat);
    porchRoof.position.set(x, 3.8, z + houseD / 2 + 1.6);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 0.35), pillarMat);
    pillarL.position.set(x - 2.8, 1.8, z + houseD / 2 + 2.8);
    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 0.35), pillarMat);
    pillarR.position.set(x + 2.8, 1.8, z + houseD / 2 + 2.8);

    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.3, 3.4), porchMat);
    porchFloor.position.set(x, 0.15, z + houseD / 2 + 1.7);
    group.add(porchRoof, pillarL, pillarR, porchFloor);

    // 5. Windows with Warm Glow
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });
    // Front windows (ground floor & 1st floor)
    const win1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 0.15), windowMat);
    win1.position.set(x - houseW * 0.28, 2.2, z + houseD / 2 + 0.08);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 0.15), windowMat);
    win2.position.set(x - houseW * 0.28, 6.2, z + houseD / 2 + 0.08);
    const win3 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 0.15), windowMat);
    win3.position.set(x + houseW * 0.28, 6.2, z + houseD / 2 + 0.08);
    group.add(win1, win2, win3);

    // Front door
    const doorMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.15), doorMat);
    door.position.set(x, 1.5, z + houseD / 2 + 0.08);
    group.add(door);

    return {
      mesh: group,
      bounds: {
        minX: x - houseW / 2 - 0.5,
        maxX: x + houseW / 2 + 0.5,
        minZ: z - houseD / 2 - 0.5,
        maxZ: z + houseD / 2 + 3.2,
        height: Math.max(height, houseH + roofH),
      },
    };
  }
}
