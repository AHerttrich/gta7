import * as THREE from 'three';
import { EconomySystem } from '../economy/EconomySystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { SoundManager } from '../audio/SoundManager';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';

export type HeistStage =
  'IDLE' | 'SETUP' | 'HACKING' | 'VAULT_BREACH' | 'LOOTING' | 'ESCAPE' | 'COMPLETED';

export class HeistSystem {
  public group: THREE.Group;
  public bankX: number = 44;
  public bankZ: number = 245;
  public stage: HeistStage = 'IDLE';

  public vaultDoor: THREE.Mesh;
  public c4Timer: number = 0;
  public lootRemaining: number = 4;
  public totalHeistLoot: number = 25000;
  public lootCooldown: number = 0;
  public hackTimer: number = 3.0;

  private scene: THREE.Scene;
  private economy: EconomySystem;
  private police: PoliceSystem;
  private sound: SoundManager;

  constructor(
    scene: THREE.Scene,
    economy: EconomySystem,
    police: PoliceSystem,
    sound: SoundManager,
  ) {
    this.scene = scene;
    this.economy = economy;
    this.police = police;
    this.sound = sound;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.vaultDoor = this.buildBankAndVault();
  }

  private buildBankAndVault(): THREE.Mesh {
    const x = this.bankX;
    const z = this.bankZ;

    // 1. Bank of Los Cyberos Main Hall
    const bankGeo = new THREE.BoxGeometry(26, 14, 28);
    const bankMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.2,
    });
    const bank = new THREE.Mesh(bankGeo, bankMat);
    bank.position.set(x, 7, z);
    this.group.add(bank);

    // Glowing Sign: BANK OF LOS CYBEROS
    const signGeo = new THREE.BoxGeometry(20, 1.8, 0.4);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x10b981 }); // Emerald Green
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(x, 13.5, z - 14.2);
    this.group.add(sign);

    // 2. Heavy 20-Ton Subterranean Vault Door
    const vaultGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.6, 24);
    vaultGeo.rotateZ(Math.PI / 2);
    const vaultMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.95,
      roughness: 0.15,
    });
    const vaultDoor = new THREE.Mesh(vaultGeo, vaultMat);
    vaultDoor.position.set(x, 2.8, z);
    this.group.add(vaultDoor);

    return vaultDoor;
  }

  public startHeist(): boolean {
    if (this.stage !== 'IDLE' && this.stage !== 'COMPLETED') return false;

    this.stage = 'SETUP';
    this.lootRemaining = 4;
    this.lootCooldown = 0;
    this.hackTimer = 3.0;
    this.vaultDoor.position.set(this.bankX, 2.8, this.bankZ);
    this.vaultDoor.rotation.set(0, 0, 0);
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: '🏦 BANKÜBERFALL GESTARTET! Parke den Fluchtwagen in der Seitengasse!',
    });
    return true;
  }

  public completeSetup(): void {
    if (this.stage !== 'SETUP') return;
    this.stage = 'HACKING';
    this.hackTimer = 3.0;
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: '💻 HACKE DIE ALARMANLAGE! Überbrücke das Sicherheitsgitter!',
    });
  }

  public completeHack(): void {
    if (this.stage !== 'HACKING') return;
    this.stage = 'VAULT_BREACH';
    this.c4Timer = 4.0; // 4s countdown
    this.sound.playCheckpointChime();
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: '💣 C4 SPRENGLADUNG PLATZIERT! In Deckung gehen! Zündung in 4 Sekunden!',
    });
  }

  public update(dt: number, playerX: number, playerZ: number, inCar: boolean): void {
    // Proximity trigger to start heist
    const distToBank = Math.hypot(playerX - this.bankX, playerZ - (this.bankZ - 14));
    if (this.stage === 'IDLE' && distToBank < 7.0 && !inCar) {
      this.startHeist();
    }

    // Auto progression for SETUP if in getaway alley or at bank door
    if (this.stage === 'SETUP') {
      const distToAlley = Math.hypot(playerX - (this.bankX + 18), playerZ - this.bankZ);
      if (distToAlley < 8.0 || distToBank < 5.0) {
        this.completeSetup();
      }
    }

    // Auto progression for HACKING
    if (this.stage === 'HACKING') {
      if (distToBank < 10.0) {
        this.hackTimer -= dt;
        if (this.hackTimer <= 0) {
          this.completeHack();
        }
      }
    }

    // 1. Vault C4 Countdown & Detonation
    if (this.stage === 'VAULT_BREACH') {
      this.c4Timer -= dt;
      if (this.c4Timer <= 0) {
        this.detonateVault();
      }
    }

    // 2. Looting phase check
    if (this.stage === 'LOOTING') {
      this.lootCooldown -= dt;
      const dToVault = Math.hypot(playerX - this.bankX, playerZ - this.bankZ);
      if (dToVault < 4.5 && this.lootCooldown <= 0) {
        this.lootCooldown = 0.08;
        this.lootRemaining--;
        this.sound.playCheckpointChime();

        if (this.lootRemaining <= 0) {
          // All loot gathered! Escape!
          this.stage = 'ESCAPE';
          this.police.setWantedLevel(5); // Maximum Police lockdown!
          this.sound.playFanfare();
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: '💰 BEUTE EINGESACKT ($25.000)! 5-STERNE-ALARM! FLIEHE ZUR WERKSTATT!',
          });
        } else {
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: `💰 Goldbarren eingepackt! Noch ${this.lootRemaining} Säcke im Tresor!`,
          });
        }
      }
    }

    // 3. Escape Phase Check (Reach 0 stars or visit Pay 'n' Spray)
    if (this.stage === 'ESCAPE') {
      if (this.police.wantedLevel === 0) {
        this.stage = 'COMPLETED';
        this.vaultDoor.position.set(this.bankX, 2.8, this.bankZ);
        this.vaultDoor.rotation.set(0, 0, 0);
        this.economy.addCash(this.totalHeistLoot);
        this.sound.playFanfare();
        eventBus.emit(EVENTS.NOTIFICATION, {
          text: `🏆 HEIST ERFOLGREICH! Beute aufgeteilt: +$${this.totalHeistLoot.toLocaleString()}!`,
        });
      }
    }
  }

  public detonateVault(): void {
    this.stage = 'LOOTING';
    this.sound.playExplosion();

    // Blast vault door off hinges
    this.vaultDoor.position.y += 2.5;
    this.vaultDoor.position.z += 5.0;
    this.vaultDoor.rotation.x = Math.PI / 3;

    eventBus.emit(EVENTS.NOTIFICATION, {
      text: '💥 TRESOR-TÜR AUFGESPRENGT! Sammle das Gold und die Geldbeutel!',
    });
  }
}
