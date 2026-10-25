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

    // Vibrant daytime California / Vice City sky
    this.scene.background = new THREE.Color(0x76b6f0);
    // Subtle atmospheric distance haze
    this.scene.fog = new THREE.FogExp2(0xb6d7f8, 0.0025);

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
    this.renderer.toneMappingExposure = 1.25;

    this.setupLighting();
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupLighting(): void {
    // Crisp daylight hemisphere (Sky bright blue, Ground subtle asphalt tone)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x475569, 1.4);
    this.scene.add(hemiLight);

    // Warm Sun Directional Light with deep shadows
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.4);
    sunLight.position.set(100, 160, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -160;
    sunLight.shadow.camera.right = 160;
    sunLight.shadow.camera.top = 160;
    sunLight.shadow.camera.bottom = -160;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    // Ambient light fill for clear visibility in all alleyways
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);
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
