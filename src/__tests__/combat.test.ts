import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WeaponSystem } from '../combat/WeaponSystem';
import { SoundManager } from '../audio/SoundManager';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { City } from '../city/City';
import { WEAPON_CATALOG } from '../utils/Constants';

describe('Combat & WeaponSystem in GTA 7', () => {
  it('should fire pistol bullets and create projectiles in 3D scene', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const sound = new SoundManager();
    const traffic = new TrafficSystem(scene);
    const police = new PoliceSystem(scene, city);
    const pedestrians = new PedestrianSystem(scene);

    const weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians);
    const pistol = { ...WEAPON_CATALOG[2], ammo: 10 };

    const fired = weapons.fire(pistol, 0, 1.2, 0, 0);
    expect(fired).toBe(true);
    expect(pistol.ammo).toBe(9);
    expect(weapons.projectiles.length).toBe(1);

    const p = weapons.projectiles[0];
    expect(p.isRocket).toBe(false);
    expect(p.vz).toBeGreaterThan(0);
  });

  it('should fire RPG rocket and create explosion upon impact', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const sound = new SoundManager();
    const traffic = new TrafficSystem(scene);
    const police = new PoliceSystem(scene, city);
    const pedestrians = new PedestrianSystem(scene);

    const weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians);
    const rpg = { ...WEAPON_CATALOG[3], ammo: 5 };

    weapons.fire(rpg, 0, 1.2, 0, 0);
    expect(weapons.projectiles.length).toBe(1);
    expect(weapons.projectiles[0].isRocket).toBe(true);

    // Rocket travels for 2.9 seconds (life is 3.0)
    weapons.update(2.9);
    expect(weapons.projectiles.length).toBe(1);

    // Rocket runs out of life and explodes
    weapons.update(0.2);
    expect(weapons.projectiles.length).toBe(0);
    expect(weapons.explosions.length).toBe(1);
  });

  it('should perform melee attack with baseball bat', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const sound = new SoundManager();
    const traffic = new TrafficSystem(scene);
    const police = new PoliceSystem(scene, city);
    const pedestrians = new PedestrianSystem(scene);

    const weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians);
    const bat = { ...WEAPON_CATALOG[1] };

    const attacked = weapons.fire(bat, 0, 1.2, 0, 0);
    expect(attacked).toBe(true);
    // Melee creates no airborne projectiles
    expect(weapons.projectiles.length).toBe(0);
  });
});
