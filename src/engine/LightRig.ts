import * as THREE from 'three';

/**
 * Fixed-size dynamic light rig.
 *
 * WHY: three.js bakes the number of point / spot / hemisphere lights (and shadow casters)
 * into every lit shader program. Whenever that count changes at runtime — toggling
 * headlights, a lightning flash, a police car spawning with siren lights, entering an
 * interior, warping to the Moon — every lit material recompiles, freezing the game for
 * 0.3–1.4 s per new light combination.
 *
 * HOW: Gameplay code keeps creating and toggling its own `PointLight` / `SpotLight` /
 * `HemisphereLight` objects exactly as before (those act as *virtual* lights). The rig moves
 * them onto a layer the camera never renders, so three.js ignores them. Each frame, the rig
 * picks the most relevant visible virtual lights near the camera and copies their parameters
 * into a constant pool of real proxy lights. The real light count therefore never changes,
 * so after the initial warm-up no shader ever recompiles.
 */
export class LightRig {
  /** Layer used to hide virtual lights from the renderer's light collection. */
  public static readonly VIRTUAL_LAYER = 31;
  public static readonly POINT_SLOTS = 6;
  public static readonly SPOT_SLOTS = 4;

  private readonly scene: THREE.Scene;
  private readonly coreLights: Set<THREE.Object3D>;
  private readonly pointProxies: THREE.PointLight[] = [];
  private readonly spotProxies: THREE.SpotLight[] = [];
  private readonly hemiProxy: THREE.HemisphereLight;
  private readonly proxySet = new Set<THREE.Object3D>();

  // Reused per-frame scratch storage (no allocations in the hot path)
  private readonly activePoints: THREE.PointLight[] = [];
  private readonly activeSpots: THREE.SpotLight[] = [];
  private readonly activeHemis: THREE.HemisphereLight[] = [];
  private readonly scores = new Map<THREE.Light, number>();
  private readonly tmpPos = new THREE.Vector3();
  private readonly camPos = new THREE.Vector3();
  private readonly collect = (obj: THREE.Object3D): void => this.collectLight(obj);
  private readonly byScoreDesc = (a: THREE.Light, b: THREE.Light): number =>
    (this.scores.get(b) ?? 0) - (this.scores.get(a) ?? 0);

  /**
   * @param scene Scene to manage.
   * @param coreLights Lights that are always present and must stay real (sun, sky hemisphere,
   *   ambient). They are never virtualized.
   */
  constructor(scene: THREE.Scene, coreLights: THREE.Object3D[]) {
    this.scene = scene;
    this.coreLights = new Set(coreLights);

    for (let i = 0; i < LightRig.POINT_SLOTS; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 1);
      this.pointProxies.push(p);
    }
    for (let i = 0; i < LightRig.SPOT_SLOTS; i++) {
      const s = new THREE.SpotLight(0xffffff, 0, 1);
      this.spotProxies.push(s);
      this.scene.add(s.target);
      this.proxySet.add(s.target);
    }
    this.hemiProxy = new THREE.HemisphereLight(0xffffff, 0xffffff, 0);

    for (const l of [...this.pointProxies, ...this.spotProxies, this.hemiProxy]) {
      l.castShadow = false;
      l.userData.lightRigProxy = true;
      this.proxySet.add(l);
      this.scene.add(l);
    }

