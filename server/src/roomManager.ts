import { GameState } from './types.js';
import { initGame } from './engine/trucoEngine.js';

export interface RoomPlayer {
  id: string; // ID persistente de jugador (UUID o clave generada por cliente/servidor)
  socketId: string;
  name: string;
  connected: boolean;
  disconnectTimeout?: NodeJS.Timeout;
}

export interface Room {
  id: string; // ej. TRUCO-492
  isPrivate: boolean;
  targetPoints: 15 | 30;
  players: Map<string, RoomPlayer>; // playerId -> RoomPlayer
  gameState: GameState | null;
  createdAt: number;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  // Índice para mapear socketId -> { roomId, playerId }
  private socketToPlayer: Map<string, { roomId: string; playerId: string }> = new Map();

  /**
   * Genera un código de sala corto y memorable como 'TRUCO-492'
   */
  public generateRoomCode(): string {
    let code: string;
    do {
      const num = Math.floor(100 + Math.random() * 900); // 100..999
      code = `TRUCO-${num}`;
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Crea una nueva sala (privada o pública)
   */
  public createRoom(
    isPrivate: boolean,
    targetPoints: 15 | 30 = 30,
    preferredCode?: string
  ): Room {
    const code = preferredCode?.toUpperCase() || this.generateRoomCode();
    const room: Room = {
      id: code,
      isPrivate,
      targetPoints,
      players: new Map(),
      gameState: null,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  /**
   * Busca una sala pública abierta con exactamente 1 jugador esperando rival
   */
  public findOpenPublicRoom(): Room | null {
    for (const room of this.rooms.values()) {
      if (!room.isPrivate && room.players.size === 1 && !room.gameState) {
        return room;
      }
    }
    return null;
  }

  /**
   * Obtiene una sala por ID
   */
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  /**
   * Asocia un jugador a una sala
   */
  public addPlayerToRoom(
    roomId: string,
    player: { id: string; socketId: string; name: string }
  ): { success: boolean; error?: string; room?: Room; gameStarted?: boolean } {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'La sala especificada no existe.' };
    }

    // Si el jugador ya estaba en la sala (reconexión)
    if (room.players.has(player.id)) {
      const existing = room.players.get(player.id)!;
      if (existing.disconnectTimeout) {
        clearTimeout(existing.disconnectTimeout);
        existing.disconnectTimeout = undefined;
      }
      existing.socketId = player.socketId;
      existing.connected = true;
      existing.name = player.name || existing.name;

      if (room.gameState && room.gameState.players[player.id]) {
        room.gameState.players[player.id].connected = true;
        room.gameState.players[player.id].socketId = player.socketId;
      }

      this.socketToPlayer.set(player.socketId, { roomId: room.id, playerId: player.id });
      return { success: true, room, gameStarted: false };
    }

    // Si la sala ya tiene 2 jugadores distintos, rechazar
    if (room.players.size >= 2) {
      return {
        success: false,
        error: 'room_full',
      };
    }

    // Agregar el nuevo jugador
    const newPlayer: RoomPlayer = {
      id: player.id,
      socketId: player.socketId,
      name: player.name,
      connected: true,
    };
    room.players.set(player.id, newPlayer);
    this.socketToPlayer.set(player.socketId, { roomId: room.id, playerId: player.id });

    // Si se completaron los 2 jugadores, iniciar la partida
    let gameStarted = false;
    if (room.players.size === 2 && !room.gameState) {
      const playersList = Array.from(room.players.values());
      room.gameState = initGame(
        room.id,
        { id: playersList[0].id, name: playersList[0].name, socketId: playersList[0].socketId },
        { id: playersList[1].id, name: playersList[1].name, socketId: playersList[1].socketId },
        room.targetPoints
      );
      gameStarted = true;
    }

    return { success: true, room, gameStarted };
  }

  /**
   * Obtiene la información del jugador a partir de su socket
   */
  public getPlayerBySocket(socketId: string) {
    return this.socketToPlayer.get(socketId);
  }

  /**
   * Busca la sala en la que se encuentra un jugador por su playerId
   */
  public getRoomByPlayer(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * Re-vincula un nuevo socketId a un playerId existente
   */
  public rebindSocket(socketId: string, playerId: string): { room: Room; player: RoomPlayer } | undefined {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return undefined;

    const player = room.players.get(playerId);
    if (!player) return undefined;

    player.socketId = socketId;
    player.connected = true;
    if (player.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
      player.disconnectTimeout = undefined;
    }

    if (room.gameState && room.gameState.players[playerId]) {
      room.gameState.players[playerId].connected = true;
      room.gameState.players[playerId].socketId = socketId;
    }

    this.socketToPlayer.set(socketId, { roomId: room.id, playerId });
    return { room, player };
  }

  /**
   * Maneja la desconexión temporal de un socket con tolerancia (45 segundos)
   */
  public handleDisconnect(
    socketId: string,
    onAbandon: (room: Room, abandonedPlayerId: string, remainingPlayerId: string) => void
  ): { room?: Room; player?: RoomPlayer } {
    const mapping = this.socketToPlayer.get(socketId);
    if (!mapping) return {};

    const { roomId, playerId } = mapping;
    this.socketToPlayer.delete(socketId);

    const room = this.rooms.get(roomId);
    if (!room) return {};

    const player = room.players.get(playerId);
    if (!player) return {};

    player.connected = false;

    if (room.gameState && room.gameState.players[playerId]) {
      room.gameState.players[playerId].connected = false;
    }

    // Tolerancia de 45 segundos para reconectarse
    const GRACE_PERIOD_MS = 45000;
    player.disconnectTimeout = setTimeout(() => {
      // Si transcurrió el tiempo sin reconectar, se declara abandono
      if (!player.connected) {
        const remainingPlayer = Array.from(room.players.values()).find(
          (p) => p.id !== playerId
        );
        if (remainingPlayer) {
          onAbandon(room, playerId, remainingPlayer.id);
        }
        // Limpiar la sala si terminó o quedó desierta
        this.rooms.delete(room.id);
      }
    }, GRACE_PERIOD_MS);

    return { room, player };
  }

  /**
   * Elimina una sala
   */
  public removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      for (const p of room.players.values()) {
        if (p.disconnectTimeout) clearTimeout(p.disconnectTimeout);
      }
      this.rooms.delete(roomId);
    }
  }
}
