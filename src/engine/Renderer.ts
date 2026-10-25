import * as THREE from 'three';
import { CAMERA_CONFIG } from '../utils/Constants';

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    // Night/Sunset neon mood
    this.scene.background = new THREE.Color(0x0a0f1d);
    this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.007);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.FOV,
      window.innerWidth / window.innerHeight,
      CAMERA_CONFIG.NEAR,
      CAMERA_CONFIG.FAR,
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.setupLighting();
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupLighting(): void {
    // Ambient moonlight / city ambient
    const ambientLight = new THREE.AmbientLight(0x2d3a5a, 1.2);
    this.scene.add(ambientLight);

    // Moonlight / Directional light with shadows
    const dirLight = new THREE.DirectionalLight(0xa5c4f5, 1.8);
    dirLight.position.set(60, 100, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.camera.top = 120;
    dirLight.shadow.camera.bottom = -120;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Warm city glow hemisphere light
    const hemiLight = new THREE.HemisphereLight(0x406090, 0x101520, 0.8);
    this.scene.add(hemiLight);
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
