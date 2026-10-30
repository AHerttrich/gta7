import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { LightRig } from '../engine/LightRig';
import { batchStaticMeshes } from '../utils/StaticBatcher';
import { City } from '../city/City';
import { CITY_CONFIG } from '../utils/Constants';

/** Lights the WebGL renderer would actually upload (what determines shader programs). */
function countRealLights(scene: THREE.Scene, camera: THREE.Camera): Record<string, number> {
  const counts: Record<string, number> = { point: 0, spot: 0, hemi: 0, dir: 0 };
  scene.traverseVisible((o) => {
    const l = o as THREE.Light;
    if (!l.isLight || !l.layers.test(camera.layers)) return;
    if ((l as THREE.PointLight).isPointLight) counts.point++;
    else if ((l as THREE.SpotLight).isSpotLight) counts.spot++;
    else if ((l as THREE.HemisphereLight).isHemisphereLight) counts.hemi++;
    else if ((l as THREE.DirectionalLight).isDirectionalLight) counts.dir++;
  });
  return counts;
}

function proxies<T extends THREE.Light>(
  scene: THREE.Scene,
  check: (l: THREE.Light) => boolean,
): T[] {
  const out: T[] = [];
  scene.traverse((o) => {
    const l = o as THREE.Light;
    if (l.isLight && l.userData.lightRigProxy && check(l)) out.push(l as T);
  });
  return out;
}

describe('LightRig — constant real light configuration (no runtime shader recompiles)', () => {
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let rig: LightRig;
  let sun: THREE.DirectionalLight;

  beforeEach(() => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    sun = new THREE.DirectionalLight();
    const hemi = new THREE.HemisphereLight();
    scene.add(sun, hemi, camera);
    rig = new LightRig(scene, [sun, hemi]);
  });

  it('keeps the renderer-visible light counts identical while gameplay lights come and go', () => {
    rig.update(camera);
    const baseline = countRealLights(scene, camera);
    expect(baseline.point).toBe(LightRig.POINT_SLOTS);
    expect(baseline.spot).toBe(LightRig.SPOT_SLOTS);

    // Spawn a police car with siren lights
    const cop = new THREE.Group();
    cop.add(new THREE.PointLight(0xff0000, 3, 20), new THREE.PointLight(0x0000ff, 3, 20));
    scene.add(cop);
    rig.update(camera);
    expect(countRealLights(scene, camera)).toEqual(baseline);

    // Headlights (spot) toggled on/off
    const headlight = new THREE.SpotLight(0xffffff, 2.8, 50);
    scene.add(headlight, headlight.target);
    rig.update(camera);
    expect(countRealLights(scene, camera)).toEqual(baseline);
    headlight.visible = false;
    rig.update(camera);
    expect(countRealLights(scene, camera)).toEqual(baseline);

    // Interior fill hemisphere light toggled, explosion light added and removed
    const interiorHemi = new THREE.HemisphereLight(0xffffff, 0xdbeafe, 1.8);
    scene.add(interiorHemi);
    const explosion = new THREE.PointLight(0xff7700, 8, 30);
    scene.add(explosion);
    rig.update(camera);
    expect(countRealLights(scene, camera)).toEqual(baseline);
    scene.remove(explosion, cop);
    rig.update(camera);
    expect(countRealLights(scene, camera)).toEqual(baseline);
  });

  it('never virtualizes core lights and moves gameplay lights off the render layer', () => {
    const siren = new THREE.PointLight(0xff0000, 3, 20);
    siren.castShadow = true;
    scene.add(siren);
    rig.update(camera);
    expect(siren.layers.test(camera.layers)).toBe(false);
    expect(siren.castShadow).toBe(false);
    expect(sun.layers.test(camera.layers)).toBe(true);
  });

  it('feeds the nearest active point lights into the proxy pool and ignores hidden ones', () => {
    const lights: THREE.PointLight[] = [];
    for (let i = 0; i < 10; i++) {
      const l = new THREE.PointLight(0xffffff, 5, 30);
      l.position.set(i * 20, 0, 0); // increasing distance from camera at origin
      lights.push(l);
      scene.add(l);
    }
    const hiddenRoom = new THREE.Group();
    hiddenRoom.visible = false;
    const hiddenLight = new THREE.PointLight(0xff00ff, 50, 30);
    hiddenRoom.add(hiddenLight);
    scene.add(hiddenRoom);

    scene.updateMatrixWorld(true);
    rig.update(camera);

    const pointProxies = proxies<THREE.PointLight>(
      scene,
      (l) => !!(l as THREE.PointLight).isPointLight,
    );
    const proxiedX = pointProxies.filter((p) => p.intensity > 0).map((p) => p.position.x);
    expect(proxiedX.sort((a, b) => a - b)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(pointProxies.some((p) => p.color.getHex() === 0xff00ff)).toBe(false);
  });

  it('copies spot light direction (target) and hemisphere fill into the proxies', () => {
    const spot = new THREE.SpotLight(0xfffaed, 4.5, 90, Math.PI / 5, 0.35);
    spot.position.set(0, 10, 0);
    spot.target.position.set(5, 0, 5);
    scene.add(spot, spot.target);
    const interiorHemi = new THREE.HemisphereLight(0x123456, 0x654321, 1.8);
    scene.add(interiorHemi);

    scene.updateMatrixWorld(true);
    rig.update(camera);

    const spotProxy = proxies<THREE.SpotLight>(
      scene,
      (l) => !!(l as THREE.SpotLight).isSpotLight,
    ).find((p) => p.intensity > 0)!;
    expect(spotProxy.position.y).toBeCloseTo(10);
    expect(spotProxy.target.position.x).toBeCloseTo(5);
    expect(spotProxy.angle).toBeCloseTo(Math.PI / 5);

    const hemiProxy = proxies<THREE.HemisphereLight>(
      scene,
      (l) => !!(l as THREE.HemisphereLight).isHemisphereLight,
    )[0];
    expect(hemiProxy.intensity).toBeCloseTo(1.8);
    expect(hemiProxy.color.getHex()).toBe(0x123456);

    interiorHemi.visible = false;
    rig.update(camera);
    expect(hemiProxy.intensity).toBe(0);
  });
});

