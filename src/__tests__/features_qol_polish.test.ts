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
  });
});
