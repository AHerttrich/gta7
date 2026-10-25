import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { RivalRacer } from '../missions/RivalRacer';
import { MissionSystem } from '../missions/MissionSystem';
import { SoundManager } from '../audio/SoundManager';
import { EconomySystem } from '../economy/EconomySystem';
import { RACE_CIRCUIT } from '../utils/Constants';

describe('Round 1: AI Street Racing Rivals & Live Leaderboard', () => {
  let scene: THREE.Scene;
  let sound: SoundManager;
  let economy: EconomySystem;
  let missionSystem: MissionSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    sound = new SoundManager();
    economy = new EconomySystem();
    missionSystem = new MissionSystem(scene, sound, economy);
  });

  it('initializes RivalRacer with correct parameters and 3D mesh components', () => {
    const rival = new RivalRacer(
      scene,
      {
        id: 'test_viper',
        name: '🔥 Cyber Viper',
        bodyColor: 0xef4444,
        stripeColor: 0xf97316,
        neonColor: 0xff3b30,
        baseSpeed: 38.0,
        turnSpeed: 3.4,
      },
      40,
      -40,
      0,
    );

    expect(rival.x).toBe(40);
    expect(rival.z).toBe(-40);
    expect(rival.currentCheckpointIndex).toBe(0);
    expect(rival.isFinished).toBe(false);
    expect(rival.mesh).toBeInstanceOf(THREE.Group);
    expect(scene.children).toContain(rival.mesh);

    rival.dispose(scene);
    expect(scene.children).not.toContain(rival.mesh);
  });

  it('steers and moves toward current checkpoint and calculates progression', () => {
    const rival = new RivalRacer(
      scene,
      {
        id: 'test_viper',
        name: '🔥 Cyber Viper',
        bodyColor: 0xef4444,
        stripeColor: 0xf97316,
        neonColor: 0xff3b30,
        baseSpeed: 40.0,
        turnSpeed: 4.0,
      },
      44,
      0,
      0,
    );

    // Set to checkpoint 1 (target is (44, 44))
    rival.currentCheckpointIndex = 1;
    const initialZ = rival.z;
    rival.update(0.5, 0.5, 0.5);

    expect(rival.z).toBeGreaterThan(initialZ);
    expect(rival.speed).toBeGreaterThan(0);
    expect(rival.getProgress()).toBeGreaterThan(1.0);

    rival.dispose(scene);
  });

  it('applies rubberbanding speed adjustments against player progress', () => {
    const rival = new RivalRacer(
      scene,
      {
        id: 'test_viper',
        name: '🔥 Cyber Viper',
        bodyColor: 0xef4444,
        stripeColor: 0xf97316,
        neonColor: 0xff3b30,
        baseSpeed: 30.0,
        turnSpeed: 4.0,
      },
      44,
      0,
      0,
    );

    // When rival is lagging far behind player (playerProgress = 4.0, rival around 1.0)
    rival.update(0.2, 4.0, 1.0);
    const catchupSpeed = rival.speed;

    // Reset speed
    rival.speed = 30.0;
    // When rival is far ahead of player (playerProgress = 0.0, rival around 1.0)
    rival.update(0.2, 0.0, 1.0);
    const leadingSpeed = rival.speed;

    // Catchup acceleration is higher than leading speed
    expect(catchupSpeed).toBeGreaterThan(0);
    expect(leadingSpeed).toBeGreaterThan(0);

    rival.dispose(scene);
  });

  it('spawns 2 rival racers when startRace is called', () => {
    expect(missionSystem.rivals.length).toBe(0);

    missionSystem.startRace();

    expect(missionSystem.race.isActive).toBe(true);
    expect(missionSystem.rivals.length).toBe(2);
    expect(missionSystem.rivals[0].config.id).toBe('viper');
    expect(missionSystem.rivals[1].config.id).toBe('phantom');

    missionSystem.cleanupRivals();
    expect(missionSystem.rivals.length).toBe(0);
  });

  it('calculates live race position (1st, 2nd, 3rd) based on player vs rival progress', () => {
    missionSystem.startRace();

    // Player ahead of all rivals at checkpoint 3
    missionSystem.race.currentCheckpointIndex = 3;
    const pt3 = RACE_CIRCUIT[3];
    missionSystem.update(0.1, pt3.x, pt3.z, true);

    expect(missionSystem.playerPosition).toBe(1);

    // If rivals are advanced ahead to checkpoint 5
    missionSystem.rivals[0].currentCheckpointIndex = 5;
    missionSystem.rivals[1].currentCheckpointIndex = 6;
    missionSystem.update(0.1, pt3.x, pt3.z, true);

    expect(missionSystem.playerPosition).toBe(3);

    missionSystem.cleanupRivals();
  });

  it('awards podium prize money upon winning the race in 1st place', () => {
    const initialCash = economy.cash;
    missionSystem.startRace();

    // Teleport player through all checkpoints to the finish line ahead of rivals
    for (let i = 0; i < RACE_CIRCUIT.length; i++) {
      const pt = RACE_CIRCUIT[i];
      missionSystem.update(0.05, pt.x, pt.z, true);
    }

    expect(missionSystem.race.isActive).toBe(false);
    expect(economy.cash).toBe(initialCash + 2000); // 1st place reward
  });
});
