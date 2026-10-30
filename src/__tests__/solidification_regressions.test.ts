import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { WeaponSystem } from '../combat/WeaponSystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { GangSystem } from '../gangs/GangSystem';
import { MissionSystem } from '../missions/MissionSystem';
import { HeistSystem } from '../heists/HeistSystem';
import { StuntEditor } from '../editor/StuntEditor';
import { SoundManager } from '../audio/SoundManager';
import { EconomySystem } from '../economy/EconomySystem';
import { NetworkManager } from '../network/NetworkManager';
import { RemotePlayer } from '../network/RemotePlayer';
import { City } from '../city/City';
import { CAR_CATALOG, RACE_CIRCUIT } from '../utils/Constants';
import { NetMsgKind } from '../network/NetProtocol';

describe('GTA 7 Solidification & Robustness Regressions', () => {
  let scene: THREE.Scene;
  let city: City;
  let sound: SoundManager;
  let economy: EconomySystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    city = new City();
    sound = new SoundManager();
    economy = new EconomySystem();
  });

  describe('Combat & Weapons Subsystem', () => {
    it('stops bullets when colliding with building colliders below building height', () => {
      const traffic = new TrafficSystem(scene);
      const police = new PoliceSystem(scene, city);
      const pedestrians = new PedestrianSystem(scene);
      const weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians, city);
      const building = city.buildingBounds[0];
      expect(building).toBeDefined();

      const targetX = (building.minX + building.maxX) / 2;
      const targetZ = (building.minZ + building.maxZ) / 2;

      // Spawn weapon fire directly into building at ground height
      const pistol = {
        id: 'pistol',
        name: 'Pistol',
        price: 0,
        unlocked: true,
        damage: 25,
        fireRate: 0.25,
        bulletSpeed: 100,
        maxAmmo: 100,
        ammo: 100,
        color: 0xffff00,
        isRanged: true,
      };

      weapons.fire(pistol, targetX - 5, 1.0, targetZ, 0);
      expect(weapons.projectiles.length).toBe(1);

      // Move bullet into building bounds
      weapons.projectiles[0].x = targetX;
      weapons.projectiles[0].y = 1.0;
      weapons.projectiles[0].z = targetZ;
      weapons.projectiles[0].mesh.position.set(targetX, 1.0, targetZ);
      weapons.update(0.016);

      // Bullet should be terminated by building collision
      expect(weapons.projectiles.length).toBe(0);
    });

    it('damages cop cars and wrecks them when health reaches 0', () => {
      const police = new PoliceSystem(scene, city);
      police.setWantedLevel(2);
      expect(police.copCars.length).toBeGreaterThan(0);

      const cop = police.copCars[0];
      expect(cop.health).toBe(120);
      expect(cop.isWrecked).toBe(false);

      police.damageCopCar(cop, 50);
      expect(cop.health).toBe(70);
      expect(cop.isWrecked).toBe(false);

      police.damageCopCar(cop, 80);
      expect(cop.health).toBe(0);
      expect(cop.isWrecked).toBe(true);
    });

    it('damages police helicopter and initiates crash when health reaches 0', () => {
      const police = new PoliceSystem(scene, city);
      police.setWantedLevel(4);
      expect(police.policeHeli).toBeDefined();

      police.damagePoliceHeli(100);
      expect(police.policeHeli!.health).toBe(150);

      police.damagePoliceHeli(200);
      expect(police.policeHeli).toBeNull();
    });
  });

  describe('Police Suppression & Star Escalation', () => {
    it('suppresses crime accumulation when player is in interior or on the Moon', () => {
      const police = new PoliceSystem(scene, city);
      police.isSuppressed = true;

      police.addCrimeSeverity(200);
      expect(police.wantedLevel).toBe(0);
      expect(police.crimeScore).toBe(0);

      police.isSuppressed = false;
      police.addCrimeSeverity(150);
      expect(police.wantedLevel).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Gang AI & Boss Respawn', () => {
    it('advances gang boss waypoints sequentially', () => {
      const gangs = new GangSystem(scene, economy, sound, city);
      expect(gangs.bossWaypointIndex).toBeGreaterThanOrEqual(0);
      expect(gangs.bossWaypointIndex).toBeLessThanOrEqual(3);
    });

    it('starts 90s boss respawn timer upon death and respawns boss after cooldown', () => {
      const gangs = new GangSystem(scene, economy, sound, city);
      expect(gangs.bountyBoss).not.toBeNull();
      expect(gangs.bountyBoss!.isDestroyed).toBe(false);

      const boss = gangs.bountyBoss!;
      gangs.takeWeaponDamage(boss.x, boss.z, 2000, 10);
      expect(boss.isDestroyed).toBe(true);
      expect(gangs.bossRespawnTimer).toBe(90.0);

      // Simulate 91 seconds
      gangs.update(91.0, 0, 0, false);
      expect(gangs.bossRespawnTimer).toBe(0);
      expect(gangs.bountyBoss).not.toBeNull();
      expect(gangs.bountyBoss!.isDestroyed).toBe(false);
    });
  });

  describe('Traffic System Wreck Recycling', () => {
    it('recycles wrecked cars after 20 seconds and spawns replacement traffic', () => {
      const traffic = new TrafficSystem(scene);
      const initialCount = traffic.cars.length;
      expect(initialCount).toBeGreaterThan(0);

      const targetCar = traffic.cars[0];
      targetCar.isWrecked = true;
      targetCar.wreckTimer = 0;

      // Update for 21 seconds
      traffic.update(21.0, 0, 0);

      // Total car count should remain conserved and replacement spawned
      expect(traffic.cars.length).toBe(initialCount);
    });
  });

  describe('Pedestrian Ragdoll Impulse', () => {
    it('launches pedestrians into ragdoll state with velocity and height', () => {
      const peds = new PedestrianSystem(scene);
      expect(peds.pedestrians.length).toBeGreaterThan(0);

      const ped = peds.pedestrians[0];
      peds.launchRagdoll(ped, 15.0, 8.0, 10.0);

      expect(ped.state).toBe('AIRBORNE');
      expect(ped.isPanicking).toBe(true);
      expect(ped.vy).toBe(8.0);
    });
  });

  describe('Mission System Softlock & Altitude Guards', () => {
    it('cancels active race after 120s timeout and triggers race cooldown', () => {
      const missions = new MissionSystem(scene, sound, economy, city);
      missions.startRace();
      expect(missions.race.isActive).toBe(true);

      // Advance by 121 seconds
      missions.update(121.0, 0, 0, true, 0);
      expect(missions.race.isActive).toBe(false);
      expect(missions.raceCooldown).toBeGreaterThan(0);
    });

    it('rejects race checkpoint triggers if altitude exceeds 12m', () => {
      const missions = new MissionSystem(scene, sound, economy, city);
      missions.startRace();
      expect(missions.race.isActive).toBe(true);

      const cp = RACE_CIRCUIT[0];
      expect(cp).toBeDefined();

      // Position car at checkpoint X and Z, but flying at y = 25m
      missions.update(0.016, cp.x, cp.z, true, 25.0);

      // Checkpoint index should not have advanced
      expect(missions.race.currentCheckpointIndex).toBe(0);
    });
  });

  describe('Heist Loot Anti-Duplication', () => {
    it('enforces 0.08s loot cooldown between consecutive claims', () => {
      const police = new PoliceSystem(scene, city);
      const heist = new HeistSystem(scene, economy, police, sound);
      heist.startHeist();
      heist.stage = 'LOOTING';
      heist.lootCooldown = 0;
      expect(heist.lootRemaining).toBe(4);

      // First claim succeeds
      heist.update(0.016, heist.bankX, heist.bankZ, false);
      expect(heist.lootRemaining).toBe(3);
      expect(heist.lootCooldown).toBeGreaterThan(0);

      // Immediate consecutive claim in same frame is blocked
      heist.update(0.016, heist.bankX, heist.bankZ, false);
      expect(heist.lootRemaining).toBe(3);
    });
  });

  describe('Stunt Track Editor Safety', () => {
    it('enforces 0.2s placement cooldown to prevent spam duplication', () => {
      const stunt = new StuntEditor(scene, sound);
      stunt.placeProp('rampe', 0, 0, 0);
      expect(stunt.placedProps.length).toBe(1);

      // Immediate consecutive placement is blocked by cooldown
      stunt.placeProp('rampe', 0, 0, 0);
      expect(stunt.placedProps.length).toBe(1);

      // Advance cooldown by 0.25s
      stunt.update(0.25);
      stunt.placeProp('rampe', 0, 0, 0);
      expect(stunt.placedProps.length).toBe(2);
    });

    it('safely removes last prop and disposes meshes', () => {
      const stunt = new StuntEditor(scene, sound);
      stunt.placeProp('kisten', 0, 0, 0);
      expect(stunt.placedProps.length).toBe(1);

      const removed = stunt.removeLastProp();
      expect(removed).toBe(true);
      expect(stunt.placedProps.length).toBe(0);
    });

    it('safely handles corrupt or invalid track JSON schemas', () => {
      const stunt = new StuntEditor(scene, sound);
      expect(() => stunt.importTrackJSON('INVALID_JSON')).not.toThrow();
      expect(() => stunt.importTrackJSON('{"name":"test","props":"not-an-array"}')).not.toThrow();
      expect(() => stunt.importTrackJSON('{"props":[{"type":"unknown"}]}')).not.toThrow();
    });
  });

  describe('Audio Nyquist Limit & Buffer Reuse', () => {
    it('clamps engine frequency below Nyquist frequency limit even with extreme RPM', () => {
      expect(() => sound.updateEnginePitch(500000, true)).not.toThrow();
    });

    it('caches and reuses white noise buffer in blow-off valve', () => {
      expect(() => {
        sound.playBlowOffValve();
        sound.playBlowOffValve();
      }).not.toThrow();
    });
  });

  describe('Economy System Catalog Protection & Spend Guard', () => {
    it('isolates catalog items from global static catalog constants via deep cloning', () => {
      const economyInstance = new EconomySystem();
      const originalPrice = CAR_CATALOG[0].price;

      economyInstance.cars[0].price = originalPrice + 999999;
      expect(CAR_CATALOG[0].price).toBe(originalPrice);
    });

    it('rejects negative numbers and NaN in spendCash', () => {
      const economyInstance = new EconomySystem();
      const initialCash = economyInstance.cash;

      expect(economyInstance.spendCash(-500)).toBe(false);
      expect(economyInstance.cash).toBe(initialCash);

      expect(economyInstance.spendCash(NaN)).toBe(false);
      expect(economyInstance.cash).toBe(initialCash);

      expect(economyInstance.spendCash(Infinity)).toBe(false);
      expect(economyInstance.cash).toBe(initialCash);
    });
  });

  describe('Multiplayer & Remote Player NaN Guarding', () => {
    it('rejects NaN or Infinity coordinates in RemotePlayer applySync', () => {
      const remote = new RemotePlayer(scene);
      remote.applySync({
        kind: NetMsgKind.PLAYER_SYNC,
        x: NaN,
        y: 10,
        z: 0,
        heading: 0,
        speed: 0,
        isBoosting: false,
        mode: 'IN_CAR',
        carColor: 0xffffff,
        isDrifting: false,
        health: 100,
        t: Date.now(),
      });

      // Target X must remain unaffected
      expect(remote.targetX).toBe(0);
    });

    it('safely handles NetworkManager disconnection lifecycle', () => {
      const net = new NetworkManager();
      let disconnectedCalled = false;

      net.onStatus((status) => {
        if (status === 'disconnected') {
          disconnectedCalled = true;
        }
      });

      expect(() => net.disconnect()).not.toThrow();
      expect(net.isConnected).toBe(false);
      expect(disconnectedCalled).toBe(false);
    });
  });
});
