import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  ClientGameAction,
  ClientToServerEvents,
  ServerToClientEvents,
} from './types.js';
import { Room, RoomManager } from './roomManager.js';
import {
  callEnvido,
  callTruco,
  foldHand,
  playCard,
  respondBet,
  sanitizeGameStateForPlayer,
} from './engine/trucoEngine.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Configuración de Socket.io con CORS permisivo para desarrollo y producción
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();

/**
 * Transmite el estado del juego de forma autoritativa y sanitizada.
 * A cada jugador se le envían únicamente sus propias cartas; las del rival van ocultas.
 */
function broadcastGameState(room: Room) {
  if (!room.gameState) return;

  for (const player of room.players.values()) {
    if (player.connected && player.socketId) {
      const sanitizedState = sanitizeGameStateForPlayer(room.gameState, player.id);
      io.to(player.socketId).emit('game_state_sync', sanitizedState);
    }
  }
}

// Endpoint de salud
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

io.on('connection', (socket) => {
  console.log(`[Socket conectado] ${socket.id}`);

  // 1. Crear Sala (Privada o Pública)
  socket.on('create_room', ({ playerId: clientPlayerId, playerName, isPrivate, targetPoints = 30 }) => {
    try {
      const room = roomManager.createRoom(isPrivate, targetPoints);
      const playerId = clientPlayerId || socket.id;

      const result = roomManager.addPlayerToRoom(room.id, {
        id: playerId,
        socketId: socket.id,
        name: playerName || 'Jugador 1',
      });

      if (!result.success) {
        socket.emit('error_message', {
          code: 'CREATE_ROOM_FAILED',
          message: result.error || 'No se pudo crear la sala.',
        });
        return;
      }

      socket.join(room.id);
      socket.emit('room_created', { roomId: room.id, isPrivate });

      console.log(`[Sala Creada] ${room.id} (${isPrivate ? 'Privada' : 'Pública'}) por ${playerName} (${playerId})`);
    } catch (err: any) {
      socket.emit('error_message', {
        code: 'INTERNAL_ERROR',
        message: err.message || 'Error al crear la sala.',
      });
    }
  });

  // 2. Unirse a una Sala por Código o Link Directo
  socket.on('join_room', ({ roomId, playerId: clientPlayerId, playerName }) => {
    try {
      const targetRoom = roomManager.getRoom(roomId);
      if (!targetRoom) {
        socket.emit('room_not_found', {
          message: `La sala "${roomId}" no existe o ya caducó.`,
        });
        return;
      }

      const playerId = clientPlayerId || socket.id;
      const result = roomManager.addPlayerToRoom(targetRoom.id, {
        id: playerId,
        socketId: socket.id,
        name: playerName || 'Jugador 2',
      });

      if (!result.success) {
        if (result.error === 'room_full') {
          socket.emit('room_full', {
            message: `La sala "${roomId}" ya tiene 2 jugadores. Creá una nueva o jugá una pública.`,
          });
        } else {
          socket.emit('error_message', {
            code: 'JOIN_ERROR',
            message: result.error || 'No se pudo unir a la sala.',
          });
        }
        return;
      }

      socket.join(targetRoom.id);
      socket.emit('room_joined', { roomId: targetRoom.id, isPrivate: targetRoom.isPrivate });

      console.log(`[Jugador Unido] ${playerName} (${playerId}) entró a ${targetRoom.id}`);

      // Si la sala se completó y arrancó la partida, sincronizar a ambos jugadores
      if (result.gameStarted || targetRoom.gameState) {
        broadcastGameState(targetRoom);
      }
    } catch (err: any) {
      socket.emit('error_message', {
        code: 'INTERNAL_ERROR',
        message: err.message || 'Error al unirse a la sala.',
      });
    }
  });

  // 3. Matchmaking Simple: "Jugar Ya" (Mesas Públicas)
  socket.on('join_public_room', ({ playerId: clientPlayerId, playerName, targetPoints = 30 }) => {
    try {
      const openRoom = roomManager.findOpenPublicRoom();
      const playerId = clientPlayerId || socket.id;

      if (openRoom) {
        // Unirse a la sala existente
        const result = roomManager.addPlayerToRoom(openRoom.id, {
          id: playerId,
          socketId: socket.id,
          name: playerName || 'Jugador 2',
        });

        if (result.success) {
          socket.join(openRoom.id);
          socket.emit('room_joined', { roomId: openRoom.id, isPrivate: false });

          if (result.gameStarted || openRoom.gameState) {
            broadcastGameState(openRoom);
          }
        }
      } else {
        // Crear una nueva sala pública y esperar rival
        const newRoom = roomManager.createRoom(false, targetPoints);
        roomManager.addPlayerToRoom(newRoom.id, {
          id: playerId,
          socketId: socket.id,
          name: playerName || 'Jugador 1',
        });

        socket.join(newRoom.id);
        socket.emit('room_created', { roomId: newRoom.id, isPrivate: false });
      }
    } catch (err: any) {
      socket.emit('error_message', {
        code: 'MATCHMAKING_ERROR',
        message: err.message || 'Error en matchmaking público.',
      });
    }
  });

  // 4. Reconexión de Jugador
  socket.on('reconnect_player', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('room_not_found', { message: 'Sala no encontrada.' });
        return;
      }

      const result = roomManager.addPlayerToRoom(roomId, {
        id: playerId,
        socketId: socket.id,
        name: room.players.get(playerId)?.name || 'Jugador',
      });

      if (result.success) {
        socket.join(room.id);
        socket.to(room.id).emit('player_reconnected', { playerId });
        broadcastGameState(room);
      }
    } catch (err: any) {
      socket.emit('error_message', {
        code: 'RECONNECT_ERROR',
        message: err.message || 'Error al reconectar.',
      });
    }
  });

  // 5. Router Autoritativo de Acciones de Juego
  socket.on('game_action', (action: ClientGameAction) => {
    try {
      let playerMapping = roomManager.getPlayerBySocket(socket.id);

      // Auto-revinculación si el socket reconnectó y envía action.playerId
      if (!playerMapping && action.playerId) {
        const rebind = roomManager.rebindSocket(socket.id, action.playerId);
        if (rebind) {
          socket.join(rebind.room.id);
          playerMapping = { roomId: rebind.room.id, playerId: rebind.player.id };
        }
      }

      if (!playerMapping) {
        socket.emit('error_message', {
          code: 'NOT_IN_ROOM',
          message: 'No perteneces a ninguna sala activa.',
        });
        return;
      }

      const { roomId, playerId } = playerMapping;
      const room = roomManager.getRoom(roomId);
      if (!room || !room.gameState) {
        socket.emit('error_message', {
          code: 'NO_GAME_ACTIVE',
          message: 'No hay ninguna partida activa en esta sala.',
        });
        return;
      }

      // Procesar acción según tipo
      let updatedState = room.gameState;

      switch (action.type) {
        case 'play_card':
          updatedState = playCard(room.gameState, playerId, action.cardId);
          break;

        case 'call_envido':
          updatedState = callEnvido(room.gameState, playerId, action.call);
          break;

        case 'call_truco':
          updatedState = callTruco(room.gameState, playerId, action.call);
          break;

        case 'respond_bet':
          updatedState = respondBet(room.gameState, playerId, action.response);
          break;

        case 'fold':
          updatedState = foldHand(room.gameState, playerId);
          break;

        default:
          throw new Error('Tipo de acción de juego desconocido.');
      }

      // Guardar nuevo estado en sala
      room.gameState = updatedState;

      // Broadcast inmediato de la verdad autoritativa sanitizada a ambos clientes
      broadcastGameState(room);

      // Si la partida terminó, emitir evento game_over
      if (updatedState.matchWinnerId) {
        io.to(room.id).emit('game_over', {
          winnerId: updatedState.matchWinnerId,
          reason: `Partida finalizada. ¡Ganador: ${updatedState.players[updatedState.matchWinnerId].name}!`,
        });
      }
    } catch (err: any) {
      console.warn(`[Acción rechazada] Socket ${socket.id}: ${err.message}`);
      socket.emit('error_message', {
        code: 'INVALID_ACTION',
        message: err.message || 'Jugada inválida.',
      });
    }
  });

  // 6. Manejo de Desconexión con Tolerancia Temporal
  socket.on('disconnect', () => {
    console.log(`[Socket desconectado] ${socket.id}`);

    roomManager.handleDisconnect(socket.id, (room, abandonedPlayerId, remainingPlayerId) => {
      // Callback que se ejecuta luego de expirar el grace period (45s)
      console.log(`[Abandono definitivo] ${abandonedPlayerId} en sala ${room.id}`);

      if (room.gameState && !room.gameState.matchWinnerId) {
        room.gameState.matchWinnerId = remainingPlayerId;
        const winnerName = room.gameState.players[remainingPlayerId]?.name || 'Rival';

        io.to(room.id).emit('game_over', {
          winnerId: remainingPlayerId,
          reason: `El rival se desconectó y no regresó a tiempo. Victoria para ${winnerName}.`,
        });
        broadcastGameState(room);
      }
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🃏 SERVIDOR DE TRUCO ARGENTINO CORRIENDO EN PUERTO ${PORT}`);
  console.log(`======================================================\n`);
});
