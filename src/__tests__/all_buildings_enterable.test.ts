import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { Car } from '../vehicles/Car';

describe('Every Single Building Enterable (Jedes Haus betretbar)', () => {
  let scene: THREE.Scene;
  let city: City;
  let camera: GameCamera;
  let player: Player;
  let economy: EconomySystem;
  let sound: SoundManager;
  let hud: HUD;
  let police: PoliceSystem;
  let weapons: WeaponSystem;
  let input: Input;
  let interiors: InteriorSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    city = new City();
    const cameraPerspective = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
    camera = new GameCamera(cameraPerspective);
    player = new Player(0, 0);
    economy = new EconomySystem();
    sound = new SoundManager();
    hud = {
      showNotification: vi.fn(),
      setPrompt: vi.fn(),
      updateVehicleStats: vi.fn(),
    } as unknown as HUD;
    police = new PoliceSystem(scene, city);
    const traffic = new TrafficSystem(scene);
    const pedestrians = new PedestrianSystem(scene);
    weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians);
    input = new Input();
    interiors = new InteriorSystem(scene);
  });

  it('registers an entrance door for every building across the entire 7x7 city grid and landmarks', () => {
    // 46 city blocks with buildings + 1 airport + 1 stadium + 1 island cottage = 49 enterable buildings
    expect(interiors.doors.length).toBeGreaterThanOrEqual(48);

    // Verify all corner buildings in 7x7 grid have entrance doors
    expect(interiors.doors.some((d) => d.id === 'building_0_0')).toBe(true);
    expect(interiors.doors.some((d) => d.id === 'building_0_6')).toBe(true);
    expect(interiors.doors.some((d) => d.id === 'building_6_0')).toBe(true);
    expect(interiors.doors.some((d) => d.id === 'building_6_6')).toBe(true);

    // Verify special landmark building doors
    expect(interiors.doors.some((d) => d.id === 'airport_ops')).toBe(true);
    expect(interiors.doors.some((d) => d.id === 'stadium_vip')).toBe(true);
    expect(interiors.doors.some((d) => d.id === 'lighthouse_cottage')).toBe(true);
  });

  it('places entrance doors on sidewalks with illuminated frames, glass, neon signboards and floor rings', () => {
    interiors.doors.forEach((door) => {
      expect(door.doorGroup).toBeDefined();
      expect(door.doorGroup.children.length).toBeGreaterThanOrEqual(5);
      expect(door.name).toBeTruthy();
      expect(door.icon).toBeTruthy();
      expect(door.bounds).toBeDefined();
      expect(door.interiorSpawn.y).toBe(100.0);
    });
  });

  it('allows entering any building and returns the player to that exact building exterior on exit', () => {
    // Test entering a corner Cyber Tower
    const cornerDoor = interiors.doors.find((d) => d.id === 'building_0_0')!;
    const entered = interiors.enterInterior(cornerDoor.id, player, camera, hud, sound);

    expect(entered).toBe(true);
    expect(interiors.currentInteriorId).toBeTruthy();
    expect(interiors.activeDoor?.id).toBe('building_0_0');
    expect(player.y).toBe(100.0);

    // Exit interior
    const exited = interiors.exitInterior(player, camera, hud, sound);
    expect(exited).toBe(true);
    expect(interiors.currentInteriorId).toBeNull();
    expect(interiors.activeDoor).toBeNull();

    // Verify returned to exterior sidewalk of building [0,0]
    expect(player.x).toBeCloseTo(cornerDoor.exteriorX, 0);
    expect(player.y).toBe(0.25);
  });

  it('supports entering the Island Lighthouse Keeper Cottage and interacting with the fireplace and captain logbook', () => {
    const cottageDoor = interiors.doors.find((d) => d.id === 'lighthouse_cottage')!;
    interiors.enterInterior(cottageDoor.id, player, camera, hud, sound);

    expect(interiors.currentInteriorId).toBe('lighthouse_cabin');
    expect(player.x).toBe(5300);

    // Warm at fireplace (+40 HP)
    player.health = 40;
    const cabinInteractables = interiors.interactables.get('lighthouse_cabin')!;
    const fireplace = cabinInteractables.find((i) => i.id === 'cabin_fire')!;
    fireplace.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(80);

    // Read logbook (+200$)
    economy.cash = 100;
    const logbook = cabinInteractables.find((i) => i.id === 'cabin_log')!;
    logbook.onInteract({ player, hud, sound, weapons, police, economy });
    expect(economy.cash).toBe(300);

    // Exit back to island
    interiors.exitInterior(player, camera, hud, sound);
    expect(player.x).toBeCloseTo(cottageDoor.exteriorX + 2.0, 1);
    expect(player.z).toBeCloseTo(cottageDoor.exteriorZ, 1);
  });

  it('supports entering Airport VIP Lounge & Duty Free', () => {
    const airportDoor = interiors.doors.find((d) => d.id === 'airport_ops')!;
    interiors.enterInterior(airportDoor.id, player, camera, hud, sound);

    expect(interiors.currentInteriorId).toBe('airport_lounge');
    expect(player.x).toBe(5400);

    // Duty-Free Snacks (+30 HP, +100$)
    player.health = 50;
    economy.cash = 200;
    const airportInteractables = interiors.interactables.get('airport_lounge')!;
    const dutyFree = airportInteractables.find((i) => i.id === 'airport_dutyfree')!;
    dutyFree.onInteract({ player, hud, sound, weapons, police, economy });

    expect(player.health).toBe(80);
    expect(economy.cash).toBe(300);

    interiors.exitInterior(player, camera, hud, sound);
    expect(player.x).toBeCloseTo(airportDoor.exteriorX, 0);
  });

  it('supports Corporate HQ with Espresso bar and Trading terminal', () => {
    player.health = 50;
    economy.cash = 100;

    const corpInteractables = interiors.interactables.get('corp_hq')!;
    const espresso = corpInteractables.find((i) => i.id === 'corp_espresso')!;
    const trading = corpInteractables.find((i) => i.id === 'corp_trading')!;

    espresso.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(75);

    trading.onInteract({ player, hud, sound, weapons, police, economy });
    expect(economy.cash).toBe(450);
  });

  it('supports Neon Arcade with Retro Arcade Machine and Lucky Wheel jackpot', () => {
    economy.cash = 0;

    const arcadeInteractables = interiors.interactables.get('neon_arcade')!;
    const cab = arcadeInteractables.find((i) => i.id === 'arcade_play')!;
    const wheel = arcadeInteractables.find((i) => i.id === 'arcade_wheel')!;

    cab.onInteract({ player, hud, sound, weapons, police, economy });
    expect(economy.cash).toBe(250);

    wheel.onInteract({ player, hud, sound, weapons, police, economy });
    expect(economy.cash).toBe(750);
  });

  it('supports Dragon Martial Arts Dojo with boxing workout and meditation gong', () => {
    player.health = 40;

    const dojoInteractables = interiors.interactables.get('martial_dojo')!;
    const gong = dojoInteractables.find((i) => i.id === 'dojo_gong')!;
    const workout = dojoInteractables.find((i) => i.id === 'dojo_workout')!;

    gong.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(80);

    workout.onInteract({ player, hud, sound, weapons, police, economy });
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('WORKOUT'));
  });

  it('supports Noodle Bar with Tonkotsu Ramen and Maneki-Neko lucky cat', () => {
    player.health = 30;
    economy.cash = 100;

    const noodleInteractables = interiors.interactables.get('noodle_bar')!;
    const ramen = noodleInteractables.find((i) => i.id === 'noodle_ramen')!;
    const cat = noodleInteractables.find((i) => i.id === 'noodle_cat')!;

    ramen.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(75);

    cat.onInteract({ player, hud, sound, weapons, police, economy });
    expect(economy.cash).toBe(433);
  });

  it('supports Cyberware Ripperdoc clinic with 100% full health restoration', () => {
    player.health = 12;

    const ripperInteractables = interiors.interactables.get('ripperdoc')!;
    const medbed = ripperInteractables.find((i) => i.id === 'ripper_medbed')!;

    medbed.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(100);
  });

  it('detects proximity to any building door while driving in car and prompts to enter', () => {
    const testDoor = interiors.doors[12];
    const car = new Car(testDoor.exteriorX, testDoor.exteriorZ, 0);

    interiors.update(0.016, player, hud, input, sound, weapons, police, economy, camera, car);

    expect(hud.setPrompt).toHaveBeenCalledWith(expect.stringContaining(testDoor.name));
  });
});
