import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { InteriorSystem } from '../interiors/InteriorSystem';
import { Player } from '../character/Player';
import { GameCamera } from '../engine/Camera';
import { HUD } from '../ui/HUD';
import { SoundManager } from '../audio/SoundManager';
import { WeaponSystem } from '../combat/WeaponSystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { City } from '../city/City';
import { Input } from '../engine/Input';
import { Car } from '../vehicles/Car';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';

describe('Enterable Buildings & 3D Interior System', () => {
  function createSystemTestSetup(): {
    scene: THREE.Scene;
    city: City;
    camera: GameCamera;
    player: Player;
    economy: EconomySystem;
    sound: SoundManager;
    hud: HUD;
    police: PoliceSystem;
    weapons: WeaponSystem;
    input: Input;
    interiors: InteriorSystem;
  } {
    const scene = new THREE.Scene();
    const city = new City();
    const cameraPerspective = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
    const camera = new GameCamera(cameraPerspective);
    const player = new Player(0, 0);
    const economy = new EconomySystem();
    const sound = new SoundManager();
    const hud = {
      showNotification: vi.fn(),
      setPrompt: vi.fn(),
      updateVehicleStats: vi.fn(),
    } as unknown as HUD;
    const police = new PoliceSystem(scene, city);
    const traffic = new TrafficSystem(scene);
    const pedestrians = new PedestrianSystem(scene);
    const weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians);
    const input = new Input();
    const interiors = new InteriorSystem(scene);

    return {
      scene,
      city,
      camera,
      player,
      economy,
      sound,
      hud,
      police,
      weapons,
      input,
      interiors,
    };
  }

  it('should register enterable buildings with distinct exterior coordinates and interior realms', () => {
    const { interiors } = createSystemTestSetup();

    expect(interiors.doors.length).toBeGreaterThanOrEqual(5);

    const ids = interiors.doors.map((d) => d.id);
    expect(ids).toContain('penthouse');
    expect(ids).toContain('gun_store');
    expect(ids).toContain('nightclub');
    expect(ids).toContain('hacker_loft');
    expect(ids).toContain('city_bank');

    const penthouse = interiors.doors.find((d) => d.id === 'penthouse')!;
    expect(penthouse.exteriorX).toBe(-88);
    expect(penthouse.exteriorZ).toBe(-56);
    expect(penthouse.interiorSpawn.x).toBe(4000);
    expect(penthouse.interiorSpawn.y).toBe(100.0);

    const bank = interiors.doors.find((d) => d.id === 'city_bank')!;
    expect(bank.exteriorX).toBe(0);
    expect(bank.exteriorZ).toBe(56);
    expect(bank.interiorSpawn.x).toBe(4400);
  });

  it('should ensure City physics and collision bypass interior coordinates (x >= 3800, z >= 3800)', () => {
    const { city } = createSystemTestSetup();

    // 1. Floor elevation check
    const floorH = city.getRoofHeightAt(4000, 4000);
    expect(floorH).toBe(100.0);

    // 2. City bounds check does not clamp interior realm
    const resolved = city.resolveBuildingIntersection(4000, 4000, 0.5, 100);
    expect(resolved.x).toBe(4000);
    expect(resolved.z).toBe(4000);

    // 3. Collision check does not falsely report building collision in interior
    const col = city.checkCollision(4000, 4000, 0.5, 100);
    expect(col.collided).toBe(false);

    // 4. Swept collision check allows walking inside interior
    const swept = city.checkSweptCollision(4000, 4000, 4005, 4005, 0.5, 100);
    expect(swept.collided).toBe(false);
  });

  it('should smoothly enter a building on foot and teleport to interior spawn point', () => {
    const { interiors, player, camera, hud, sound } = createSystemTestSetup();

    expect(interiors.currentInteriorId).toBeNull();

    const success = interiors.enterInterior('penthouse', player, camera, hud, sound);
    expect(success).toBe(true);
    expect(interiors.currentInteriorId).toBe('penthouse');

    // Player position teleported to penthouse spawn
    expect(player.x).toBe(4000);
    expect(player.y).toBe(100.0);
    expect(player.z).toBe(3992);
    expect(hud.showNotification).toHaveBeenCalled();
  });

  it('should clamp player inside interior room boundaries so player cannot fall or walk through walls', () => {
    const { interiors, player, camera, hud, input, sound, weapons, police, economy } =
      createSystemTestSetup();

    interiors.enterInterior('penthouse', player, camera, hud, sound);
    const room = interiors.doors.find((d) => d.id === 'penthouse')!;

    // Attempt to drop below room floor
    player.setPosition(4000, 50, 4000);
    interiors.update(0.016, player, hud, input, sound, weapons, police, economy, camera);
    expect(player.y).toBe(room.bounds.floorY);

    // Attempt to walk beyond east wall
    player.setPosition(room.bounds.maxX + 15, 100, 4000);
    interiors.update(0.016, player, hud, input, sound, weapons, police, economy, camera);
    expect(player.x).toBeLessThanOrEqual(room.bounds.maxX - 0.5);

    // Attempt to walk beyond north wall
    player.setPosition(4000, 100, room.bounds.maxZ + 20);
    interiors.update(0.016, player, hud, input, sound, weapons, police, economy, camera);
    expect(player.z).toBeLessThanOrEqual(room.bounds.maxZ - 0.5);
  });

  it('should exit building and return player to city exterior sidewalk', () => {
    const { interiors, player, camera, hud, sound } = createSystemTestSetup();

    interiors.enterInterior('gun_store', player, camera, hud, sound);
    expect(interiors.currentInteriorId).toBe('gun_store');

    const exitSuccess = interiors.exitInterior(player, camera, hud, sound);
    expect(exitSuccess).toBe(true);
    expect(interiors.currentInteriorId).toBeNull();

    const gunStore = interiors.doors.find((d) => d.id === 'gun_store')!;
    expect(player.x).toBe(gunStore.exteriorX);
    expect(player.y).toBe(0.25);
    expect(player.z).toBeCloseTo(gunStore.exteriorZ + 2.0, 1);
  });

  describe('Interior Station Interactions', () => {
    it('should heal player to 100 HP when sleeping in Penthouse bed', () => {
      const { interiors, player, hud, sound, weapons, police, economy } = createSystemTestSetup();
      player.health = 35;

      const pentInteractables = interiors.interactables.get('penthouse')!;
      const bed = pentInteractables.find((i) => i.id === 'penthouse_bed')!;
      expect(bed).toBeDefined();

      bed.onInteract({ player, hud, sound, weapons, police, economy });
      expect(player.health).toBe(100);
      expect(hud.showNotification).toHaveBeenCalledWith(
        expect.stringContaining('Gesundheit auf 100% wiederhergestellt'),
      );
    });

    it('should refill player health by +25 HP when taking drink from Penthouse minibar', () => {
      const { interiors, player, hud, sound, weapons, police, economy } = createSystemTestSetup();
      player.health = 60;

      const pentInteractables = interiors.interactables.get('penthouse')!;
      const bar = pentInteractables.find((i) => i.id === 'penthouse_bar')!;
      expect(bar).toBeDefined();

      bar.onInteract({ player, hud, sound, weapons, police, economy });
      expect(player.health).toBe(85);
      expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('+25 HP'));
    });

    it('should unlock all weapons and replenish maximum ammo at Ammu-Nation counter for $500', () => {
      const { interiors, player, hud, sound, weapons, police, economy } = createSystemTestSetup();
      economy.cash = 1000;

      const gunInteractables = interiors.interactables.get('gun_store')!;
      const counter = gunInteractables.find((i) => i.id === 'gun_counter')!;
      expect(counter).toBeDefined();

      counter.onInteract({ player, hud, sound, weapons, police, economy });
      expect(economy.cash).toBe(500);

      // Verify all catalog weapons unlocked and full ammo
      economy.weapons.forEach((w) => {
        expect(w.unlocked).toBe(true);
        expect(w.ammo).toBe(w.maxAmmo);
      });
    });

    it('should award $250 practice cash at Ammu-Nation shooting range', () => {
      const { interiors, player, hud, sound, weapons, police, economy } = createSystemTestSetup();
      economy.cash = 100;

      const gunInteractables = interiors.interactables.get('gun_store')!;
      const range = gunInteractables.find((i) => i.id === 'shooting_range')!;
      expect(range).toBeDefined();

      range.onInteract({ player, hud, sound, weapons, police, economy });
      expect(economy.cash).toBe(350);
      expect(hud.showNotification).toHaveBeenCalledWith(
        expect.stringContaining('+$250 Schießstand-Prämie'),
      );
    });

    it('should award style points and cash on Nightclub dance floor', () => {
      const { interiors, player, hud, sound, weapons, police, economy } = createSystemTestSetup();
      economy.cash = 200;

      const clubInteractables = interiors.interactables.get('nightclub')!;
      const dance = clubInteractables.find((i) => i.id === 'club_dance')!;
      expect(dance).toBeDefined();

      dance.onInteract({ player, hud, sound, weapons, police, economy });
      expect(economy.cash).toBe(350);
      expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Tanzfläche'));
    });

    it('should wipe wanted stars to 0 when hacking police mainframe in Hacker Syndicate Loft', () => {
      const { interiors, player, hud, sound, weapons, police, economy } = createSystemTestSetup();
      police.setWantedLevel(4);
      expect(police.wantedLevel).toBe(4);

      const hackerInteractables = interiors.interactables.get('hacker_loft')!;
      const terminal = hackerInteractables.find((i) => i.id === 'hacker_terminal')!;
      expect(terminal).toBeDefined();

      terminal.onInteract({ player, hud, sound, weapons, police, economy });
      expect(police.wantedLevel).toBe(0);
      expect(hud.showNotification).toHaveBeenCalledWith(
        expect.stringContaining('0 Fahndungssterne'),
      );
    });

    it('should plunder $3,000 cash from Cyber City Bank gold vault', () => {
      const { interiors, player, hud, sound, weapons, police, economy } = createSystemTestSetup();
      economy.cash = 500;

      const bankInteractables = interiors.interactables.get('city_bank')!;
      const vault = bankInteractables.find((i) => i.id === 'bank_gold')!;
      expect(vault).toBeDefined();

      vault.onInteract({ player, hud, sound, weapons, police, economy });
      expect(economy.cash).toBe(3500);
      expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('GOLDBARREN'));
    });
  });

  it('should detect proximity to exterior doors while driving in car and prompt entering building', () => {
    const { interiors, player, camera, hud, input, sound, weapons, police, economy } =
      createSystemTestSetup();

    // Spawn a car right in front of the Penthouse exterior door (-88, -56)
    const car = new Car(-88, -55, 0);

    interiors.update(0.016, player, hud, input, sound, weapons, police, economy, camera, car);

    expect(hud.setPrompt).toHaveBeenCalledWith(expect.stringContaining('Penthouse'));
  });
});