    this.virtualizeAll();
  }

  /** Hide every existing non-core light from the renderer (including invisible subtrees). */
  public virtualizeAll(): void {
    this.scene.traverse((obj) => {
      const light = obj as THREE.Light;
      if (light.isLight) this.virtualize(light);
    });
  }

  private virtualize(light: THREE.Light): void {
    if (this.proxySet.has(light) || this.coreLights.has(light)) return;
    if ((light as THREE.AmbientLight).isAmbientLight) return; // ambient never affects programs
    if (light.layers.mask !== 1 << LightRig.VIRTUAL_LAYER) {
      light.layers.set(LightRig.VIRTUAL_LAYER);
      // Virtual lights are never rendered, so they must never allocate a shadow map either.
      light.castShadow = false;
    }
  }

  private collectLight(obj: THREE.Object3D): void {
    const light = obj as THREE.Light;
    if (!light.isLight || this.proxySet.has(light) || this.coreLights.has(light)) return;
    if ((light as THREE.AmbientLight).isAmbientLight) return;

    // Newly spawned lights get virtualized before the renderer ever sees them.
    this.virtualize(light);
    if (light.intensity <= 0) return;

    if ((light as THREE.PointLight).isPointLight) {
      this.activePoints.push(light as THREE.PointLight);
    } else if ((light as THREE.SpotLight).isSpotLight) {
      this.activeSpots.push(light as THREE.SpotLight);
    } else if ((light as THREE.HemisphereLight).isHemisphereLight) {
      this.activeHemis.push(light as THREE.HemisphereLight);
    }
  }

  private score(light: THREE.PointLight | THREE.SpotLight): number {
    light.getWorldPosition(this.tmpPos);
    const d = this.tmpPos.distanceTo(this.camPos);
    const range = light.distance > 0 ? light.distance : 60;
    const r = d / range;
    return light.intensity / (1 + r * r);
  }

  /**
   * Assign the most relevant visible virtual lights to the fixed proxy pool.
   * Must run after all gameplay updates and immediately before rendering.
   */
  public update(camera: THREE.Camera): void {
    this.activePoints.length = 0;
    this.activeSpots.length = 0;
    this.activeHemis.length = 0;
    this.scores.clear();
    camera.getWorldPosition(this.camPos);

    this.scene.traverseVisible(this.collect);

    // --- Point lights ---
    if (this.activePoints.length > LightRig.POINT_SLOTS) {
      for (const l of this.activePoints) this.scores.set(l, this.score(l));
      this.activePoints.sort(this.byScoreDesc);
    }
    for (let i = 0; i < LightRig.POINT_SLOTS; i++) {
      const proxy = this.pointProxies[i];
      const src = this.activePoints[i];
      if (!src) {
        proxy.intensity = 0;
        continue;
      }
      src.updateWorldMatrix(true, false);
      proxy.position.setFromMatrixPosition(src.matrixWorld);
      proxy.color.copy(src.color);
      proxy.intensity = src.intensity;
      proxy.distance = src.distance;
      proxy.decay = src.decay;
    }

    // --- Spot lights ---
    if (this.activeSpots.length > LightRig.SPOT_SLOTS) {
      this.scores.clear();
      for (const l of this.activeSpots) this.scores.set(l, this.score(l));
      this.activeSpots.sort(this.byScoreDesc);
    }
    for (let i = 0; i < LightRig.SPOT_SLOTS; i++) {
      const proxy = this.spotProxies[i];
      const src = this.activeSpots[i];
      if (!src) {
        proxy.intensity = 0;
        continue;
      }
      src.updateWorldMatrix(true, false);
      src.target.updateWorldMatrix(true, false);
      proxy.position.setFromMatrixPosition(src.matrixWorld);
      proxy.target.position.setFromMatrixPosition(src.target.matrixWorld);
      proxy.target.updateMatrixWorld();
      proxy.color.copy(src.color);
      proxy.intensity = src.intensity;
      proxy.distance = src.distance;
      proxy.decay = src.decay;
      proxy.angle = src.angle;
      proxy.penumbra = src.penumbra;
    }

    // --- Extra hemisphere light (e.g. interior fill) ---
    let bestHemi: THREE.HemisphereLight | null = null;
    for (const h of this.activeHemis) {
      if (!bestHemi || h.intensity > bestHemi.intensity) bestHemi = h;
    }
    if (bestHemi) {
      this.hemiProxy.color.copy(bestHemi.color);
      this.hemiProxy.groundColor.copy(bestHemi.groundColor);
      this.hemiProxy.intensity = bestHemi.intensity;
    } else {
      this.hemiProxy.intensity = 0;
    }
  }
}
