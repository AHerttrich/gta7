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
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { Input } from '../engine/Input';
import { Building } from '../city/Building';

describe('Brighter Rooms & Diverse Residential Houses (Heller & Wohnhäuser)', () => {
  let scene: THREE.Scene;
  let city: City;
  let interiors: InteriorSystem;
  let player: Player;
  let camera: GameCamera;
  let hud: HUD;
  let sound: SoundManager;
  let economy: EconomySystem;
  let police: PoliceSystem;
  let weapons: WeaponSystem;
  let input: Input;

  beforeEach(() => {
    scene = new THREE.Scene();
    city = new City();
    interiors = new InteriorSystem(scene);
    player = new Player(0, 0);
    const cameraPerspective = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
    camera = new GameCamera(cameraPerspective);
    sound = new SoundManager();
    economy = new EconomySystem();
    police = new PoliceSystem(scene, city);
    const traffic = new TrafficSystem(scene);
    const pedestrians = new PedestrianSystem(scene);
    weapons = new WeaponSystem(scene, sound, traffic, police, pedestrians);
    input = new Input();

    hud = {
      showNotification: vi.fn(),
      setPrompt: vi.fn(),
    } as unknown as HUD;
  });

  describe('1. Brighter Room Illumination (Hellere Räume)', () => {
    it('provides global interior ambient and hemisphere fill lights that activate upon entering', () => {
      expect(interiors.interiorAmbientLight).toBeDefined();
      expect(interiors.interiorHemiLight).toBeDefined();
      expect(interiors.interiorAmbientLight.intensity).toBeGreaterThanOrEqual(2.0);
      expect(interiors.interiorHemiLight.intensity).toBeGreaterThanOrEqual(1.5);

      // Initially inactive while outside
      expect(interiors.interiorAmbientLight.visible).toBe(false);
      expect(interiors.interiorHemiLight.visible).toBe(false);

      // Enter an interior -> lights become visible
      const familyDoor = interiors.doors.find((d) => d.archetypeId === 'family_house')!;
      interiors.enterInterior(familyDoor.id, player, camera, hud, sound);

      expect(interiors.interiorAmbientLight.visible).toBe(true);
      expect(interiors.interiorHemiLight.visible).toBe(true);

      // Exit interior -> lights deactivate
      interiors.exitInterior(player, camera, hud, sound);
      expect(interiors.interiorAmbientLight.visible).toBe(false);
      expect(interiors.interiorHemiLight.visible).toBe(false);
    });

    it('creates standard room shells with bright white plaster ceilings and multi-point lighting (> 7.0 lux)', () => {
      const familyGroup = interiors.roomGroups.get('family_house')!;
      expect(familyGroup).toBeDefined();

      // Find ceiling mesh
      const meshes: THREE.Mesh[] = [];
      familyGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) meshes.push(obj);
      });

      // Find ceiling (y at +4.8)
      const ceiling = meshes.find((m) => Math.abs(m.position.y - 104.8) < 0.2);
      expect(ceiling).toBeDefined();
      const ceilingMat = ceiling!.material as THREE.MeshStandardMaterial;
      expect(ceilingMat.color.getHex()).toBe(0xf8fafc); // Bright plaster white

      // Check lights in the room
      const lights: THREE.PointLight[] = [];
      familyGroup.traverse((obj) => {
        if (obj instanceof THREE.PointLight) lights.push(obj);
      });

      // At least 4 quadrant downlights + 1 central chandelier = 5 point lights
      expect(lights.length).toBeGreaterThanOrEqual(5);

      const centralLight = lights.find((l) => l.intensity >= 7.0);
      expect(centralLight).toBeDefined();
      expect(centralLight!.distance).toBeGreaterThanOrEqual(40);
    });

    it('upgrades showcase interiors (Penthouse, Gun Store, Nightclub, Player House) with bright ceilings and high lux', () => {
      const penthouseGroup = interiors.roomGroups.get('penthouse')!;
      const penthouseLights: THREE.PointLight[] = [];
      penthouseGroup.traverse((obj) => {
        if (obj instanceof THREE.PointLight) penthouseLights.push(obj);
      });
      expect(penthouseLights.some((l) => l.intensity >= 7.0)).toBe(true);

      const playerHouseGroup = interiors.roomGroups.get('player_house')!;
      const houseLights: THREE.PointLight[] = [];
      playerHouseGroup.traverse((obj) => {
        if (obj instanceof THREE.PointLight) houseLights.push(obj);
      });
      expect(houseLights.some((l) => l.intensity >= 7.0)).toBe(true);
      expect(houseLights.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('2. Suburban Houses & Neighborhoods in the City (Wohnhäuser-Viertel)', () => {
    it('creates 3D suburban houses with gabled pitched roofs, brick chimneys, and porches via Building.createSuburbanHouse', () => {
      const house = Building.createSuburbanHouse(50, 50, 20, 18, 10, 0x22c55e);
      expect(house.mesh).toBeDefined();
      expect(house.bounds).toBeDefined();
      expect(house.mesh.children.length).toBeGreaterThanOrEqual(6);
      expect(house.bounds.maxX - house.bounds.minX).toBeGreaterThan(15);
      expect(house.bounds.height).toBeGreaterThanOrEqual(10);
    });

    it('generates handcrafted suburban neighborhoods with family homes and picket fences in City blocks', () => {
      // Check City has building bounds registered for suburban blocks
      expect(city.buildingBounds.length).toBeGreaterThan(20);

      // Verify entrance doors exist for residential blocks [0, 1], [1, 0], and [0, 3]
      const door01 = interiors.doors.find((d) => d.id === 'building_0_1')!;
      const door10 = interiors.doors.find((d) => d.id === 'building_1_0')!;
      const door03 = interiors.doors.find((d) => d.id === 'building_0_3')!;

      expect(door01).toBeDefined();
      expect(door01.archetypeId).toBe('family_house');
      expect(door01.icon).toBe('🏡');

      expect(door10).toBeDefined();
      expect(door10.archetypeId).toBe('cozy_bungalow');
      expect(door10.icon).toBe('🏡');

      expect(door03).toBeDefined();
      expect(door03.archetypeId).toBe('student_flat');
      expect(door03.icon).toBe('🏘️');
    });
  });

  describe('3. 4 Diverse Residential Interior Archetypes & Living Residents', () => {
    it('supports Family House (family_house) with Familie Müller (Thomas, Sabine, Leo) and family dinner', () => {
      const familyDoor = interiors.doors.find((d) => d.archetypeId === 'family_house')!;
      interiors.enterInterior(familyDoor.id, player, camera, hud, sound);

      expect(interiors.currentInteriorId).toBe('family_house');
      expect(player.x).toBe(5700);

      // Residents
      const familyResidents = interiors.residents.filter((r) => r.archetypeId === 'family_house');
      expect(familyResidents.length).toBe(3);
      expect(familyResidents.some((r) => r.name === 'Thomas Müller')).toBe(true);
      expect(familyResidents.some((r) => r.name === 'Sabine Müller')).toBe(true);
      expect(familyResidents.some((r) => r.name === 'Leo Müller')).toBe(true);

      // Interactable: Family Dinner (+50 HP & +100$)
      player.health = 30;
      economy.cash = 200;
      const interactables = interiors.interactables.get('family_house')!;
      const dinner = interactables.find((i) => i.id === 'family_dinner')!;
      dinner.onInteract({ player, hud, sound, weapons, police, economy });

      expect(player.health).toBe(80);
      expect(economy.cash).toBe(300);

      interiors.exitInterior(player, camera, hud, sound);
    });

    it('supports Modern City Villa (modern_villa_resident) with Felix Sommer, Laura Lindner and heated Jacuzzi', () => {
      const villaDoor = interiors.doors.find((d) => d.archetypeId === 'modern_villa_resident')!;
      interiors.enterInterior(villaDoor.id, player, camera, hud, sound);

      expect(interiors.currentInteriorId).toBe('modern_villa_resident');
      expect(player.x).toBe(5800);

      // Residents
      const villaResidents = interiors.residents.filter(
        (r) => r.archetypeId === 'modern_villa_resident',
      );
      expect(villaResidents.length).toBe(2);
      expect(villaResidents.some((r) => r.name === 'Felix Sommer')).toBe(true);
      expect(villaResidents.some((r) => r.name === 'Laura Lindner')).toBe(true);

      // Interactable: Heated Jacuzzi (+50 HP & +200$)
      player.health = 40;
      economy.cash = 100;
      const interactables = interiors.interactables.get('modern_villa_resident')!;
      const jacuzzi = interactables.find((i) => i.id === 'villa_jacuzzi')!;
      jacuzzi.onInteract({ player, hud, sound, weapons, police, economy });

      expect(player.health).toBe(90);
      expect(economy.cash).toBe(300);

      interiors.exitInterior(player, camera, hud, sound);
    });

    it('supports Student Flat (student_flat) with Jan & Lisa, pizza snack and acoustic guitar jam', () => {
      const flatDoor = interiors.doors.find((d) => d.archetypeId === 'student_flat')!;
      interiors.enterInterior(flatDoor.id, player, camera, hud, sound);

      expect(interiors.currentInteriorId).toBe('student_flat');
      expect(player.x).toBe(5900);

      // Residents
      const flatResidents = interiors.residents.filter((r) => r.archetypeId === 'student_flat');
      expect(flatResidents.length).toBe(2);
      expect(flatResidents.some((r) => r.name === 'Jan')).toBe(true);
      expect(flatResidents.some((r) => r.name === 'Lisa')).toBe(true);

      // Interactable: Pizza (+40 HP & +50$)
      player.health = 40;
      economy.cash = 50;
      const interactables = interiors.interactables.get('student_flat')!;
      const pizza = interactables.find((i) => i.id === 'wg_pizza')!;
      pizza.onInteract({ player, hud, sound, weapons, police, economy });

      expect(player.health).toBe(80);
      expect(economy.cash).toBe(100);

      // Interactable: Guitar Jam (+100$)
      const guitar = interactables.find((i) => i.id === 'wg_guitar')!;
      guitar.onInteract({ player, hud, sound, weapons, police, economy });
      expect(economy.cash).toBe(200);

      interiors.exitInterior(player, camera, hud, sound);
    });

    it('supports Cozy Bungalow (cozy_bungalow) with Oma Helga, fireplace and hot cinnamon apple pie', () => {
      const bungalowDoor = interiors.doors.find((d) => d.archetypeId === 'cozy_bungalow')!;
      interiors.enterInterior(bungalowDoor.id, player, camera, hud, sound);

      expect(interiors.currentInteriorId).toBe('cozy_bungalow');
      expect(player.x).toBe(6000);

      // Resident: Oma Helga
      const bungalowResidents = interiors.residents.filter(
        (r) => r.archetypeId === 'cozy_bungalow',
      );
      expect(bungalowResidents.length).toBe(1);
      const helga = bungalowResidents[0];
      expect(helga.name).toBe('Oma Helga');
      expect(helga.isSitting).toBe(true);

      // Oma's fresh apple pie (Full 100 HP & +150$ Taschengeld)
      player.health = 25;
      economy.cash = 100;
      const interactables = interiors.interactables.get('cozy_bungalow')!;
      const pie = interactables.find((i) => i.id === 'oma_pie')!;
      pie.onInteract({ player, hud, sound, weapons, police, economy });

      expect(player.health).toBe(100);
      expect(economy.cash).toBe(250);

      // Fireplace (+40 HP)
      player.health = 50;
      const fireplace = interactables.find((i) => i.id === 'oma_fireplace')!;
      fireplace.onInteract({ player, hud, sound, weapons, police, economy });
      expect(player.health).toBe(90);

      interiors.exitInterior(player, camera, hud, sound);
    });
  });

  describe('4. Full City Entrance & Return Coordinates', () => {
    it('allows entering any residential building door and safely exiting back to the street', () => {
      const resDoors = interiors.doors.filter(
        (d) =>
          d.archetypeId === 'family_house' ||
          d.archetypeId === 'modern_villa_resident' ||
          d.archetypeId === 'student_flat' ||
          d.archetypeId === 'cozy_bungalow',
      );

      expect(resDoors.length).toBeGreaterThanOrEqual(8);

      for (const door of resDoors.slice(0, 4)) {
        interiors.enterInterior(door.id, player, camera, hud, sound);
        expect(interiors.currentInteriorId).toBe(door.archetypeId);

        // Update loop keeps player constrained inside bounds
        interiors.update(
          0.016,
          player,
          hud,
          input,
          sound,
          weapons,
          police,
          economy,
          camera,
          undefined,
          false,
        );
        expect(player.y).toBe(100.0);
        expect(player.x).toBeGreaterThanOrEqual(door.bounds.minX);
        expect(player.x).toBeLessThanOrEqual(door.bounds.maxX);

        interiors.exitInterior(player, camera, hud, sound);
        expect(interiors.currentInteriorId).toBeNull();
        expect(player.y).toBe(0.25);
      }
    });
  });
});
