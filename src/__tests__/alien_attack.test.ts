import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { AlienSystem } from '../world/AlienSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { Player } from '../character/Player';
import { Car } from '../vehicles/Car';
import { HUD } from '../ui/HUD';
import { WeaponSystem } from '../combat/WeaponSystem';
import { City } from '../city/City';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';

describe('Alien Attack System on the Moon: Xenomorphs, UFOs, Low-Gravity Leaps & Plasma Combat', () => {
  let scene: THREE.Scene;
  let economy: EconomySystem;
  let sound: SoundManager;
  let aliens: AlienSystem;
  let player: Player;
  let car: Car;
  let hud: HUD;

  beforeEach(() => {
    scene = new THREE.Scene();
    economy = new EconomySystem();
    sound = new SoundManager();
    aliens = new AlienSystem(scene, economy, sound);
    player = new Player(2500, 2500);
    player.setPosition(2500, 400.5, 2500);
    car = new Car(2500, 2500, 0);
    car.physics.y = 400.5;

    hud = {
      showNotification: vi.fn(),
      setPrompt: vi.fn(),
      updateMinimap: vi.fn(),
    } as unknown as HUD;
  });

  it('spawns Alien Grunts and Scout UFOs at lunar landmarks', () => {
    expect(aliens.aliens.length).toBeGreaterThanOrEqual(8);

    const grunts = aliens.aliens.filter((a) => a.type === 'GRUNT');
    const ufos = aliens.aliens.filter((a) => a.type === 'UFO');

    expect(grunts.length).toBeGreaterThanOrEqual(5);
    expect(ufos.length).toBeGreaterThanOrEqual(3);

    // Tycho Crater Spawns
    const tychoAlien = aliens.aliens.find((a) => Math.hypot(a.spawnX - 2500, a.spawnZ - 2680) < 60);
    expect(tychoAlien).toBeDefined();

    // Copernicus Crater Spawns
    const copernicusAlien = aliens.aliens.find(
      (a) => Math.hypot(a.spawnX - 2360, a.spawnZ - 2500) < 60,
    );
    expect(copernicusAlien).toBeDefined();

    // Apollo 11 Spawns
    const apolloAlien = aliens.aliens.find(
      (a) => Math.hypot(a.spawnX - 2420, a.spawnZ - 2430) < 50,
    );
    expect(apolloAlien).toBeDefined();

    // Alien Monolith Spawns
    const monolithAlien = aliens.aliens.find(
      (a) => Math.hypot(a.spawnX - 2620, a.spawnZ - 2380) < 50,
    );
    expect(monolithAlien).toBeDefined();
  });

  it('toggles visibility and isolation between Normal World and Moon Dimension', () => {
    aliens.setDimensionVisibility(false);
    expect(aliens.group.visible).toBe(false);

    aliens.setDimensionVisibility(true);
    expect(aliens.group.visible).toBe(true);
  });

  it('triggers aggro, siren alarm, and sound when player approaches an alien', () => {
    const target = aliens.aliens.find((a) => a.type === 'GRUNT')!;
    expect(target.state).toBe('PATROL');

    // Move player within target's aggro distance
    const playerX = target.x + 10;
    const playerZ = target.z + 10;
    aliens.update(0.1, playerX, 400.5, playerZ, 'ON_FOOT', player, car, hud);

    expect(target.state).toBe('CHASE');
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('ALIEN-ALARM'));
  });

  it('performs floaty low-gravity lunar leaps when chasing the player', () => {
    const grunt = aliens.aliens.find((a) => a.type === 'GRUNT')!;
    grunt.x = 2500;
    grunt.z = 2500;
    grunt.y = 400.5;
    grunt.leapCooldown = 0;
    grunt.state = 'CHASE';

    // Player positioned 15m away (ideal leap range)
    aliens.update(0.1, 2515, 400.5, 2500, 'ON_FOOT', player, car, hud);

    // Grunt should have leaped into the lunar sky (vy > 0, state LEAP)
    expect(grunt.vy).toBeGreaterThan(0);
    expect(grunt.isGrounded).toBe(false);

    // Under lunar gravity, it should eventually land back at 400.5
    for (let step = 0; step < 30; step++) {
      aliens.update(0.1, 2515, 400.5, 2500, 'ON_FOOT', player, car, hud);
    }
    expect(grunt.y).toBeCloseTo(400.5, 1);
    expect(grunt.isGrounded).toBe(true);
  });

  it('fires green plasma projectiles that damage the player', () => {
    const initialHealth = player.health;

    // Fire plasma bolt directly at player
    aliens.firePlasmaBolt(2500, 403, 2500, 2500, 401.5, 2500, 15);
    expect(aliens.plasmaBolts.length).toBe(1);

    // Update to process collision
    aliens.update(0.05, 2500, 400.5, 2500, 'ON_FOOT', player, car, hud);

    expect(player.health).toBeLessThan(initialHealth);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('ALIEN-PLASMA'));
  });

  it('allows player weapons to damage and eliminate aliens with cash bounty rewards', () => {
    const target = aliens.aliens[0];
    const initialCash = economy.cash;
    const initialHP = target.health;

    // Weapon shot hits alien
    const hit = aliens.takeWeaponDamage(target.x, target.y, target.z, 25, 2.0);
    expect(hit).toBe(true);
    expect(target.health).toBe(initialHP - 25);

    // Lethal shot
    aliens.takeWeaponDamage(target.x, target.y, target.z, target.health + 50, 2.0);
    expect(target.isAlive).toBe(false);
    expect(target.group.visible).toBe(false);

    // Bounty reward credited
    expect(economy.cash).toBeGreaterThan(initialCash);
  });

  it('splatters and damages aliens when rammed by DeLorean at speed', () => {
    const grunt = aliens.aliens.find((a) => a.type === 'GRUNT' && a.isAlive)!;
    const startHP = grunt.health;

    // Fast car ramming
    const hit = aliens.checkCarRamming(grunt.x, grunt.y, grunt.z, 28);
    expect(hit).toBe(true);
    expect(grunt.health).toBeLessThan(startHP);

    // Slow car (< 4 m/s) does not ram
    const slowHit = aliens.checkCarRamming(grunt.x, grunt.y, grunt.z, 2.0);
    expect(slowHit).toBe(false);
  });

  it('integrates with WeaponSystem for melee, bullets, and rocket AoE damage', () => {
    const city = new City();
    const traffic = new TrafficSystem(scene);
    const police = new PoliceSystem(scene, city);
    const pedestrians = new PedestrianSystem(scene);
    const weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians);
    weapons.setAlienSystem(aliens);

    const alien = aliens.aliens[1];
    const startHP = alien.health;

    // Rocket AoE explosion near alien
    weapons.createExplosion(alien.x, alien.y, alien.z, 6.0);
    expect(alien.health).toBeLessThan(startHP);
  });

  it('provides live alien coordinates for the lunar radar minimap', () => {
    const blips = aliens.getLivingAlienBlips();
    expect(blips.length).toBe(aliens.aliens.filter((a) => a.isAlive).length);

    // Kill one alien
    aliens.aliens[0].isAlive = false;
    const updatedBlips = aliens.getLivingAlienBlips();
    expect(updatedBlips.length).toBe(blips.length - 1);
  });

  it('plays alien screech, plasma shot, and death audio safely', () => {
    expect(() => sound.playAlienScreech()).not.toThrow();
    expect(() => sound.playPlasmaShot()).not.toThrow();
    expect(() => sound.playAlienDeath()).not.toThrow();
  });
});
