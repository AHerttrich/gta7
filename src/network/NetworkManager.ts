import Peer, { DataConnection } from 'peerjs';
import { NetMessage, NetMsgKind } from './NetProtocol';

type MessageHandler = (msg: NetMessage) => void;
type StatusHandler = (status: 'connected' | 'disconnected' | 'error', info?: string) => void;

const ROOM_PREFIX = 'gta7-room-';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class NetworkManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private messageHandlers: MessageHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private _isHost = false;
  private _isConnected = false;
  private _roomCode = '';
  public pingMs: number = 0;

  get isHost(): boolean {
    return this._isHost;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get roomCode(): string {
    return this._roomCode;
  }

  /** Host a game session */
  public host(): Promise<string> {
    return new Promise((resolve, reject) => {
      this._isHost = true;
      this._roomCode = generateRoomCode();
      const peerId = ROOM_PREFIX + this._roomCode;

      try {
        this.peer = new Peer(peerId);

        this.peer.on('open', () => {
          resolve(this._roomCode);
        });

        this.peer.on('connection', (conn) => {
          this.conn = conn;
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          this.emitStatus('error', err.message);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Join an existing room by code */
  public join(roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._isHost = false;
      this._roomCode = roomCode.trim().toUpperCase();
      const guestId = 'gta7-guest-' + Math.random().toString(36).substring(2, 8);

      try {
        this.peer = new Peer(guestId);

        this.peer.on('open', () => {
          const hostId = ROOM_PREFIX + this._roomCode;
          this.conn = this.peer!.connect(hostId, { reliable: true });
          this.setupConnection(this.conn);
          resolve();
        });

        this.peer.on('error', (err) => {
          this.emitStatus('error', err.message);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private setupConnection(conn: DataConnection): void {
    conn.on('open', () => {
      this._isConnected = true;
      this.emitStatus('connected');
      this.startHeartbeat();
    });

    conn.on('data', (data) => {
      const msg = data as NetMessage;
      if (msg.kind === NetMsgKind.PING) {
        this.send({ kind: NetMsgKind.PONG, t: msg.t });
        return;
      }
      if (msg.kind === NetMsgKind.PONG) {
        this.pingMs = Math.round(performance.now() - msg.t);
        return;
      }
      for (const h of this.messageHandlers) {
        h(msg);
      }
    });

    conn.on('close', () => {
      this._isConnected = false;
      this.stopHeartbeat();
      this.emitStatus('disconnected');
    });

    conn.on('error', (err) => {
      this.emitStatus('error', err.message);
    });
  }

  public send(msg: NetMessage): void {
    if (this.conn && this.conn.open) {
      this.conn.send(msg);
    }
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return (): void => {
      const idx = this.messageHandlers.indexOf(handler);
      if (idx !== -1) this.messageHandlers.splice(idx, 1);
    };
  }

  public onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return (): void => {
      const idx = this.statusHandlers.indexOf(handler);
      if (idx !== -1) this.statusHandlers.splice(idx, 1);
    };
  }

  private emitStatus(status: 'connected' | 'disconnected' | 'error', info?: string): void {
    for (const h of this.statusHandlers) {
      h(status, info);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this._isConnected) {
        this.send({ kind: NetMsgKind.PING, t: performance.now() });
      }
    }, 2000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this._isConnected = false;
  }
}
