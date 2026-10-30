import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface PostProcessingConfig {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  enabled: boolean;
}

const SpeedWarpShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAberration: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAberration;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      if (uAberration <= 0.0005) {
        gl_FragColor = texture2D(tDiffuse, uv);
        return;
      }
      vec2 dir = uv - vec2(0.5);
      float distSq = dot(dir, dir);
      float offset = distSq * uAberration;

      float r = texture2D(tDiffuse, uv - dir * offset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + dir * offset).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export class PostProcessingManager {
  public composer: EffectComposer | null = null;
  public renderPass: RenderPass | null = null;
  public bloomPass: UnrealBloomPass | null = null;
  public warpPass: ShaderPass | null = null;
  public outputPass: OutputPass | null = null;

  public isEnabled: boolean = true;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Base bloom configuration
  public baseBloomStrength: number = 0.65;
  public currentBloomStrength: number = 0.65;
  public baseBloomRadius: number = 0.42;
  public baseBloomThreshold: number = 0.76;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    enabled: boolean = true,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.isEnabled = enabled;

    this.initComposer();
  }

  private initComposer(): void {
    if (
      typeof window === 'undefined' ||
      !this.renderer ||
      typeof this.renderer.getPixelRatio !== 'function' ||
      typeof this.renderer.getSize !== 'function'
    ) {
      this.composer = null;
      return;
    }

    try {
      const width = Math.min(window.innerWidth || 800, 1920);
      const height = Math.min(window.innerHeight || 600, 1080);

      // High-precision HDR render target for vibrant specular bloom without color banding
      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      });

      this.composer = new EffectComposer(this.renderer, renderTarget);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(width, height);

      // 1. Scene Render Pass
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(this.renderPass);

      // 2. Cinematic Unreal Bloom Pass
      // Resolves specular glows on car body, neon signs, headlights, and wet roads
      const bloomRes = new THREE.Vector2(Math.round(width * 0.5), Math.round(height * 0.5));
      this.bloomPass = new UnrealBloomPass(
        bloomRes,
        this.baseBloomStrength,
        this.baseBloomRadius,
        this.baseBloomThreshold,
      );
      this.composer.addPass(this.bloomPass);

      // 3. Radial Speed Warp & Chromatic Aberration Pass
      this.warpPass = new ShaderPass(SpeedWarpShader);
      this.warpPass.uniforms.uAberration.value = 0.0;
      this.warpPass.enabled = false;
      this.composer.addPass(this.warpPass);

      // 4. Tone Mapping & Color Space Output Pass
      this.outputPass = new OutputPass();
      this.composer.addPass(this.outputPass);
    } catch {
      // Graceful fallback if WebGL extensions are unsupported
      this.composer = null;
      this.isEnabled = false;
    }
  }

  public setQuality(quality: 'low' | 'med' | 'ultra'): void {
    if (quality === 'low') {
      this.isEnabled = false;
    } else if (quality === 'med') {
      this.isEnabled = true;
      this.baseBloomStrength = 0.45;
      if (this.bloomPass) {
        this.bloomPass.strength = 0.45;
        this.bloomPass.radius = 0.35;
        this.bloomPass.threshold = 0.82;
      }
    } else {
      this.isEnabled = true;
      this.baseBloomStrength = 0.72;
      if (this.bloomPass) {
        this.bloomPass.strength = 0.72;
        this.bloomPass.radius = 0.48;
        this.bloomPass.threshold = 0.74;
      }
    }
  }

  public update(
    _dt: number,
    timeOfDay: number,
    weather: 'clear' | 'rain' | 'thunder',
    carSpeed: number,
    isBoosting: boolean,
  ): void {
    if (!this.isEnabled) return;

    // 1. Dynamic Bloom Adaptation (Deeper neon glow at night and in rain)
    const isNight = timeOfDay < 0.22 || timeOfDay > 0.82;
    const isWet = weather === 'rain' || weather === 'thunder';

    let targetBloom = this.baseBloomStrength;
    if (isNight) targetBloom *= 1.35; // Night neon intensification
    if (isWet) targetBloom *= 1.25; // Rain specular reflections intensification
    if (isBoosting) targetBloom *= 1.4; // Nitro flame brilliance

    this.currentBloomStrength = THREE.MathUtils.lerp(this.currentBloomStrength, targetBloom, 0.1);
    if (this.bloomPass) {
      this.bloomPass.strength = this.currentBloomStrength;
    }

    if (!this.warpPass) return;

    // 2. Hyperspace Speed Chromatic Aberration
    const absSpeed = Math.abs(carSpeed);
    let targetAberration = 0.0;
    if (isBoosting) {
      targetAberration = 0.024;
    } else if (absSpeed > 32.0) {
      targetAberration = Math.min(0.016, (absSpeed - 32.0) * 0.001);
    }

    const currentAberr = (this.warpPass.uniforms.uAberration.value as number) || 0.0;
    const aberr = THREE.MathUtils.lerp(currentAberr, targetAberration, 0.15);
    this.warpPass.uniforms.uAberration.value = aberr;
    this.warpPass.enabled = aberr > 0.0005;
  }

  public setSize(width: number, height: number): void {
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(width, height);
      if (this.bloomPass) {
        this.bloomPass.resolution.set(Math.round(width * 0.5), Math.round(height * 0.5));
      }
    }
  }

  public render(): void {
    if (this.isEnabled && this.composer) {
      try {
        this.composer.render();
      } catch {
        // Safe fallback: if composer throws or fails, render directly via WebGLRenderer
        this.isEnabled = false;
        this.renderer.render(this.scene, this.camera);
      }
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
