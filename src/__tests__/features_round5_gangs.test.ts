import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GangSystem } from '../gangs/GangSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';

describe('Round 5: Gang Turf Wars & Wanted Bounty Convoy', () => {
  let scene: THREE.Scene;
  let economy: EconomySystem;
  let sound: SoundManager;
  let gangs: GangSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    economy = new EconomySystem();
    sound = new SoundManager();
    gangs = new GangSystem(scene, economy, sound);
  });

  it('initializes 2 gang territories with distinctive themes and coordinates', () => {
    expect(gangs.territories.length).toBe(2);
    const viperTurf = gangs.territories.find((t) => t.id === 'vipers')!;
    const syndicateTurf = gangs.territories.find((t) => t.id === 'syndicate')!;

    expect(viperTurf.name).toContain('Cyber Vipers');
    expect(syndicateTurf.name).toContain('Neon Syndicate');
    expect(viperTurf.radius).toBeGreaterThan(50);
  });

  it('spawns gang patrol cars and heavy armored bounty boss', () => {
    expect(gangs.gangCars.length).toBe(4); // 2 per territory
    expect(gangs.bountyBoss).not.toBeNull();
    expect(gangs.bountyBoss?.health).toBe(300);
    expect(gangs.bountyBoss?.isDestroyed).toBe(false);
  });

  it('detects territory presence and updates district telemetry', () => {
    const viperTurf = gangs.territories.find((t) => t.id === 'vipers')!;
    gangs.update(0.1, viperTurf.x, viperTurf.z, true);

    // Moves gang cars and navigates boss along outer boulevard (Z axis)
    const initialBossZ = gangs.bountyBoss!.z;
    gangs.update(0.5, 0, 0, true);
    expect(gangs.bountyBoss!.z).not.toBe(initialBossZ);
  });

  it('damages gang cruisers, activates hostility, and awards cash on destruction', () => {
    const targetCar = gangs.gangCars[0];
    const initialCash = economy.cash;
    expect(targetCar.isHostile).toBe(false);

    // Partial damage activates hostility
    const hit = gangs.takeWeaponDamage(targetCar.x, targetCar.z, 40, 2.0);
    expect(hit).toBe(true);
    expect(targetCar.health).toBe(80);
    expect(targetCar.isHostile).toBe(true);

    // Fatal damage destroys cruiser and awards $350 bounty cash
    gangs.takeWeaponDamage(targetCar.x, targetCar.z, 100, 2.0);
    expect(targetCar.health).toBeLessThanOrEqual(0);
    expect(economy.cash).toBe(initialCash + 350);
  });

  it('damages Bounty Boss Convoy and awards $5000 prize upon destruction', () => {
    const boss = gangs.bountyBoss!;
    const initialCash = economy.cash;

    // Partial damage
    const hit = gangs.takeWeaponDamage(boss.x, boss.z, 100, 2.0);
    expect(hit).toBe(true);
    expect(boss.health).toBe(200);
    expect(boss.isDestroyed).toBe(false);

    // Fatal blow
    gangs.takeWeaponDamage(boss.x, boss.z, 250, 2.0);
    expect(boss.health).toBeLessThanOrEqual(0);
    expect(boss.isDestroyed).toBe(true);
    expect(economy.cash).toBe(initialCash + 5000);
  });

  it('supports high-speed car ramming against the Bounty Boss', () => {
    const boss = gangs.bountyBoss!;
    const initialHealth = boss.health;

    const rammed = gangs.checkPlayerCarRamming(boss.x, boss.z, 30.0);
    expect(rammed).toBe(true);
    expect(boss.health).toBeLessThan(initialHealth);
  });
});
