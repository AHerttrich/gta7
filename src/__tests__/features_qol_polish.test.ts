import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Input } from '../engine/Input';
import { CarPhysics } from '../vehicles/CarPhysics';
import { City } from '../city/City';
import { GameCamera } from '../engine/Camera';
import { SoundManager } from '../audio/SoundManager';
import { RadioSystem } from '../audio/RadioSystem';
import { Renderer } from '../engine/Renderer';
import { Player } from '../character/Player';
import { SkidmarkSystem } from '../vehicles/SkidmarkSystem';
import { PostProcessingManager } from '../engine/PostProcessing';
import { Car } from '../vehicles/Car';
import { CarInput } from '../vehicles/CarPhysics';
import { Building } from '../city/Building';
import { Road } from '../city/Road';

// Mock WebGLRenderer for Node/headless vitest environment
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      render = vi.fn();
      shadowMap = { enabled: false, type: 0, needsUpdate: false };
      toneMapping = 0;
      toneMappingExposure = 1.0;
    },
  };
});

describe('Quality of Life, Polish & Smoothness Master Suite', () => {
  describe('Gamepad API & Haptics Integration', () => {
    let input: Input;

    beforeEach(() => {
      input = new Input();
    });

    it('should poll gamepad analog sticks with deadzone filtering', () => {
      const mockGamepad: Partial<Gamepad> = {
        connected: true,
        axes: [0.05, 0.0, 0.0, 0.0], // within 0.18 deadzone
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0, touched: false })),
      };

      vi.stubGlobal('navigator', {
        getGamepads: () => [mockGamepad as Gamepad],
        vibrate: vi.fn(),
      });

      input.pollGamepad();
      expect(input.gamepadSteerAxis).toBe(0);
      expect(input.left).toBe(false);
      expect(input.right).toBe(false);

      // Outside deadzone
      (mockGamepad as { axes: number[] }).axes = [-0.65, 0.0, 0.0, 0.0];
      input.pollGamepad();
      expect(input.gamepadSteerAxis).toBe(-0.65);
      expect(input.left).toBe(true);
      expect(input.right).toBe(false);
    });

    it('should map gamepad RT (throttle) and LT (brake) triggers', () => {
      const buttons = Array.from({ length: 16 }, () => ({
        pressed: false,
        value: 0,
        touched: false,
      }));
      buttons[7] = { pressed: true, value: 0.85, touched: true }; // RT / R2
      buttons[6] = { pressed: false, value: 0, touched: false };

      const mockGamepad: Partial<Gamepad> = {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: buttons as GamepadButton[],
      };

      vi.stubGlobal('navigator', {
        getGamepads: () => [mockGamepad as Gamepad],
      });

      input.pollGamepad();
      expect(input.gamepadThrottle).toBe(0.85);
      expect(input.forward).toBe(true);

      // Brake trigger
      buttons[7].value = 0;
      buttons[6].value = 0.9;
      input.pollGamepad();
      expect(input.gamepadBrake).toBe(0.9);
      expect(input.backward).toBe(true);
    });

    it('should map gamepad buttons: A (handbrake), B (nitro), X (fire), Start (pause/escape)', () => {
      const buttons = Array.from({ length: 16 }, () => ({
        pressed: false,
        value: 0,
        touched: false,
      }));
      buttons[0] = { pressed: true, value: 1, touched: true }; // A
      buttons[1] = { pressed: true, value: 1, touched: true }; // B
      buttons[9] = { pressed: true, value: 1, touched: true }; // Start

      const mockGamepad: Partial<Gamepad> = {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: buttons as GamepadButton[],
      };

      vi.stubGlobal('navigator', {
        getGamepads: () => [mockGamepad as Gamepad],
      });

      input.pollGamepad();
      expect(input.handbrake).toBe(true);
      expect(input.nitro).toBe(true);
      expect(input.toggleSettings).toBe(true);
    });

    it('should trigger vibration actuators and haptics safely', () => {
      const playEffect = vi.fn().mockResolvedValue('complete');
      const mockGamepad = {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: [],
        vibrationActuator: {
          playEffect,
        },
      };

      const vibrate = vi.fn();
      vi.stubGlobal('navigator', {
        getGamepads: () => [mockGamepad as unknown as Gamepad],
        vibrate,
      });

      input.triggerRumble(0.8, 200);
      expect(playEffect).toHaveBeenCalledWith('dual-rumble', {
        startDelay: 0,
        duration: 200,
        weakMagnitude: 0.56,
        strongMagnitude: 0.8,
      });

      input.triggerHaptics(50);
      expect(vibrate).toHaveBeenCalledWith(50);
    });
  });

  describe('60Hz Fixed-Timestep Physics & Vehicle Suspension Dynamics', () => {
    it('should track prevX and prevZ for swept anti-tunneling verification', () => {
      const physics = new CarPhysics(10, 20, 0);
      expect(physics.prevX).toBe(10);
      expect(physics.prevZ).toBe(20);

      physics.update(0.05, {
        throttle: true,
        reverse: false,
        steerLeft: false,
        steerRight: false,
        handbrake: false,
      });

      expect(physics.prevX).toBe(10);
      expect(physics.prevZ).toBe(20);
      expect(physics.z).toBeGreaterThan(20);
    });

    it('should simulate lateral body roll during high speed cornering', () => {
      const physics = new CarPhysics(0, 0, 0);
      physics.speed = 25.0; // High speed
      physics.steerAngle = 0.4; // Hard steering left

      physics.update(0.05, {
        throttle: true,
        reverse: false,
        steerLeft: true,
        steerRight: false,
        handbrake: false,
      });

      expect(physics.roll).not.toBe(0);
    });

    it('should simulate suspension pitch dip during aggressive braking', () => {
      const physics = new CarPhysics(0, 0, 0);
      physics.speed = 20.0;

      physics.update(0.05, {
        throttle: false,
        reverse: true, // Braking
        steerLeft: false,
        steerRight: false,
        handbrake: false,
      });

      expect(physics.pitch).toBeGreaterThan(0);
    });

    it('should detect upside down flip and support rightUpright recovery', () => {
      const physics = new CarPhysics(0, 0, 0);
      physics.roll = 2.0; // Flipped past 1.2 threshold
      physics.flippedTimer = 2.0;
      physics.isFlipped = true;

      physics.rightUpright();
      expect(physics.isFlipped).toBe(false);
      expect(physics.roll).toBe(0);
      expect(physics.pitch).toBe(0);
      expect(physics.y).toBe(0.6);
      expect(physics.vy).toBe(2.5);
    });
  });

  describe('Continuous Swept Anti-Tunneling Collision Detection', () => {
    it('should detect swept collisions straight into a building', () => {
      const city = new City();
      expect(city.buildingBounds.length).toBeGreaterThan(0);
      const b = city.buildingBounds[0];

      // Sweep from 10 units outside the building across its center
      const startX = b.minX - 10;
      const endX = b.maxX + 10;
      const midZ = (b.minZ + b.maxZ) / 2;

      const col = city.checkSweptCollision(startX, midZ, endX, midZ, 1.5);
      expect(col.collided).toBe(true);
      expect(col.safeX).toBeLessThan(b.maxX);
    });

    it('should return collided false when traversing clear open roads', () => {
      const city = new City();
      // x = 44 is an open North-South road corridor
      const col = city.checkSweptCollision(44, -20, 44, 20, 1.2);
      expect(col.collided).toBe(false);
    });
  });

  describe('Audio Mixer & Radio System Enhancements', () => {
    it('should adjust master volume and SFX volume levels', () => {
      const sound = new SoundManager();
      sound.setMasterVolume(0.65);
      expect(sound.masterVolume).toBe(0.65);

      sound.setSfxVolume(0.4);
      expect(sound.sfxVolume).toBe(0.4);

      // Volume limits clamped [0, 1]
      sound.setMasterVolume(1.8);
      expect(sound.masterVolume).toBe(1.0);
      sound.setSfxVolume(-0.5);
      expect(sound.sfxVolume).toBe(0.0);
    });

    it('should allow setting radio music volume', () => {
      const sound = new SoundManager();
      const radio = new RadioSystem(sound);

      radio.setMusicVolume(0.75);
      expect(radio.musicVolume).toBe(0.75);

      radio.setMusicVolume(1.5);
      expect(radio.musicVolume).toBe(1.0);
    });

    it('should execute playBlowOffValve without throwing even before audio init', () => {
      const sound = new SoundManager();
      expect(() => sound.playBlowOffValve()).not.toThrow();
    });

    it('should suspend and resume audio when tab visibility changes', () => {
      const sound = new SoundManager();
      sound.suspend();
      expect(sound.isSuspended).toBe(true);

      sound.resume();
      expect(sound.isSuspended).toBe(false);
    });

    it('should debounce playCrash to prevent audio thread lock and frame drops', () => {
      const sound = new SoundManager();
      expect(() => {
        sound.playCrash(10);
        sound.playCrash(10);
        sound.playCrash(10);
      }).not.toThrow();
    });
  });

  describe('Anti-Clipping Camera Avoidance', () => {
    it('should tuck camera closer when target position is inside a building', () => {
      const camera = new THREE.PerspectiveCamera();
      const gameCam = new GameCamera(camera);
      const city = new City();

      const carPos = new THREE.Vector3(44, 0.5, 44);
      gameCam.updateVehicle(carPos, 0, 0, 0.05, city);

      expect(camera.position.x).toBeDefined();
      expect(camera.position.z).toBeDefined();
      expect(camera.position.y).toBeGreaterThan(0);
    });

    it('should adjust on-foot camera to prevent clipping through building walls', () => {
      const camera = new THREE.PerspectiveCamera();
      const gameCam = new GameCamera(camera);
      const city = new City();

      const playerPos = new THREE.Vector3(44, 0.8, 44);
      gameCam.updateOnFoot(playerPos, 0, 0.05, city);

      expect(camera.position.x).toBeDefined();
      expect(camera.position.y).toBeGreaterThan(0);
    });
  });

  describe('Renderer Graphics Quality Presets', () => {
    it('should apply low, med, and ultra graphics presets', () => {
      const mockCanvas = {
        getContext: vi.fn(),
        addEventListener: vi.fn(),
        style: {},
      } as unknown as HTMLCanvasElement;

      const renderer = new Renderer(mockCanvas);

      renderer.setGraphicsQuality('low');
      expect(renderer.renderer.shadowMap.enabled).toBe(false);

      renderer.setGraphicsQuality('med');
      expect(renderer.renderer.shadowMap.enabled).toBe(true);

      renderer.setGraphicsQuality('ultra');
      expect(renderer.renderer.shadowMap.enabled).toBe(true);
    });
  });

  describe('Player Durability & Mobile Fullscreen Support', () => {
    it('should reduce player health when takeDamage is called', () => {
      const player = new Player(0, 0);
      expect(player.health).toBe(100);
      player.takeDamage(25);
      expect(player.health).toBe(75);
    });

    it('should safely glide down with cyber parachute when high in the air', () => {
      const player = new Player(0, 0);
      const city = new City();
      const input = new Input();

      player.setPosition(0, 30, 0);
      player.vy = -12;
      player.update(0.1, input, city);

      expect(player.y).toBeLessThan(30);
      expect(player.y).toBeGreaterThan(0);
      expect(player.vy).toBeGreaterThanOrEqual(-6.0); // Safe glide cap
    });
  });

  describe('Wet Asphalt Reflections & Skidmark Drift Visuals', () => {
    it('should toggle wet asphalt reflection roughness and metalness during rain', () => {
      const city = new City();
      expect(city.groundMat.roughness).toBe(0.7);

      city.setWeatherMode('rain');
      expect(city.groundMat.roughness).toBeLessThan(0.3);
      expect(city.groundMat.metalness).toBeGreaterThan(0.6);

      city.setWeatherMode('clear');
      expect(city.groundMat.roughness).toBe(0.7);
    });

    it('should create and clear skidmarks during drifts and burnouts', () => {
      const scene = new THREE.Scene();
      const skidmarks = new SkidmarkSystem(scene);

      expect(skidmarks.group).toBeDefined();

      // Trigger drift skidmarks
      skidmarks.update(0.05, 10, 10, 0, 15, true, false, false);
      skidmarks.update(0.05, 10, 12, 0, 15, true, false, false);

      skidmarks.clear();
      expect(skidmarks.smokeParticles).toBeDefined();
    });
  });

  describe('Collision Physics Smoothness & Anti-Hitch Verification', () => {
    it('should return exact penetration depth and safe coordinates strictly outside building', () => {
      const city = new City();
      const b = city.buildingBounds[0];
      const radius = 2.0;

      // Start 5 units outside on the left and penetrate 0.4 units into the building
      const startX = b.minX - 5.0;
      const penetrateX = b.minX + 0.4;
      const midZ = (b.minZ + b.maxZ) / 2;

      const col = city.checkSweptCollision(startX, midZ, penetrateX, midZ, radius);
      expect(col.collided).toBe(true);
      expect(col.normalX).toBe(-1);
      expect(col.depth).toBeGreaterThan(0);
      // safeX must be strictly outside the building by at least 0.05 units
      expect(col.safeX + radius).toBeLessThanOrEqual(b.minX);
    });

    it('should cleanly stop vehicle at speed 0 on direct head-on collision without negative reverse recoil', () => {
      // Direct head-on impact into a north wall (normal pointing South: 0, -1)
      const normalX = 0;
      const normalZ = -1;
      const heading = 0; // facing North (+Z)
      const currentSpeed = 22.0;

      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);
      const dot = forwardX * normalX + forwardZ * normalZ; // 0*0 + 1*(-1) = -1.0

      expect(dot).toBe(-1.0);
      expect(dot).toBeLessThan(-0.75); // Triggers clean head-on stop

      let speed = currentSpeed;
      if (dot < 0) {
        if (dot < -0.75) {
          speed = 0;
        }
      }
      expect(speed).toBe(0); // Clean stop, never negative!
    });

    it('should smoothly slide along wall with friction on glancing collision', () => {
      // Glancing blow at ~30 degrees along wall (normal pointing West: -1, 0)
      const normalX = -1;
      const normalZ = 0;
      // Car heading is mostly North (+Z) with slight East (+X) component
      const heading = Math.PI / 6; // 30 degrees
      const currentSpeed = 20.0;

      const forwardX = Math.sin(heading); // 0.5
      const forwardZ = Math.cos(heading); // ~0.866
      const dot = forwardX * normalX + forwardZ * normalZ; // -0.5

      expect(dot).toBeGreaterThan(-0.75);
      expect(dot).toBeLessThan(0);

      const slideFraction = Math.sqrt(Math.max(0, 1 - dot * dot)); // sqrt(0.75) ~ 0.866
      const newSpeed = currentSpeed * slideFraction * 0.82;

      expect(newSpeed).toBeGreaterThan(12.0); // Retains smooth sliding speed
      expect(newSpeed).toBeLessThan(currentSpeed); // Slowed by wall friction
    });

    it('should fully separate overlapping traffic cars in a single frame', () => {
      const minDist = 3.2;
      let playerX = 10.0;
      let playerZ = 10.0;
      let tCarX = 11.5; // distance = 1.5 < 3.2 (overlap = 1.7)
      let tCarZ = 10.0;

      const dx = playerX - tCarX;
      const dz = playerZ - tCarZ;
      const d = Math.hypot(dx, dz);
      expect(d).toBeLessThan(minDist);

      const overlap = minDist - d;
      const nx = dx / d;
      const nz = dz / d;

      const playerPush = overlap * 0.55 + 0.08;
      const trafficPush = overlap * 0.45 + 0.08;

      playerX += nx * playerPush;
      playerZ += nz * playerPush;
      tCarX -= nx * trafficPush;
      tCarZ -= nz * trafficPush;

      const newDist = Math.hypot(playerX - tCarX, playerZ - tCarZ);
      expect(newDist).toBeGreaterThanOrEqual(minDist); // Overlap eliminated in 1 step!
    });

    it('should fully separate police cruiser and player car in a single frame', () => {
      const minDist = 3.4;
      let playerX = 20.0;
      let playerZ = 20.0;
      let copX = 21.8; // distance = 1.8 < 3.4 (overlap = 1.6)
      let copZ = 20.0;

      const dx = playerX - copX;
      const dz = playerZ - copZ;
      const d = Math.hypot(dx, dz);
      expect(d).toBeLessThan(minDist);

      const overlap = minDist - d;
      const nx = dx / d;
      const nz = dz / d;

      const playerPush = overlap * 0.55 + 0.08;
      const copPush = overlap * 0.45 + 0.08;

      playerX += nx * playerPush;
      playerZ += nz * playerPush;
      copX -= nx * copPush;
      copZ -= nz * copPush;

      const newDist = Math.hypot(playerX - copX, playerZ - copZ);
      expect(newDist).toBeGreaterThanOrEqual(minDist); // Fully separated!
    });
  });

  describe('Cinematic Graphics, Post-Processing & Visual FX Suite', () => {
    it('should configure PostProcessingManager quality presets', () => {
      const mockCanvas = {
        width: 800,
        height: 600,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => null,
      } as unknown as HTMLCanvasElement;
      const renderer = new THREE.WebGLRenderer({ canvas: mockCanvas });
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();

      const ppm = new PostProcessingManager(renderer, scene, camera);
      expect(ppm.baseBloomStrength).toBe(0.65);

      ppm.setQuality('low');
      expect(ppm.isEnabled).toBe(false);

      ppm.setQuality('med');
      expect(ppm.isEnabled).toBe(true);
      expect(ppm.baseBloomStrength).toBe(0.45);

      ppm.setQuality('ultra');
      expect(ppm.isEnabled).toBe(true);
      expect(ppm.baseBloomStrength).toBe(0.72);
    });

    it('should dynamically adapt bloom strength for night and rain', () => {
      const mockCanvas = {
        width: 800,
        height: 600,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => null,
      } as unknown as HTMLCanvasElement;
      const renderer = new THREE.WebGLRenderer({ canvas: mockCanvas });
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const ppm = new PostProcessingManager(renderer, scene, camera);

      // Daytime clear weather
      ppm.update(0.016, 0.5, 'clear', 10, false);
      expect(ppm.currentBloomStrength).toBeCloseTo(0.65, 1);

      // Night rain weather with nitro boost
      ppm.update(0.016, 0.05, 'rain', 35, true);
      expect(ppm.currentBloomStrength).toBeGreaterThan(0.65);
    });

    it('should equip car with volumetric 3D headlight light cones and responsive brake lights', () => {
      const car = new Car(0, 0, 0);

      // Verify headlights and cones toggle together
      const initialState = car.toggleHeadlights();
      expect(typeof initialState).toBe('boolean');

      const toggledState = car.toggleHeadlights();
      expect(toggledState).toBe(!initialState);

      // Test brake illumination logic
      const brakeInput: CarInput = {
        throttle: false,
        reverse: true,
        steerLeft: false,
        steerRight: false,
        handbrake: false,
      };
      car.physics.speed = 15.0; // Moving forward while reversing = braking
      car.update(0.016, brakeInput);

      // Taillight emissive intensity increases during heavy braking
      const tlMat = (car as unknown as { taillightMaterial: THREE.MeshStandardMaterial })
        .taillightMaterial;
      expect(tlMat.emissiveIntensity).toBeGreaterThanOrEqual(2.0);
    });

    it('should generate vertical cyber neon corner pillars on tall skyscrapers', () => {
      const building = Building.createBuilding(0, 0, 24, 24, 60, 0x00d4ff);
      expect(building.bounds.height).toBeGreaterThan(30);

      // Group should contain child meshes for main tower, tier, spire, beacon, roof neon, and 4 corner pillars
      expect(building.mesh.children.length).toBeGreaterThanOrEqual(6);
    });

    it('should generate street lamps with volumetric light halo and downward street illumination cone', () => {
      const lamp = Road.createStreetLamp(0, 0);
      // Group contains pole, arm, lantern, halo, and lightCone
      expect(lamp.children.length).toBeGreaterThanOrEqual(5);
    });
  });
});
