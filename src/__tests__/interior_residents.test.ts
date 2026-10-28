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

describe('Interior Residents & People Living in Houses (Menschen in den Häusern)', () => {
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

  it('populates all interior archetypes with 3D human residents and occupants', () => {
    expect(interiors.residents.length).toBeGreaterThanOrEqual(30);

    // Verify residential homes (cyber_loft) have residents
    const loftResidents = interiors.residents.filter((r) => r.archetypeId === 'cyber_loft');
    expect(loftResidents.length).toBeGreaterThanOrEqual(2);
    expect(loftResidents.some((r) => r.name === 'Mia')).toBe(true);
    expect(loftResidents.some((r) => r.name === 'Leon')).toBe(true);

    // Verify player mansion (player_house) has staff and friends
    const houseResidents = interiors.residents.filter((r) => r.archetypeId === 'player_house');
    expect(houseResidents.length).toBeGreaterThanOrEqual(3);
    expect(houseResidents.some((r) => r.name === 'Alfred')).toBe(true);
    expect(houseResidents.some((r) => r.name === 'Dave')).toBe(true);
    expect(houseResidents.some((r) => r.name === 'Elena')).toBe(true);

    // Verify specialty building occupants
    expect(interiors.residents.some((r) => r.name === 'Chef Toshi')).toBe(true);
    expect(interiors.residents.some((r) => r.name === 'Master Kenji')).toBe(true);
    expect(interiors.residents.some((r) => r.name === 'Dr. Watson')).toBe(true);
    expect(interiors.residents.some((r) => r.name === 'Kapitän Blaubart')).toBe(true);
    expect(interiors.residents.some((r) => r.name === 'Viktor Vance')).toBe(true);
  });

  it('constructs complete 3D body meshes (torso, head, arms, legs) for every resident', () => {
    interiors.residents.forEach((r) => {
      expect(r.group).toBeDefined();
      expect(r.torsoMesh).toBeDefined();
      expect(r.headMesh).toBeDefined();
      expect(r.leftArm).toBeDefined();
      expect(r.rightArm).toBeDefined();
      expect(r.leftLeg).toBeDefined();
      expect(r.rightLeg).toBeDefined();
      expect(r.dialogues.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('models sitting residents with adapted heights and horizontal thighs', () => {
    const sittingResident = interiors.residents.find((r) => r.isSitting);
    expect(sittingResident).toBeDefined();
    // Sitting torso elevation is lower than standing (0.82 vs 1.15)
    expect(sittingResident!.torsoMesh.position.y).toBeLessThan(1.0);
  });

  it('allows talking to residential occupants (Mia & Leon) in city apartments and receiving cookies & cash', () => {
    const loftInteractables = interiors.interactables.get('cyber_loft')!;
    const talkMia = loftInteractables.find((i) => i.id === 'talk_loft_mia')!;
    const talkLeon = loftInteractables.find((i) => i.id === 'talk_loft_leon')!;

    expect(talkMia).toBeDefined();
    expect(talkLeon).toBeDefined();

    // Talking to Mia gives homemade cookie (+25 HP)
    player.health = 50;
    talkMia.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(75);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Mia'));

    // Talking to Leon gives crypto grant (+$100)
    const initialCash = economy.cash;
    talkLeon.onInteract({ player, hud, sound, weapons, police, economy });
    expect(economy.cash).toBe(initialCash + 100);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Leon'));
  });

  it('allows interacting with Butler Alfred and Buddy Dave in the Player Mansion', () => {
    const houseInteractables = interiors.interactables.get('player_house')!;
    const talkAlfred = houseInteractables.find((i) => i.id === 'talk_house_alfred')!;
    const talkDave = houseInteractables.find((i) => i.id === 'talk_house_dave')!;

    expect(talkAlfred).toBeDefined();
    expect(talkDave).toBeDefined();

    // Alfred serves champagne (+35 HP)
    player.health = 40;
    talkAlfred.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(75);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Alfred'));

    // Dave gives stunt cash (+$100)
    const startCash = economy.cash;
    talkDave.onInteract({ player, hud, sound, weapons, police, economy });
    expect(economy.cash).toBe(startCash + 100);
    expect(hud.showNotification).toHaveBeenCalledWith(expect.stringContaining('Dave'));
  });

  it('cycles dialogue lines on successive conversations with an NPC', () => {
    const resident = interiors.residents.find((r) => r.id === 'house_alfred')!;
    const initialIndex = resident.dialogueIndex;
    const houseInteractables = interiors.interactables.get('player_house')!;
    const talkAlfred = houseInteractables.find((i) => i.id === 'talk_house_alfred')!;

    talkAlfred.onInteract({ player, hud, sound, weapons, police, economy });
    expect(resident.dialogueIndex).toBe((initialIndex + 1) % resident.dialogues.length);
  });

  it('supports special role-based interactions across city building archetypes', () => {
    // 1. Chef Toshi in Noodle Bar gives ramen (+35 HP)
    player.health = 50;
    const noodleTalk = interiors.interactables
      .get('noodle_bar')!
      .find((i) => i.id === 'talk_noodle_toshi')!;
    noodleTalk.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(85);

    // 2. Master Kenji in Martial Dojo harmonizes energy (+30 HP)
    player.health = 40;
    const dojoTalk = interiors.interactables
      .get('martial_dojo')!
      .find((i) => i.id === 'talk_dojo_kenji')!;
    dojoTalk.onInteract({ player, hud, sound, weapons, police, economy });
    expect(player.health).toBe(70);

    // 3. Rick Rocket in Stunt Stadium gives commentary bonus (+$150)
    const currentCash = economy.cash;
    const stadTalk = interiors.interactables
      .get('stadium_lounge')!
      .find((i) => i.id === 'talk_stad_rick')!;
    stadTalk.onInteract({ player, hud, sound, weapons, police, economy });
    expect(economy.cash).toBe(currentCash + 150);
  });

  it('animates residents (dancing, bobbing & breathing) in the active interior', () => {
    interiors.currentInteriorId = 'nightclub';
    const dancers = interiors.residents.filter((r) => r.archetypeId === 'nightclub' && r.isDancing);
    expect(dancers.length).toBeGreaterThanOrEqual(2);

    const initialY = dancers[0].group.position.y;
    // Advance simulation time
    interiors.update(0.2, player, hud, input, sound, weapons, police, economy, camera);
    expect(dancers[0].group.position.y).not.toBe(initialY);
  });
});
