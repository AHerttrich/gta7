export const GAME_TITLE = 'GTA 7';
export const VERSION = '0.3.0';

// Vehicle tuning
export const VEHICLE_CONFIG = {
  ACCELERATION: 22.0,
  NITRO_ACCELERATION: 48.0,
  MAX_FORWARD_SPEED: 48.0, // ~173 km/h
  MAX_NITRO_SPEED: 68.0, // ~245 km/h!
  MAX_REVERSE_SPEED: 14.0, // ~50 km/h
  BRAKE_DECELERATION: 32.0,
  HANDBRAKE_DECELERATION: 18.0,
  DRAG_COEFFICIENT: 0.003,
  ROLLING_FRICTION: 2.2,
  MAX_STEER_ANGLE: 0.62,
  STEER_SPEED: 4.8,
  STEER_RETURN_SPEED: 6.5,
  DRIFT_GRIP_LOSS: 0.55,
  CAR_LENGTH: 4.4,
  CAR_WIDTH: 2.0,
  CAR_HEIGHT: 1.3,
  WHEEL_RADIUS: 0.4,
  MAX_HEALTH: 100,
  MAX_NITRO: 100,
  NITRO_CONSUMPTION: 35, // % per second
  NITRO_RECHARGE: 15, // % per second when not boosting
} as const;

// Player on foot config
export const PLAYER_CONFIG = {
  WALK_SPEED: 8.5,
  RUN_SPEED: 16.0,
  JUMP_VELOCITY: 8.5,
  TURN_SPEED: 6.0,
  INTERACTION_RADIUS: 4.0,
  MAX_HEALTH: 100,
} as const;

// City Layout Configuration
export const CITY_CONFIG = {
  BLOCK_SIZE: 70.0,
  ROAD_WIDTH: 18.0,
  GRID_SIZE: 7, // 7x7 blocks (expanded city area)
  SIDEWALK_WIDTH: 3.0,
  SIDEWALK_HEIGHT: 0.25,
  GARAGE_X: -44,
  GARAGE_Z: 44,
  RACE_START_X: 44,
  RACE_START_Z: -44,
  MAX_BOUND_X_POS: 395.0,
  MAX_BOUND_X_NEG: -435.0,
  MAX_BOUND_Z: 395.0,
} as const;

// Camera Presets
export const CAMERA_CONFIG = {
  FOV: 65,
  NEAR: 0.1,
  FAR: 1000,
  CHASE_DISTANCE: 8.5,
  CHASE_HEIGHT: 3.5,
  LOOK_AHEAD_DISTANCE: 4.0,
  FOOT_DISTANCE: 5.0,
  FOOT_HEIGHT: 2.5,
  SMOOTH_FACTOR: 0.14,
} as const;

// Street Race Checkpoint Circuit coordinates
export const RACE_CIRCUIT: { x: number; z: number }[] = [
  { x: 44, z: -44 },
  { x: 44, z: 44 },
  { x: 132, z: 44 },
  { x: 132, z: 132 },
  { x: -44, z: 132 },
  { x: -44, z: -44 },
  { x: -132, z: -44 },
  { x: -132, z: -132 },
  { x: 44, z: -132 },
  { x: 44, z: -44 }, // Finish Line!
];

// Available Cars in Shop / Garage
export interface CarModelData {
  id: string;
  name: string;
  price: number;
  color: number;
  topSpeed: number;
  acceleration: number;
  unlocked: boolean;
}

export const CAR_CATALOG: CarModelData[] = [
  {
    id: 'starter_muscle',
    name: 'Viper GT (Starter)',
    price: 0,
    color: 0xe62429, // Cherry Red
    topSpeed: 48,
    acceleration: 22,
    unlocked: true,
  },
  {
    id: 'cyber_sport',
    name: 'Cyber Phantom 77',
    price: 2500,
    color: 0x00d4ff, // Cyan Neon
    topSpeed: 58,
    acceleration: 28,
    unlocked: false,
  },
  {
    id: 'golden_hypercar',
    name: 'Ares Gold Supreme',
    price: 7500,
    color: 0xffd700, // Gold
    topSpeed: 68,
    acceleration: 35,
    unlocked: false,
  },
];

// Available Weapons in Shop
export interface WeaponData {
  id: string;
  name: string;
  price: number;
  damage: number;
  ammo: number;
  maxAmmo: number;
  fireRate: number;
  isRanged: boolean;
  unlocked: boolean;
}

export const WEAPON_CATALOG: WeaponData[] = [
  {
    id: 'fists',
    name: 'Faustschlag',
    price: 0,
    damage: 15,
    ammo: Infinity,
    maxAmmo: Infinity,
    fireRate: 0.4,
    isRanged: false,
    unlocked: true,
  },
  {
    id: 'baseball_bat',
    name: 'Baseballschläger',
    price: 150,
    damage: 40,
    ammo: Infinity,
    maxAmmo: Infinity,
    fireRate: 0.5,
    isRanged: false,
    unlocked: false,
  },
  {
    id: 'pistol',
    name: 'Pistole 9mm',
    price: 600,
    damage: 55,
    ammo: 60,
    maxAmmo: 120,
    fireRate: 0.25,
    isRanged: true,
    unlocked: false,
  },
  {
    id: 'rocket_launcher',
    name: 'RPG Raketenwerfer',
    price: 3000,
    damage: 250,
    ammo: 10,
    maxAmmo: 20,
    fireRate: 1.2,
    isRanged: true,
    unlocked: false,
  },
];

// Events
export const EVENTS = {
  SPEED_UPDATE: 'vehicle:speed',
  VEHICLE_HEALTH: 'vehicle:health',
  VEHICLE_ENTER: 'vehicle:enter',
  VEHICLE_EXIT: 'vehicle:exit',
  VEHICLE_DESTROYED: 'vehicle:destroyed',
  PLAYER_HEALTH: 'player:health',
  WANTED_CHANGE: 'police:wanted_change',
  MONEY_CHANGE: 'economy:money_change',
  JOB_START: 'job:start',
  JOB_COMPLETE: 'job:complete',
  NOTIFICATION: 'ui:notification',
  SHOP_TOGGLE: 'shop:toggle',
  WEAPON_CHANGE: 'weapon:change',
  WEAPON_FIRE: 'weapon:fire',
  EXPLOSION: 'combat:explosion',
  NITRO_CHANGE: 'vehicle:nitro_change',
  STUNT_COMPLETE: 'mission:stunt_complete',
  RACE_UPDATE: 'mission:race_update',
  RACE_COMPLETE: 'mission:race_complete',
} as const;
