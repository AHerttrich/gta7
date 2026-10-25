import * as THREE from 'three';

export interface BuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export class Building {
  private static windowTexture: THREE.CanvasTexture | null = null;

  public static getWindowTexture(): THREE.CanvasTexture | null {
    if (this.windowTexture) return this.windowTexture;
    if (typeof document === 'undefined') {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark high-tech skyscraper glass background
    ctx.fillStyle = '#0b1324';
    ctx.fillRect(0, 0, 512, 512);

    // Office window grid
    const cols = 16;
    const rows = 16;
    const padX = 6;
    const padY = 8;
    const winW = (512 - padX * (cols + 1)) / cols;
    const winH = (512 - padY * (rows + 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = padX + c * (winW + padX);
        const wy = padY + r * (winH + padY);

        const rand = (Math.sin(r * 31 + c * 17) + 1) / 2;
        if (rand < 0.22) {
          ctx.fillStyle = '#fde047'; // Warm golden office glow
        } else if (rand < 0.4) {
          ctx.fillStyle = '#38bdf8'; // Cyber cyan glow
        } else if (rand < 0.54) {
          ctx.fillStyle = '#f8fafc'; // Crisp bright white
        } else {
          ctx.fillStyle = '#1e293b'; // Dark unlit reflective window
        }
        ctx.fillRect(wx, wy, winW, winH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.windowTexture = tex;
    return tex;
  }

  public static createBuilding(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0x00d4ff,
    billboardText?: string,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();
    const winTex = this.getWindowTexture();

    // 1. Main Skyscraper Tower
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.65,
      ...(winTex ? { map: winTex } : {}),
    });

    if (winTex) {
      // Scale texture coordinates nicely with building dimensions
      mat.map!.repeat.set(
        Math.max(1, Math.round(width / 14)),
        Math.max(1, Math.round(height / 12)),
      );
    }

    const mainMesh = new THREE.Mesh(geo, mat);
    mainMesh.position.set(x, height / 2, z);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    // 2. High-rise Setback / Upper Tier for taller skyscrapers
    let topY = height;
    if (height > 35) {
      const tierWidth = width * 0.72;
      const tierDepth = depth * 0.72;
      const tierHeight = height * 0.28;

      const tierGeo = new THREE.BoxGeometry(tierWidth, tierHeight, tierDepth);
      const tierMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.75,
        ...(winTex ? { map: winTex } : {}),
      });
      const tierMesh = new THREE.Mesh(tierGeo, tierMat);
      tierMesh.position.set(x, height + tierHeight / 2, z);
      tierMesh.castShadow = true;
      tierMesh.receiveShadow = true;
      group.add(tierMesh);

      topY = height + tierHeight;

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

    // 3. Neon Glowing Edge Strip along Roof
    const neonGeo = new THREE.BoxGeometry(width + 0.3, 0.45, depth + 0.3);
    const neonMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const neonRoof = new THREE.Mesh(neonGeo, neonMat);
    neonRoof.position.set(x, height + 0.22, z);
    group.add(neonRoof);

    // 4. Rooftop AC & Generator Units
    const acGeo = new THREE.BoxGeometry(width * 0.28, 2.2, depth * 0.28);
    const acMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const acMesh = new THREE.Mesh(acGeo, acMat);
    acMesh.position.set(x + width * 0.2, topY + 1.1, z - depth * 0.2);
    acMesh.castShadow = true;
    group.add(acMesh);

    // 5. Helipad on selected wide buildings
    if (width > 30 && height < 45) {
      const padGeo = new THREE.CylinderGeometry(width * 0.35, width * 0.35, 0.1, 24);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(x - width * 0.1, topY + 0.05, z + depth * 0.1);
      group.add(padMesh);

      // Yellow Helipad Ring
      const ringGeo = new THREE.TorusGeometry(width * 0.3, 0.3, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(x - width * 0.1, topY + 0.12, z + depth * 0.1);
      group.add(ringMesh);
    }

    // 6. Giant Glowing Rooftop Neon Billboards (GTA 7, DELOREAN, etc.)
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
      },
    };
  }

  private static createNeonBillboard(text: string, glowColor: number): THREE.Group {
    const signGroup = new THREE.Group();

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

    const tex = new THREE.CanvasTexture(canvas);
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
}
