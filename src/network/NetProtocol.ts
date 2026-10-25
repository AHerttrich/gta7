export enum NetMsgKind {
  PLAYER_SYNC = 'player_sync',
  COMBAT_FIRE = 'combat_fire',
  VEHICLE_RAM = 'vehicle_ram',
  CHAT = 'chat',
  PING = 'ping',
  PONG = 'pong',
}

export interface PlayerSyncMsg {
  kind: NetMsgKind.PLAYER_SYNC;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  mode: 'IN_CAR' | 'ON_FOOT';
  carColor: number;
  isBoosting: boolean;
  isDrifting: boolean;
  health: number;
  t: number;
}

export interface CombatFireMsg {
  kind: NetMsgKind.COMBAT_FIRE;
  weaponId: string;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export interface VehicleRamMsg {
  kind: NetMsgKind.VEHICLE_RAM;
  damage: number;
  pushX: number;
  pushZ: number;
}

export interface ChatMsg {
  kind: NetMsgKind.CHAT;
  sender: string;
  text: string;
}

export interface PingMsg {
  kind: NetMsgKind.PING;
  t: number;
}

export interface PongMsg {
  kind: NetMsgKind.PONG;
  t: number;
}

export type NetMessage =
  PlayerSyncMsg | CombatFireMsg | VehicleRamMsg | ChatMsg | PingMsg | PongMsg;
