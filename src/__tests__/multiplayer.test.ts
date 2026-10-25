import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RemotePlayer } from '../network/RemotePlayer';
import { NetMsgKind, PlayerSyncMsg } from '../network/NetProtocol';

describe('Multiplayer & RemotePlayer in GTA 7', () => {
  it('should initialize remote player mesh hidden by default', () => {
    const scene = new THREE.Scene();
    const remote = new RemotePlayer(scene);
    expect(remote.group.visible).toBe(false);
  });

  it('should apply player sync message and update target transforms', () => {
    const scene = new THREE.Scene();
    const remote = new RemotePlayer(scene);

    const msg: PlayerSyncMsg = {
      kind: NetMsgKind.PLAYER_SYNC,
      x: 100,
      y: 0.5,
      z: -50,
      heading: 1.57,
      speed: 24,
      mode: 'IN_CAR',
      carColor: 0x00d4ff,
      isBoosting: true,
      isDrifting: false,
      health: 95,
      t: Date.now(),
    };

    remote.applySync(msg);
    expect(remote.group.visible).toBe(true);
    expect(remote.targetX).toBe(100);
    expect(remote.targetZ).toBe(-50);
    expect(remote.speed).toBe(24);
    expect(remote.mode).toBe('IN_CAR');
  });

  it('should interpolate towards target transform over delta time', () => {
    const scene = new THREE.Scene();
    const remote = new RemotePlayer(scene);

    remote.targetX = 40;
    remote.targetZ = 80;
    remote.group.visible = true;

    remote.update(0.1);
    expect(remote.group.position.x).toBeGreaterThan(0);
    expect(remote.group.position.z).toBeGreaterThan(0);
  });
});
