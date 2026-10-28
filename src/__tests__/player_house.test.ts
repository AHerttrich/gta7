import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { City } from '../city/City';
import { InteriorSystem } from '../interiors/InteriorSystem';
import { Player } from '../character/Player';
import { GameCamera } from '../engine/Camera';
import { HUD } from '../ui/HUD';
import { SoundManager } from '../audio/SoundManager';
import { WeaponSystem } from '../combat/WeaponSystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { Car } from '../vehicles/Car';
import { PlayerHouseSystem } from '../housing/PlayerHouseSystem';

describe("Player's Own Luxury Villa Estate (Dein Eigenes Haus)", () => {
  let scene: THREE.Scene;
  let city: City;
  let interiors: InteriorSystem;
  let player: Player;
  let car: Car;
  let camera: GameCamera;
  let hud: HUD;
  let sound: SoundManager;
  let economy: EconomySystem;
  let police: PoliceSystem;
  let weapons: WeaponSystem;
  let houseSystem: PlayerHouseSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    city = new City();
    interiors = new InteriorSystem(scene);
    player = new Player(0, 0);
    car = new Car(0, 0);
    const cameraPerspective = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
    camera = new GameCamera(cameraPerspective);
    sound = new SoundManager();
    economy = new EconomySystem();
    police = new PoliceSystem(scene, city);
    const traffic = new TrafficSystem(scene);
    const pedestrians = new PedestrianSystem(scene);
    weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians);
    houseSystem = new PlayerHouseSystem();

    hud = {
      showNotification: vi.fn(),
      setPrompt: vi.fn(),
    } as unknown as HUD;
  });

  it('generates the luxury player estate on block [1, 1] with building bounds and parking driveway', () => {
    // Villa estate is centered around cx = -176, cz = -176
    const villaBound = city.buildingBounds.find(
      (b) => b.minX <= -176 && b.maxX >= -176 && b.minZ <= -180 && b.maxZ >= -174,
    );
    expect(villaBound).toBeDefined();
    expect(villaBound?.height).toBe(10.0);

    // Parking coordinates (-187, -162) are outside building collision boundary
    const parkCollision = city.checkCollision(
      PlayerHouseSystem.PARKING_POS.x,
      PlayerHouseSystem.PARKING_POS.z,
      1.5,
    );
    expect(parkCollision.collided).toBe(false);
  });

  it('registers the golden player villa door with archetype player_house', () => {
    const villaDoor = interiors.doors.find((d) => d.id === 'player_villa');
    expect(villaDoor).toBeDefined();
    expect(villaDoor?.name).toContain('Dein Eigenes Haus');
    expect(villaDoor?.icon).toBe('👑');
    expect(villaDoor?.exteriorX).toBe(-176);
    expect(villaDoor?.exteriorZ).toBe(-172);
    expect(villaDoor?.archetypeId).toBe('player_house');
    expect(villaDoor?.interiorSpawn.x).toBe(5600);
    expect(villaDoor?.interiorSpawn.y).toBe(100.0);
    expect(villaDoor?.interiorSpawn.z).toBe(3992);
  });

  it('allows the player to enter their villa interior and exit back to their private driveway', () => {
    const entered = interiors.enterInterior('player_villa', player, camera, hud, sound);
    expect(entered).toBe(true);
    expect(interiors.currentInteriorId).toBe('player_house');
    expect(player.x).toBe(5600);
    expect(player.y).toBe(100.0);
    expect(player.z).toBe(3992);

    const exited = interiors.exitInterior(player, camera, hud, sound);
    expect(exited).toBe(true);
    expect(interiors.currentInteriorId).toBeNull();
    expect(player.x).toBe(-176);
    expect(player.y).toBe(0.25);
    expect(player.z).toBe(-170);
  });

  it('features a master king-size bed that restores 100% HP and clears wanted stars', () => {
    const interactables = interiors.interactables.get('player_house')!;
    const bed = interactables.find((i) => i.id === 'house_bed')!;
    expect(bed).toBeDefined();

    player.health = 20;
    police.setWantedLevel(4);
    expect(police.wantedLevel).toBe(4);

    bed.onInteract({ player, police, hud, sound, weapons, economy });
    expect(player.health).toBe(100);
    expect(police.wantedLevel).toBe(0);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Ausgeruht'));
  });

  it('features a walk-in wardrobe that cycles outfits and changes character visual materials', () => {
    const interactables = interiors.interactables.get('player_house')!;
    const wardrobe = interactables.find((i) => i.id === 'house_wardrobe')!;
    expect(wardrobe).toBeDefined();

    wardrobe.onInteract({ player, police, hud, sound, weapons, economy });
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Kleiderschrank'));
  });

  it('features a personal armory that fully restocks all weapons and ammunition for free', () => {
    const interactables = interiors.interactables.get('player_house')!;
    const armory = interactables.find((i) => i.id === 'house_armory')!;
    expect(armory).toBeDefined();

    // Deplete ammo
    economy.weapons.forEach((w) => {
      w.ammo = 0;
    });

    armory.onInteract({ player, police, hud, sound, weapons, economy });
    economy.weapons.forEach((w) => {
      expect(w.unlocked).toBe(true);
      expect(w.ammo).toBe(w.maxAmmo);
    });
    expect(player.health).toBe(100);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Waffenkammer'));
  });

  it('features a gourmet kitchen and minibar granting vitality and healing (+40 HP)', () => {
    const interactables = interiors.interactables.get('player_house')!;
    const kitchen = interactables.find((i) => i.id === 'house_kitchen')!;
    expect(kitchen).toBeDefined();

    player.health = 45;
    kitchen.onInteract({ player, police, hud, sound, weapons, economy });
    expect(player.health).toBe(85);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Steinofenpizza'));
  });

  it('features a high-security vault generating passive crypto mining income', () => {
    const interactables = interiors.interactables.get('player_house')!;
    const vault = interactables.find((i) => i.id === 'house_vault')!;
    expect(vault).toBeDefined();

    const startCash = economy.cash;
    vault.onInteract({ player, police, hud, sound, weapons, economy });
    expect(economy.cash).toBe(startCash + 1500);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Tresor'));
  });

  it('features robotic cyber-dog Bolt who barks and grants a +25% agility speed boost when petted', () => {
    const interactables = interiors.interactables.get('player_house')!;
    const pet = interactables.find((i) => i.id === 'house_pet')!;
    expect(pet).toBeDefined();

    expect(player.speedMultiplier).toBe(1.0);
    pet.onInteract({ player, police, hud, sound, weapons, economy });
    expect(player.speedMultiplier).toBe(1.25);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Bolt'));
  });

  it('auto-repairs cars and recharges nitro when parked in the villa private driveway stall', () => {
    // Damage car and deplete nitro
    car.health = 35;
    car.physics.nitro = 15;
    car.physics.x = PlayerHouseSystem.PARKING_POS.x;
    car.physics.z = PlayerHouseSystem.PARKING_POS.z;

    // Simulate 2 seconds of parking in driveway
    houseSystem.update(2.0, player, car, 'IN_CAR', hud, sound);

    expect(car.health).toBeGreaterThan(35);
    expect(car.physics.nitro).toBeGreaterThan(15);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Villa-Parkplatz'));
  });

  it('handles hotkey [H] to toggle GPS to villa or fast-travel home', () => {
    player.setPosition(100, 0, 100);

    // 1st press: GPS Navigation activated
    houseSystem.handleHomeKey(player, null, 'ON_FOOT', hud, sound, camera);
    expect(houseSystem.gpsActive).toBe(true);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('GPS Navigation'));

    // 2nd press: Teleport directly to villa estate
    houseSystem.handleHomeKey(player, null, 'ON_FOOT', hud, sound, camera);
    expect(houseSystem.gpsActive).toBe(false);
    expect(player.x).toBe(PlayerHouseSystem.VILLA_POS.x);
    expect(player.z).toBe(PlayerHouseSystem.VILLA_POS.z + 2.0);
    expect(hud.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('Willkommen zu Hause'),
    );
  });

  it('supports claiming accrued passive income in PlayerHouseSystem', () => {
    const initialCash = economy.cash;
    const claimed = houseSystem.claimVault(economy, hud, sound);
    expect(claimed).toBe(2500);
    expect(economy.cash).toBe(initialCash + 2500);
    expect(houseSystem.vaultBalance).toBe(0);

    // Second claim when empty
    const claimedEmpty = houseSystem.claimVault(economy, hud, sound);
    expect(claimedEmpty).toBe(0);
  });
});
