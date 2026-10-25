import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Tank } from '../vehicles/Tank';
import { MilitarySystem } from '../military/MilitarySystem';
import { CasinoSystem } from '../casino/CasinoSystem';
import { HeistSystem } from '../heists/HeistSystem';
import { Boat } from '../vehicles/Boat';
import { WaterSystem } from '../water/WaterSystem';
import { TrainSystem } from '../trains/TrainSystem';
import { StorySystem } from '../story/StorySystem';
import { StuntEditor } from '../editor/StuntEditor';
import { GameCamera } from '../engine/Camera';
import { EconomySystem } from '../economy/EconomySystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { SoundManager } from '../audio/SoundManager';
import { Player } from '../character/Player';
import { City } from '../city/City';
import { CarPhysics } from '../vehicles/CarPhysics';
import { Input } from '../engine/Input';

describe('Roadmap Master Expansion (Phases 13 to 20)', () => {
  let scene: THREE.Scene;
  let sound: SoundManager;
  let economy: EconomySystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    sound = new SoundManager();
    economy = new EconomySystem();
  });

  describe('Phase 13: Area 77 Military Base & Rhino Tank & Jetpack', () => {
    it('Rhino Tank initializes with heavy armor, tracks and rotating turret', () => {
      const tank = new Tank(150, 150, 0);
      expect(tank.health).toBe(800);
      expect(tank.isDestroyed).toBe(false);

      // Tank driving forward
      tank.update(0.1, {
        throttle: true,
        reverse: false,
        steerLeft: false,
        steerRight: false,
        fire: false,
      });
      expect(tank.speed).toBeGreaterThan(0);

      // Tank takes heavy armor mitigated damage
      tank.takeDamage(100);
      expect(tank.health).toBe(760); // 40% penetration (60% absorption)

      // Aim and fire 120mm smoothbore cannon
      const muzzle = tank.getCannonMuzzlePosition();
      expect(muzzle).toBeDefined();
      expect(muzzle.y).toBeGreaterThan(1.0);

      const fireRes = tank.update(0.1, {
        throttle: false,
        reverse: false,
        steerLeft: false,
        steerRight: false,
        fire: true,
      });
      expect(fireRes.firedCannon).toBe(true);
      expect(tank.cannonCooldown).toBeGreaterThan(0);
    });

    it('Area 77 Military Base detects perimeter penetration and triggers alarm', () => {
      const military = new MilitarySystem(scene);
      expect(military.parkedTank).toBeDefined();

      // Outside base
      const resOutside = military.update(0.1, 0, 0);
      expect(resOutside.triggerArea77Alarm).toBe(false);

      // Inside base coordinates (x: 150, z: 150)
      const resInside = military.update(0.1, 150, 150);
      expect(resInside.triggerArea77Alarm).toBe(true);
    });

    it('Player Jetpack consumes fuel in flight and recharges on ground', () => {
      const player = new Player(0, 0);
      expect(player.hasJetpack).toBe(false);

      player.toggleJetpack();
      expect(player.hasJetpack).toBe(true);

      // Jetpack ascent with jump
      player.update(
        0.1,
        {
          forward: false,
          backward: false,
          left: false,
          right: false,
          sprint: false,
          jump: true,
          actionInteract: false,
        } as unknown as Input,
        new City(),
      );

      expect(player.isJetpacking).toBe(true);
      expect(player.jetpackFuel).toBeLessThan(100);
      expect(player.y).toBeGreaterThan(0);

      // Release jump: falls back to ground and recharges
      player.update(
        1.5,
        {
          forward: false,
          backward: false,
          left: false,
          right: false,
          sprint: false,
          jump: false,
          actionInteract: false,
        } as unknown as Input,
        new City(),
      );

      expect(player.y).toBe(0);
      expect(player.isJetpacking).toBe(false);
    });
  });

  describe('Phase 14: Diamond Cyber Casino', () => {
    it('Slots spin deducts bet and awards payouts on winning lines', () => {
      const casino = new CasinoSystem(scene, economy, sound);
      economy.addCash(1000);

      const result = casino.spinSlots(50);
      expect(result.reels).toHaveLength(3);
      expect(typeof result.payout).toBe('number');
      expect(result.message).toBeDefined();

      // Insufficient cash check
      economy.spendCash(economy.cash);
      const brokeResult = casino.spinSlots(500);
      expect(brokeResult.payout).toBe(0);
      expect(brokeResult.reels[0]).toBe('❌');
    });

    it('Daily Lucky Wheel grants prize cash and marks wheel as spun', () => {
      const casino = new CasinoSystem(scene, economy, sound);
      expect(casino.hasSpunDailyWheel).toBe(false);

      const initialCash = economy.cash;
      const prize = casino.spinLuckyWheel();
      expect(prize.cash).toBeGreaterThanOrEqual(500);
      expect(economy.cash).toBe(initialCash + prize.cash);
      expect(casino.hasSpunDailyWheel).toBe(true);
    });
  });

  describe('Phase 15: The Big Score Bank Heist', () => {
    it('Executes full bank heist from setup to vault detonation and escape', () => {
      const city = new City();
      const police = new PoliceSystem(scene, city);
      const heist = new HeistSystem(scene, economy, police, sound);

      expect(heist.stage).toBe('IDLE');

      // Start heist
      expect(heist.startHeist()).toBe(true);
      expect(heist.stage).toBe('SETUP');

      // Setup complete -> Hacking
      heist.completeSetup();
      expect(heist.stage).toBe('HACKING');

      // Hack complete -> Vault breach C4 timer
      heist.completeHack();
      expect(heist.stage).toBe('VAULT_BREACH');
      expect(heist.c4Timer).toBeGreaterThan(0);

      // C4 detonate
      heist.update(5.0, heist.bankX, heist.bankZ, false);
      expect(heist.stage).toBe('LOOTING');

      // Loot the 4 money bags
      for (let i = 0; i < 4; i++) {
        heist.update(0.1, heist.bankX, heist.bankZ, false);
      }

      expect(heist.stage).toBe('ESCAPE');
      expect(police.wantedLevel).toBe(5); // 5-Star Police chase!

      // Evade police (wanted level reaches 0) -> Heist success
      police.setWantedLevel(0);
      const initialCash = economy.cash;
      heist.update(0.1, 0, 0, false);
      expect(heist.stage).toBe('COMPLETED');
      expect(economy.cash).toBe(initialCash + 25000);
    });
  });

  describe('Phase 16: Harbor Ocean Bay & Boats', () => {
    it('Speedboat and Jet-Ski steer and displace water with buoyancy', () => {
      const speedboat = new Boat(-165, 20, false);
      const jetSki = new Boat(-165, -20, true);

      expect(speedboat.isJetSki).toBe(false);
      expect(jetSki.isJetSki).toBe(true);

      // Throttle boat
      speedboat.update(
        0.2,
        {
          throttle: true,
          reverse: false,
          steerLeft: false,
          steerRight: true,
        },
        1.0,
      );

      expect(speedboat.speed).toBeGreaterThan(0);
      expect(speedboat.heading).toBeLessThan(0);
      expect(speedboat.y).toBeGreaterThan(0);
    });

    it('WaterSystem manages ocean mesh and collectable smuggling crates', () => {
      const water = new WaterSystem(scene, economy, sound);
      expect(water.waterMesh).toBeDefined();
      expect(water.crates.length).toBe(3);

      const firstCrate = water.crates[0];
      const initialCash = economy.cash;

      // Move player into crate
      water.update(0.1, firstCrate.x, firstCrate.z);
      expect(firstCrate.isCollected).toBe(true);
      expect(economy.cash).toBe(initialCash + firstCrate.value);
    });
  });

  describe('Phase 17: Autonomous Ring Subway & Unstoppable Freight Train', () => {
    it('Subway moves along the perimeter ring track and freight train cruises east-west', () => {
      const trains = new TrainSystem(scene, sound);
      const initialFreightX = trains.freightTrainGroup.position.x;

      trains.update(0.5);

      expect(trains.subwayProgress).toBeGreaterThan(0);
      expect(trains.freightTrainGroup.position.x).not.toBe(initialFreightX);

      // Colliding with freight train shunts vehicle with massive inertia
      const collision = trains.checkFreightTrainCollision(
        trains.freightTrainGroup.position.x,
        trains.freightTrainGroup.position.z,
      );
      expect(collision.hit).toBe(true);
      expect(collision.pushX).toBeGreaterThan(0);
    });
  });

  describe('Phase 18: Story Campaign', () => {
    it('Tracks 5 narrative story chapters and awards chapter completion bonuses', () => {
      const story = new StorySystem(economy, sound);
      expect(story.chapters.length).toBe(5);

      const ch1 = story.getCurrentChapter();
      expect(ch1.id).toBe(1);
      expect(ch1.isCompleted).toBe(false);

      const initialCash = economy.cash;
      const advanced = story.advanceChapter();
      expect(advanced).toBe(true);
      expect(ch1.isCompleted).toBe(true);
      expect(economy.cash).toBe(initialCash + ch1.reward);
      expect(story.currentChapterIndex).toBe(1);
    });
  });

  describe('Phase 19: Sandbox Stunt Editor', () => {
    it('Places props, interacts with car physics and exports/imports JSON', () => {
      const editor = new StuntEditor(scene, sound);
      expect(editor.isBuildMode).toBe(false);

      editor.toggleBuildMode();
      expect(editor.isBuildMode).toBe(true);

      // Place high-speed boost pad
      const prop = editor.placeProp('boost_pad', 10, 20);
      expect(editor.placedProps.length).toBe(1);
      expect(prop.type).toBe('boost_pad');

      // Car drives over boost pad
      const carPhysics = new CarPhysics();
      carPhysics.speed = 10;
      editor.checkCarInteraction(10, 20, carPhysics);
      expect(carPhysics.speed).toBeGreaterThanOrEqual(68.0); // Shoots car to 245 km/h!
      expect(carPhysics.isBoosting).toBe(true);

      // Track JSON export and re-import
      const json = editor.exportTrackJSON();
      expect(json).toContain('boost_pad');

      editor.clearAllProps();
      expect(editor.placedProps.length).toBe(0);

      const imported = editor.importTrackJSON(json);
      expect(imported).toBe(true);
      expect(editor.placedProps.length).toBe(1);
    });
  });

  describe('Phase 20: First-Person Cockpit View', () => {
    it('Configures driver cockpit offset and wider field of view', () => {
      const threeCamera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
      const cam = new GameCamera(threeCamera);

      expect(cam.mode).toBe('CHASE');
      cam.cycleMode(); // CLOSE
      cam.cycleMode(); // COCKPIT
      expect(cam.mode).toBe('COCKPIT');

      const carPos = new THREE.Vector3(10, 0, 10);
      cam.updateVehicle(carPos, 0, 20, 0.05);
      cam.updateVehicle(carPos, 0, 20, 0.05);

      // Camera position moves near driver headrest inside cabin and widens FOV
      expect(threeCamera.position.y).toBeGreaterThan(1.0);
      expect(threeCamera.fov).toBeGreaterThan(65);
    });
  });
});
