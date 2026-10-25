import * as THREE from 'three';
import { CAMERA_CONFIG } from '../utils/Constants';

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  private skyMesh: THREE.Mesh | null = null;

  // Atmospheric cyber dust motes
  private dustParticles!: THREE.Points;
  private dustPositions!: Float32Array;

  // High speed motion warp streaks
  private speedStreaks!: THREE.LineSegments;
  private speedStreakPositions!: Float32Array;
  private streakMat!: THREE.LineBasicMaterial;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    // Base background fallback
    this.scene.background = new THREE.Color(0x76b6f0);
    // Atmospheric distance haze
    this.scene.fog = new THREE.FogExp2(0xb0d5f8, 0.0022);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.FOV,
      typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.77,
      CAMERA_CONFIG.NEAR,
      CAMERA_CONFIG.FAR,
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });

    if (typeof window !== 'undefined') {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;

    this.setupLighting();
    this.setupAtmosphericSky();
    this.initAtmosphericParticles();
    this.initSpeedStreaks();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.onWindowResize());
    }
  }

  private setupLighting(): void {
    // Crisp daylight hemisphere (Sky rich azure, Ground warm asphalt tone)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.45);
    this.scene.add(hemiLight);

    // Warm Golden Sun Directional Light with deep soft shadows
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.5);
    sunLight.position.set(120, 180, 90);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 450;
    sunLight.shadow.camera.left = -180;
    sunLight.shadow.camera.right = 180;
    sunLight.shadow.camera.top = 180;
    sunLight.shadow.camera.bottom = -180;
    sunLight.shadow.bias = -0.0002;
    this.scene.add(sunLight);

    // Ambient light fill for clear visibility across all districts
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);
  }

  private setupAtmosphericSky(): void {
    if (typeof document === 'undefined') return;

    // Atmospheric Sky Dome with rich vertical gradient
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#0a1d37'); // Zenith deep space azure
    grad.addColorStop(0.35, '#0284c7'); // Mid sky vibrant azure
    grad.addColorStop(0.68, '#38bdf8'); // Sky blue
    grad.addColorStop(0.85, '#fde047'); // Warm California golden horizon
    grad.addColorStop(0.94, '#fb923c'); // Soft sunset peach glow
    grad.addColorStop(1.0, '#94a3b8'); // Horizon haze

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    const skyTex = new THREE.CanvasTexture(canvas);
    const skyGeo = new THREE.SphereGeometry(650, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);
  }

  private initAtmosphericParticles(): void {
    const count = 250;
    this.dustPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.dustPositions[i * 3] = (Math.random() - 0.5) * 300;
      this.dustPositions[i * 3 + 1] = Math.random() * 45 + 1;
      this.dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xfffaed,
      size: 0.55,
      transparent: true,
      opacity: 0.45,
    });

    this.dustParticles = new THREE.Points(geo, mat);
    this.scene.add(this.dustParticles);
  }

  private initSpeedStreaks(): void {
    const count = 40;
    this.speedStreakPositions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * 14;
      const ry = (Math.random() - 0.5) * 8 + 2;
      const rz = (Math.random() - 0.5) * 20;

      // Start point
      this.speedStreakPositions[i * 6] = rx;
      this.speedStreakPositions[i * 6 + 1] = ry;
      this.speedStreakPositions[i * 6 + 2] = rz;

      // End point (streak line segment)
      this.speedStreakPositions[i * 6 + 3] = rx;
      this.speedStreakPositions[i * 6 + 4] = ry;
      this.speedStreakPositions[i * 6 + 5] = rz - 3.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.speedStreakPositions, 3));

    this.streakMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.0,
    });

    this.speedStreaks = new THREE.LineSegments(geo, this.streakMat);
    this.scene.add(this.speedStreaks);
  }

  public updateAtmosphere(
    dt: number,
    camPos: THREE.Vector3,
    carSpeed: number,
    isBoosting: boolean,
    isHovering: boolean,
  ): void {
    // Keep Sky Dome centered on camera
    if (this.skyMesh) {
      this.skyMesh.position.copy(camPos);
    }

    // Floating Dust Motes drift gently
    if (this.dustPositions) {
      for (let i = 0; i < this.dustPositions.length / 3; i++) {
        this.dustPositions[i * 3 + 1] += dt * 0.4;
        if (this.dustPositions[i * 3 + 1] > 55) {
          this.dustPositions[i * 3 + 1] = 1;
        }
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }

    // High Speed Hyperspace Warp Streaks
    const absSpeed = Math.abs(carSpeed);
    const showStreaks = isBoosting || (isHovering && absSpeed > 18) || absSpeed > 28;

    if (showStreaks) {
      this.streakMat.opacity = THREE.MathUtils.lerp(
        this.streakMat.opacity,
        isBoosting ? 0.75 : 0.45,
        0.15,
      );
      this.speedStreaks.position.copy(camPos);
      this.speedStreaks.rotation.copy(this.camera.rotation);

      // Animate streaks rushing backwards
      const p = this.speedStreakPositions;
      for (let i = 0; i < p.length / 6; i++) {
        p[i * 6 + 2] -= dt * (isBoosting ? 60 : 35);
        p[i * 6 + 5] -= dt * (isBoosting ? 60 : 35);

        if (p[i * 6 + 2] < -18) {
          p[i * 6 + 2] = 12;
          p[i * 6 + 5] = 8.5;
        }
      }
      this.speedStreaks.geometry.attributes.position.needsUpdate = true;
    } else {
      this.streakMat.opacity = THREE.MathUtils.lerp(this.streakMat.opacity, 0.0, 0.2);
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
