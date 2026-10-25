import * as THREE from 'three';
import { CAMERA_CONFIG } from '../utils/Constants';

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  private skyMesh: THREE.Mesh | null = null;

  // Dynamic Lighting, Day/Night & Cyber Weather (Phase 11)
  public sunLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;
  public ambientLight!: THREE.AmbientLight;
  public timeOfDay: number = 0.35; // 0.0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
  public timeSpeed: number = 0.006;
  public isTimePaused: boolean = false;

  public weather: 'clear' | 'rain' | 'thunder' = 'clear';
  private rainParticles!: THREE.Points;
  private rainPositions!: Float32Array;
  private lightningLight!: THREE.PointLight;
  private lightningTimer: number = 4.0;
  private lightningFlashTime: number = 0;

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
    this.initWeather();
    this.initSpeedStreaks();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.onWindowResize());
    }
  }

  private setupLighting(): void {
    // Crisp daylight hemisphere (Sky rich azure, Ground warm asphalt tone)
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.45);
    this.scene.add(this.hemiLight);

    // Warm Golden Sun Directional Light with deep soft shadows
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.5);
    this.sunLight.position.set(120, 180, 90);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 450;
    this.sunLight.shadow.camera.left = -180;
    this.sunLight.shadow.camera.right = 180;
    this.sunLight.shadow.camera.top = 180;
    this.sunLight.shadow.camera.bottom = -180;
    this.sunLight.shadow.bias = -0.0002;
    this.scene.add(this.sunLight);

    // Ambient light fill for clear visibility across all districts
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    // Dynamic lightning point light for thunderstorms
    this.lightningLight = new THREE.PointLight(0xffffff, 0, 450);
    this.scene.add(this.lightningLight);
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

  private initWeather(): void {
    const count = 1200;
    this.rainPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 160;
      this.rainPositions[i * 3 + 1] = Math.random() * 45;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xa5f3fc,
      size: 0.28,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    this.rainParticles = new THREE.Points(geo, mat);
    this.scene.add(this.rainParticles);
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
    // 1. Dynamic Day / Night Cycle
    if (!this.isTimePaused) {
      this.timeOfDay = (this.timeOfDay + this.timeSpeed * dt) % 1.0;
    }

    const sunAngle = this.timeOfDay * Math.PI * 2;
    const sunX = Math.cos(sunAngle) * 220;
    const sunY = Math.sin(sunAngle) * 220;
    const sunZ = Math.sin(sunAngle * 0.5) * 110;
    this.sunLight.position.set(sunX, Math.max(0, sunY), sunZ);

    if (sunY > 0) {
      // Daytime to Sunset
      const sunRatio = sunY / 220;
      this.sunLight.intensity = THREE.MathUtils.clamp(sunRatio * 2.8, 0.25, 2.5);
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.55, 0.85, sunRatio);
      this.ambientLight.color.setHex(0xffffff);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.lerpColors(
          new THREE.Color(0xfb923c),
          new THREE.Color(0xb0d5f8),
          sunRatio,
        );
      }
    } else {
      // Cyber Night Mode
      this.sunLight.intensity = 0.05;
      this.ambientLight.intensity = 0.42;
      this.ambientLight.color.setHex(0x1e293b);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x090d16);
      }
    }

    // 2. Cyber Weather System (Volumetric Rain)
    const isRaining = this.weather === 'rain' || this.weather === 'thunder';
    if (this.rainParticles) {
      const rainMat = this.rainParticles.material as THREE.PointsMaterial;
      rainMat.opacity = THREE.MathUtils.lerp(rainMat.opacity, isRaining ? 0.75 : 0.0, 0.15);

      if (isRaining && this.rainPositions) {
        this.rainParticles.position.x = camPos.x;
        this.rainParticles.position.z = camPos.z;

        for (let i = 0; i < this.rainPositions.length / 3; i++) {
          this.rainPositions[i * 3 + 1] -= dt * 50.0;
          if (this.rainPositions[i * 3 + 1] < 0) {
            this.rainPositions[i * 3 + 1] = 45.0;
          }
        }
        this.rainParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 3. Lightning Flash in Thunderstorms
    if (this.weather === 'thunder' && this.lightningLight) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 4.5 + Math.random() * 5.0;
        this.lightningFlashTime = 0.22;
        this.lightningLight.position.set(
          camPos.x + (Math.random() - 0.5) * 80,
          65,
          camPos.z + (Math.random() - 0.5) * 80,
        );
      }

      if (this.lightningFlashTime > 0) {
        this.lightningFlashTime -= dt;
        this.lightningLight.intensity = Math.random() > 0.35 ? 14 : 2;
      } else {
        this.lightningLight.intensity = 0;
      }
    } else if (this.lightningLight) {
      this.lightningLight.intensity = 0;
    }

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

  public setTimeOfDay(time: number): void {
    this.timeOfDay = ((time % 1.0) + 1.0) % 1.0;
  }

  public cycleTimePreset(): string {
    const presets = [
      { name: '☀️ Tag (High Noon)', time: 0.5 },
      { name: '🌅 Sonnenuntergang (Golden Hour)', time: 0.78 },
      { name: '🌙 Cyber-Nacht (Neon Glow)', time: 0.0 },
      { name: '🌄 Sonnenaufgang (Dawn)', time: 0.25 },
    ];
    let nextIdx = 0;
    for (let i = 0; i < presets.length; i++) {
      if (Math.abs(this.timeOfDay - presets[i].time) < 0.12) {
        nextIdx = (i + 1) % presets.length;
        break;
      }
    }
    this.timeOfDay = presets[nextIdx].time;
    return presets[nextIdx].name;
  }

  public setWeather(mode: 'clear' | 'rain' | 'thunder'): void {
    this.weather = mode;
  }

  public cycleWeather(): string {
    if (this.weather === 'clear') {
      this.weather = 'rain';
      return '🌧️ Cyber-Regen';
    } else if (this.weather === 'rain') {
      this.weather = 'thunder';
      return '⚡ Gewitter & Blitze';
    } else {
      this.weather = 'clear';
      return '☀️ Klarer Himmel';
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
