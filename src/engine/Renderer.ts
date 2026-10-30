import * as THREE from 'three';
import { CAMERA_CONFIG } from '../utils/Constants';
import { PostProcessingManager } from './PostProcessing';
import { LightRig } from './LightRig';

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public postProcessing!: PostProcessingManager;
  /** Fixed light pool that prevents runtime shader recompiles (see LightRig). */
  public lightRig!: LightRig;
  private canvas: HTMLCanvasElement;

  private skyMesh: THREE.Mesh | null = null;
  private starfield!: THREE.Points;
  private starfieldMat!: THREE.PointsMaterial;
  private moonMesh!: THREE.Mesh;
  private moonLight!: THREE.PointLight;

  // Dynamic Lighting, Day/Night & Cyber Weather (Phase 11)
  public sunLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;
  public ambientLight!: THREE.AmbientLight;
  // Sun elevation follows sin(timeOfDay * 2π): 0.0 = sunrise horizon, 0.25 = noon (zenith),
  // 0.5 = sunset horizon, 0.75 = midnight.
  public timeOfDay: number = 0.35;
  public timeSpeed: number = 0.006;
  public isTimePaused: boolean = false;
  public currentDimension: 'NORMAL_WORLD' | 'OTHER_WORLD' = 'NORMAL_WORLD';
  private shadowsEnabled: boolean = true;
  /** Currently selected graphics preset (kept in sync with the settings menu). */
  public graphicsQuality: 'low' | 'med' | 'ultra' = 'low';

  // --- Frame-time governor (adaptive resolution) ---
  /** Highest pixel ratio allowed by the selected graphics preset / display. */
  private maxPixelRatio: number = 1;
  /** Pixel ratio currently applied to the canvas. */
  private currentPixelRatio: number = 1;
  private static readonly MIN_PIXEL_RATIO = 0.6;
  private frameTimeEma: number = 1 / 60;
  private slowFrames: number = 0;
  private fastFrames: number = 0;
  private governorCooldown: number = 0;

  // --- Shadow-pass cadence ---
  /** True when the sun currently contributes visible shadows (daytime, shadows enabled). */
  private shadowsActive: boolean = true;
  private wasShadowsActive: boolean = true;
  private shadowFrame: number = 0;

  private static readonly FOG_SUNSET = new THREE.Color(0xfb923c);
  private static readonly FOG_DAY = new THREE.Color(0xb0d5f8);

  public weather: 'clear' | 'rain' | 'thunder' = 'clear';
  private rainParticles!: THREE.Points;
  private rainPositions!: Float32Array;
  private rainSplashParticles!: THREE.Points;
  private rainSplashPositions!: Float32Array;
  private rainSplashMat!: THREE.PointsMaterial;
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
      this.maxPixelRatio = this.currentPixelRatio = Math.min(window.devicePixelRatio, 2);
    }

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;

    this.setupLighting();
    this.setupAtmosphericSky();
    this.initStarfieldAndMoon();
    this.initAtmosphericParticles();
    this.initWeather();
    this.initSpeedStreaks();

    // Constant real-light configuration: all other lights become virtual and are pooled.
    this.lightRig = new LightRig(this.scene, [this.hemiLight, this.sunLight, this.ambientLight]);

    // Cinematic Post-Processing Pipeline (Unreal Bloom & Hyperspace Speed Warp - disabled by default for 100% universal stability)
    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera, false);

    // Procedural image-based lighting: gives metals, glass and water something to reflect.
    this.setupEnvironment();

    // Desktop-class devices get the cinematic bloom pipeline by default; touch devices stay on
    // the cheapest path (the user can still opt in from the settings menu).
    if (typeof window !== 'undefined' && !Renderer.isTouchDevice()) {
      this.postProcessing.setQuality('ultra');
      this.graphicsQuality = 'ultra';
    }

    // Register WebGL Context Lost & Restored handlers (Prevents permanent black screen)
    if (this.canvas && typeof this.canvas.addEventListener === 'function') {
      this.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        // eslint-disable-next-line no-console
        console.warn('WebGL context lost. Recovery initiated...');
      });
      this.canvas.addEventListener('webglcontextrestored', () => {
        // eslint-disable-next-line no-console
        console.info('WebGL context restored successfully.');
        if (typeof window !== 'undefined') {
          this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.onWindowResize());
    }
  }

  private static isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
    );
  }

  /**
   * Build a small synthwave sky (gradient dome + neon light panels), bake it with PMREM and use
   * it as scene.environment. Skipped silently where WebGL/DOM are unavailable (tests, SSR).
   */
  private setupEnvironment(): void {
    if (typeof document === 'undefined') return;
    try {
      const envScene = new THREE.Scene();

      const domeGeo = new THREE.SphereGeometry(50, 32, 16);
      const pos = domeGeo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const zenith = new THREE.Color(0x4f86d9);
      const horizon = new THREE.Color(0xffc9a0);
      const ground = new THREE.Color(0x2a1f45);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const h = pos.getY(i) / 50; // -1 (down) .. 1 (up)
        if (h >= 0) c.copy(horizon).lerp(zenith, Math.pow(h, 0.6));
        else c.copy(horizon).lerp(ground, Math.min(1, -h * 3));
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const dome = new THREE.Mesh(
        domeGeo,
        new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }),
      );
      envScene.add(dome);

      // Bright HDR neon panels so chrome / glass pick up magenta + cyan streaks.
      const panelGeo = new THREE.PlaneGeometry(26, 7);
      const neon = [
        { color: 0xff2a6d, angle: 0.4 },
        { color: 0x05d9e8, angle: 2.1 },
        { color: 0xff9e3d, angle: 3.6 },
        { color: 0xb86bff, angle: 5.1 },
      ];
      for (const n of neon) {
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(n.color).multiplyScalar(6),
          side: THREE.DoubleSide,
        });
        const panel = new THREE.Mesh(panelGeo, mat);
        panel.position.set(Math.cos(n.angle) * 38, 9, Math.sin(n.angle) * 38);
        panel.lookAt(0, 0, 0);
        envScene.add(panel);
      }
      // Warm sun-like hotspot
      const sun = new THREE.Mesh(
        new THREE.CircleGeometry(6, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1d6).multiplyScalar(10) }),
      );
      sun.position.set(30, 30, 20);
      sun.lookAt(0, 0, 0);
      envScene.add(sun);

      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const target = pmrem.fromScene(envScene, 0.02);
      this.scene.environment = target.texture;
      this.scene.environmentIntensity = 0.55;
      pmrem.dispose();
      domeGeo.dispose();
      panelGeo.dispose();
    } catch {
      // Non-fatal: the scene simply renders without image-based lighting.
    }
  }

  private setupLighting(): void {
    // Crisp daylight hemisphere (Sky rich azure, Ground warm asphalt tone)
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3b2f66, 1.0);
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
    this.scene.add(this.sunLight.target);

    // Ambient light fill for clear visibility across all districts
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    // Dynamic lightning point light for thunderstorms
    this.lightningLight = new THREE.PointLight(0xffffff, 0, 450);
    this.lightningLight.visible = false;
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

  private initStarfieldAndMoon(): void {
    // Starfield for deep cyber night sky
    const starCount = 500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 620;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 12; // upper hemisphere
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starfieldMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 1.6,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.starfield = new THREE.Points(starGeo, this.starfieldMat);
    this.starfield.visible = false;
    this.scene.add(this.starfield);

    // Glowing Cyber Moon
    const moonGeo = new THREE.SphereGeometry(18, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.0,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.visible = false;
    this.scene.add(this.moonMesh);

    this.moonLight = new THREE.PointLight(0x38bdf8, 0, 450);
    this.moonLight.visible = false;
    this.scene.add(this.moonLight);
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
    this.dustParticles.visible = false;
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
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);

    // Ground Rain Splashes & Ripples on road pavement
    const splashCount = 200;
    this.rainSplashPositions = new Float32Array(splashCount * 3);
    for (let i = 0; i < splashCount; i++) {
      this.rainSplashPositions[i * 3] = (Math.random() - 0.5) * 60;
      this.rainSplashPositions[i * 3 + 1] = 0.06;
      this.rainSplashPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const splashGeo = new THREE.BufferGeometry();
    splashGeo.setAttribute('position', new THREE.BufferAttribute(this.rainSplashPositions, 3));
    this.rainSplashMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.38,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    this.rainSplashParticles = new THREE.Points(splashGeo, this.rainSplashMat);
    this.rainSplashParticles.visible = false;
    this.scene.add(this.rainSplashParticles);
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
    this.speedStreaks.visible = false;
    this.scene.add(this.speedStreaks);
  }

  public updateAtmosphere(
    dt: number,
    camPos: THREE.Vector3,
    carSpeed: number,
    isBoosting: boolean,
    isHovering: boolean,
  ): void {
    // In OTHER_WORLD (the Moon), space environment is static and should not be overwritten by Earth daytime cycles
    if (this.currentDimension === 'OTHER_WORLD') {
      if (this.skyMesh) this.skyMesh.visible = false;
      if (this.moonLight) this.moonLight.visible = false;
      if (this.lightningLight) this.lightningLight.visible = false;
      if (this.rainParticles) this.rainParticles.visible = false;
      if (this.rainSplashParticles) this.rainSplashParticles.visible = false;
      if (this.dustParticles) this.dustParticles.visible = false;
      if (this.starfieldMat) {
        this.starfieldMat.opacity = 0.95;
        this.starfield.position.copy(camPos);
        this.starfield.visible = true;
      }
      // Keep castShadow constant (toggling it recompiles every lit shader). The Moon has
      // always rendered without sun shadows, so fade them out and skip the shadow pass.
      this.sunLight.castShadow = this.shadowsEnabled;
      this.sunLight.shadow.intensity = 0.0;
      this.shadowsActive = false;

      // Post-Processing & Speed Streaks update
      this.postProcessing.update(dt, 0.0, 'clear', carSpeed, isBoosting);

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
        this.speedStreaks.visible = true;
      } else {
        this.streakMat.opacity = THREE.MathUtils.lerp(this.streakMat.opacity, 0.0, 0.2);
        this.speedStreaks.visible = this.streakMat.opacity > 0.005;
      }
      return;
    }

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
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.35, 0.5, sunRatio);
      this.scene.environmentIntensity = THREE.MathUtils.lerp(0.3, 0.6, sunRatio);
      this.ambientLight.color.setHex(0xffffff);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.lerpColors(Renderer.FOG_SUNSET, Renderer.FOG_DAY, sunRatio);
      }
    } else {
      // Cyber Night Mode: Vibrant neon moonlight & ambient glow - never pitch black!
      this.sunLight.intensity = 0.08;
      this.ambientLight.intensity = 0.45;
      this.scene.environmentIntensity = 0.2;
      this.ambientLight.color.setHex(0x38bdf8);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x0f172a);
      }
    }

    // 2. Cyber Weather System (Volumetric Rain)
    const isRaining = this.weather === 'rain' || this.weather === 'thunder';
    if (this.rainParticles) {
      const rainMat = this.rainParticles.material as THREE.PointsMaterial;
      rainMat.opacity = THREE.MathUtils.lerp(rainMat.opacity, isRaining ? 0.75 : 0.0, 0.15);
      this.rainParticles.visible = rainMat.opacity > 0.005;

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
        this.lightningLight.visible = true;
      } else {
        this.lightningLight.intensity = 0;
        this.lightningLight.visible = false;
      }
    } else if (this.lightningLight) {
      this.lightningLight.intensity = 0;
      this.lightningLight.visible = false;
    }

    // Keep Sky Dome centered on camera
    if (this.skyMesh) {
      this.skyMesh.visible = true;
      this.skyMesh.position.copy(camPos);
    }

    // Position cyber moon opposite of the sun
    const moonAngle = sunAngle + Math.PI;
    const moonX = Math.cos(moonAngle) * 550;
    const moonY = Math.sin(moonAngle) * 550;
    const moonZ = Math.sin(moonAngle * 0.5) * 200;
    if (this.moonMesh) {
      this.moonMesh.position.set(camPos.x + moonX, Math.max(15, moonY), camPos.z + moonZ);
      this.moonLight.position.copy(this.moonMesh.position);
    }

    // Night Sky & Moon Opacity
    const nightFactor = THREE.MathUtils.clamp(-sunY / 150, 0, 1);
    if (this.starfieldMat) {
      this.starfieldMat.opacity = nightFactor * 0.95;
      this.starfield.position.copy(camPos);
      this.starfield.visible = this.starfieldMat.opacity > 0.005;
    }
    if (this.moonMesh) {
      (this.moonMesh.material as THREE.MeshBasicMaterial).opacity = nightFactor * 0.92;
      this.moonMesh.visible = (this.moonMesh.material as THREE.MeshBasicMaterial).opacity > 0.005;
      this.moonLight.intensity = nightFactor * 2.4;
      this.moonLight.visible = nightFactor > 0.05;
    }

    // Rain Ground Splashes on pavement
    if (this.rainSplashParticles) {
      this.rainSplashMat.opacity = THREE.MathUtils.lerp(
        this.rainSplashMat.opacity,
        isRaining ? 0.65 : 0.0,
        0.15,
      );
      this.rainSplashParticles.visible = this.rainSplashMat.opacity > 0.005;
      if (isRaining && this.rainSplashPositions) {
        this.rainSplashParticles.position.x = camPos.x;
        this.rainSplashParticles.position.z = camPos.z;
        for (let i = 0; i < this.rainSplashPositions.length / 3; i++) {
          if (Math.random() < 0.15) {
            this.rainSplashPositions[i * 3] = (Math.random() - 0.5) * 60;
            this.rainSplashPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
          }
        }
        this.rainSplashParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // Sun shadow camera target tracks camera with texel snapping to prevent shadow shimmering
    const shadowSnap = 360 / 2048;
    const snappedX = Math.round(camPos.x / shadowSnap) * shadowSnap;
    const snappedZ = Math.round(camPos.z / shadowSnap) * shadowSnap;
    this.sunLight.target.position.set(snappedX, 0, snappedZ);
    this.sunLight.target.updateMatrixWorld();
    // Fade shadows out at night via a uniform instead of toggling castShadow (which would
    // change the shadow count and recompile every lit shader at every sunrise/sunset).
    this.sunLight.castShadow = this.shadowsEnabled;
    const shadowFade = THREE.MathUtils.clamp((sunY - 2) / 20, 0, 1);
    this.sunLight.shadow.intensity = shadowFade;
    // Skip the shadow-map pass entirely while shadows are fully faded out (night).
    this.shadowsActive = this.shadowsEnabled && shadowFade > 0;

    // Cinematic Post-Processing Update (Dynamic Bloom & Hyperspace Speed Warp)
    this.postProcessing.update(dt, this.timeOfDay, this.weather, carSpeed, isBoosting);

    // Floating Dust Motes drift gently (only in normal world near ground)
    if (this.dustPositions && camPos.length() < 500) {
      for (let i = 0; i < this.dustPositions.length / 3; i++) {
        this.dustPositions[i * 3 + 1] += dt * 0.4;
        if (this.dustPositions[i * 3 + 1] > 55) {
          this.dustPositions[i * 3 + 1] = 1;
        }
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
      this.dustParticles.visible = true;
    } else if (this.dustParticles) {
      this.dustParticles.visible = false;
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
      this.speedStreaks.visible = true;
    } else {
      this.streakMat.opacity = THREE.MathUtils.lerp(this.streakMat.opacity, 0.0, 0.2);
      this.speedStreaks.visible = this.streakMat.opacity > 0.005;
    }
  }

  public setTimeOfDay(time: number): void {
    this.timeOfDay = ((time % 1.0) + 1.0) % 1.0;
  }

  public cycleTimePreset(): string {
    // Values match the sun model above (0.25 = zenith, 0.75 = midnight).
    const presets = [
      { name: '☀️ Tag (High Noon)', time: 0.25 },
      { name: '🌅 Sonnenuntergang (Golden Hour)', time: 0.47 },
      { name: '🌙 Cyber-Nacht (Neon Glow)', time: 0.75 },
      { name: '🌄 Sonnenaufgang (Dawn)', time: 0.03 },
    ];
    let nextIdx = 0;
    for (let i = 0; i < presets.length; i++) {
      const diff = Math.abs(this.timeOfDay - presets[i].time);
      const circularDiff = Math.min(diff, 1 - diff);
      if (circularDiff < 0.1) {
        nextIdx = (i + 1) % presets.length;
        break;
      }
    }
    this.timeOfDay = presets[nextIdx].time;
    return presets[nextIdx].name;
  }

  public setDimension(dim: 'NORMAL_WORLD' | 'OTHER_WORLD'): void {
    this.currentDimension = dim;
    if (this.skyMesh) {
      this.skyMesh.visible = dim === 'NORMAL_WORLD';
    }
    if (dim === 'OTHER_WORLD') {
      this.scene.background = new THREE.Color(0x020208); // Deep space cosmic black
      this.scene.fog = new THREE.FogExp2(0x050510, 0.00012); // Subtle vacuum star dust
      this.hemiLight.color.setHex(0xe2e8f0); // Crisp lunar silver light
      this.hemiLight.groundColor.setHex(0x1e293b); // Basalt regolith shadows
      this.sunLight.color.setHex(0xffffff); // Harsh unfiltered space sunlight
      this.sunLight.intensity = 3.6;
      this.ambientLight.color.setHex(0x38bdf8); // Cool blue Earthshine reflections
      this.ambientLight.intensity = 0.55;
      this.scene.environmentIntensity = 0.25;
      if (this.moonLight) this.moonLight.visible = false;
      if (this.lightningLight) this.lightningLight.visible = false;
    } else {
      this.scene.background = new THREE.Color(0x76b6f0);
      this.scene.fog = new THREE.FogExp2(0xb0d5f8, 0.0022);
      this.hemiLight.color.setHex(0xe0f2fe);
      this.hemiLight.groundColor.setHex(0x3b2f66);
      this.sunLight.color.setHex(0xfffaed);
      this.sunLight.intensity = 2.5;
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.5;
      this.scene.environmentIntensity = 0.55;
    }
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
    if (this.postProcessing) {
      this.postProcessing.setSize(window.innerWidth, window.innerHeight);
    }
  }

  public render(): void {
    // Map virtual gameplay lights onto the fixed proxy pool right before drawing.
    this.lightRig.update(this.camera);
    this.scheduleShadowPass();
    try {
      if (this.postProcessing && this.postProcessing.isEnabled) {
        this.postProcessing.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    } catch {
      // Bulletproof failsafe: Always render direct scene if post-processing fails
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * The city is static and the sun moves very slowly, so the shadow map is refreshed every
   * second frame (30 Hz at 60 fps) instead of every frame, roughly halving the cost of the
   * most expensive pass. It is skipped completely while shadows are faded out (night/Moon).
   */
  private scheduleShadowPass(): void {
    const sm = this.renderer.shadowMap;
    sm.autoUpdate = false;
    if (!this.shadowsActive) {
      this.wasShadowsActive = false;
      return;
    }
    this.shadowFrame++;
    // Refresh immediately when shadows come back (sunrise, leaving the Moon) to avoid a pop.
    if (!this.wasShadowsActive || this.shadowFrame % 2 === 0) {
      sm.needsUpdate = true;
    }
    this.wasShadowsActive = true;
  }

  /**
   * Frame-time governor: if the GPU cannot hold ~50 fps (typical on integrated GPUs and
   * high-DPI screens when hovering high above the city or when daytime shadows kick in),
   * the render resolution is lowered in small steps; it is raised again once there is
   * sustained headroom. The preset's pixel ratio is the ceiling.
   * @param dt raw frame time in seconds
   */
  public adaptResolution(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) return; // ignore tab-switch / stall outliers
    this.frameTimeEma += (dt - this.frameTimeEma) * 0.08;
    if (this.governorCooldown > 0) {
      this.governorCooldown -= dt;
      return;
    }

    if (this.frameTimeEma > 0.021) {
      this.slowFrames++;
      this.fastFrames = 0;
    } else if (this.frameTimeEma < 0.0155) {
      this.fastFrames++;
      this.slowFrames = 0;
    } else {
      this.slowFrames = 0;
      this.fastFrames = 0;
    }

    if (this.slowFrames >= 30 && this.currentPixelRatio > Renderer.MIN_PIXEL_RATIO) {
      this.applyPixelRatio(Math.max(Renderer.MIN_PIXEL_RATIO, this.currentPixelRatio - 0.2));
    } else if (this.fastFrames >= 240 && this.currentPixelRatio < this.maxPixelRatio) {
      this.applyPixelRatio(Math.min(this.maxPixelRatio, this.currentPixelRatio + 0.1));
    }
  }

  private applyPixelRatio(ratio: number): void {
    this.currentPixelRatio = ratio;
    this.slowFrames = 0;
    this.fastFrames = 0;
    this.governorCooldown = 1.0; // let the frame-time average settle after the change
    this.renderer.setPixelRatio(ratio);
    if (this.postProcessing && typeof window !== 'undefined') {
      this.postProcessing.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /** Current internal render scale (for diagnostics). */
  public get renderScale(): number {
    return this.currentPixelRatio;
  }

  /**
   * Compile every shader program the scene can need (including currently hidden interiors and
   * the Moon) up front, so the first visit to an area never stalls the game.
   * Call once after all world content has been built.
   */
  public precompileShaders(): void {
    this.lightRig.virtualizeAll();
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {
      // Non-fatal: shaders will simply compile lazily on first use.
    }
    this.warmPostProcessing();
  }

  /**
   * Post-processing renders the scene into an HDR target, which uses different shader
   * variants than the canvas, plus the bloom/warp passes. Compile them now (the player is in
   * the settings menu) so switching to MED/ULTRA doesn't freeze the first seconds of play.
   */
  private warmPostProcessing(): void {
    const pp = this.postProcessing;
    if (!pp || !pp.isEnabled || !pp.composer || typeof window === 'undefined') return;
    try {
      const warp = pp.warpPass;
      const wasEnabled = warp ? warp.enabled : false;
      if (warp) warp.enabled = true;
      pp.composer.render();
      if (warp) warp.enabled = wasEnabled;
    } catch {
      // Non-fatal: passes will compile lazily.
    }
  }

  public setGraphicsQuality(preset: 'low' | 'med' | 'ultra'): void {
    this.graphicsQuality = preset;
    if (this.postProcessing) {
      this.postProcessing.setQuality(preset);
    }
    if (preset === 'low') {
      this.shadowsEnabled = false;
      this.maxPixelRatio = 0.85;
      this.renderer.shadowMap.enabled = false;
    } else if (preset === 'med') {
      this.shadowsEnabled = true;
      this.maxPixelRatio = 1.0;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
    } else {
      this.shadowsEnabled = true;
      this.maxPixelRatio =
        typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2.0) : 1.5;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.currentPixelRatio = this.maxPixelRatio;
    this.renderer.setPixelRatio(this.maxPixelRatio);
    this.frameTimeEma = 1 / 60;
    this.slowFrames = 0;
    this.fastFrames = 0;
    this.governorCooldown = 0;
    if (this.postProcessing && typeof window !== 'undefined') {
      this.postProcessing.setSize(window.innerWidth, window.innerHeight);
    }
    this.wasShadowsActive = false; // force an immediate shadow refresh
    this.renderer.shadowMap.needsUpdate = true;
    // The shadow configuration changed, so re-warm every program now (while the player is in
    // the settings menu) instead of stalling later when new areas come into view.
    this.sunLight.castShadow = this.shadowsEnabled;
    this.precompileShaders();
  }
}