describe('StaticBatcher — lossless draw-call reduction for static scenery', () => {
  const box = (): THREE.BoxGeometry => new THREE.BoxGeometry(1, 1, 1);
  const mat = (
    color: number,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, ...extra });

  it('merges meshes with equivalent (but separate) materials in the same cell, preserving bounds', () => {
    const root = new THREE.Group();
    const a = new THREE.Mesh(box(), mat(0xff0000));
    a.position.set(1, 0, 1);
    const b = new THREE.Mesh(box(), mat(0xff0000));
    b.position.set(4, 2, 3);
    b.rotation.y = 0.5;
    root.add(a, b);
    const before = new THREE.Box3().setFromObject(root);

    const res = batchStaticMeshes(root, { cellSize: 100 });

    expect(res.batches).toBe(1);
    let meshes = 0;
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBe(1);
    const after = new THREE.Box3().setFromObject(root);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-4);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-4);
  });

  it('keeps different materials, transparent, hidden, excluded and far-apart meshes separate', () => {
    const root = new THREE.Group();
    const red1 = new THREE.Mesh(box(), mat(0xff0000));
    const blue = new THREE.Mesh(box(), mat(0x0000ff));
    const glass1 = new THREE.Mesh(box(), mat(0x00ffff, { transparent: true, opacity: 0.5 }));
    const glass2 = new THREE.Mesh(box(), mat(0x00ffff, { transparent: true, opacity: 0.5 }));
    const hidden = new THREE.Mesh(box(), mat(0xff0000));
    hidden.visible = false;
    const excluded = new THREE.Mesh(box(), mat(0xff0000));
    const farRed = new THREE.Mesh(box(), mat(0xff0000));
    farRed.position.set(500, 0, 500);
    root.add(red1, blue, glass1, glass2, hidden, excluded, farRed);

    const res = batchStaticMeshes(root, { cellSize: 100, exclude: (m) => m === excluded });

    expect(res.batches).toBe(0);
    for (const m of [red1, blue, glass1, glass2, hidden, excluded, farRed]) {
      expect(m.parent).toBe(root);
    }
  });

  it('batches the real city without changing its footprint or collision behaviour', () => {
    const city = new City();
    const boundsBefore = new THREE.Box3().setFromObject(city.group);
    const probes = [
      [44, 44],
      [0, 0],
      [-88, 162],
      [120, -60],
    ];
    const collisionsBefore = probes.map(([x, z]) => city.checkCollision(x, z, 1.0, 1.0).collided);

    const res = batchStaticMeshes(city.group, {
      cellSize: (CITY_CONFIG.BLOCK_SIZE + CITY_CONFIG.ROAD_WIDTH) * 2,
      exclude: (m) => m.material === city.groundMat,
    });

    expect(res.meshesAfter).toBeLessThan(res.meshesBefore * 0.5);
    const boundsAfter = new THREE.Box3().setFromObject(city.group);
    expect(boundsAfter.min.distanceTo(boundsBefore.min)).toBeLessThan(0.01);
    expect(boundsAfter.max.distanceTo(boundsBefore.max)).toBeLessThan(0.01);
    expect(probes.map(([x, z]) => city.checkCollision(x, z, 1.0, 1.0).collided)).toEqual(
      collisionsBefore,
    );

    // Weather still mutates the live ground material
    let groundStillUsed = false;
    city.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).material === city.groundMat) {
        groundStillUsed = true;
      }
    });
    expect(groundStillUsed).toBe(true);
  });
});
