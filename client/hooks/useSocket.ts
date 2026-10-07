'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/useGameStore';
import {
  BetResponse,
  ClientGameAction,
  ClientGameState,
  EnvidoCallType,
  TrucoCallType,
} from '../types/truco';

import { offlineGameManager } from '../lib/offlineGameManager';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

let socketInstance: Socket | null = null;
let areListenersAttached = false;

function initSocketSingleton(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  if (!areListenersAttached) {
    areListenersAttached = true;
    const s = socketInstance;

    s.on('connect', () => {
      console.log('✅ [Socket Conectado] ID:', s.id);
      useGameStore.getState().setIsConnected(true);
      useGameStore.getState().setErrorMessage(null);

      // Si teníamos una partida activa en el cliente, re-vincular
      const state = useGameStore.getState().gameState;
      const pid = useGameStore.getState().playerId;
      if (state && state.roomId && pid) {
        console.log(`🔄 Re-vinculando jugador ${pid} a sala ${state.roomId}...`);
        s.emit('reconnect_player', { roomId: state.roomId, playerId: pid });
      }
    });

    s.on('disconnect', (reason) => {
      console.log('⚠️ [Socket Desconectado] Motivo:', reason);
      useGameStore.getState().setIsConnected(false);
    });

    s.on('game_state_sync', (state: ClientGameState) => {
      console.log('📥 [Sync Estado de Juego]', {
        ronda: state.currentHand.currentRound,
        turno: state.currentHand.currentTurnPlayerId,
        esMiTurno: state.currentHand.currentTurnPlayerId === state.myId,
        acciones: state.availableActions,
      });
      useGameStore.getState().setGameState(state);
      useGameStore.getState().setIsSearchingMatch(false);
    });

    s.on('room_full', (payload: { message: string }) => {
      console.warn('⚠️ [Sala Llena]:', payload.message);
      useGameStore.getState().setErrorMessage(payload.message);
      useGameStore.getState().setIsSearchingMatch(false);
    });

    s.on('room_not_found', (payload: { message: string }) => {
      console.warn('⚠️ [Sala No Encontrada]:', payload.message);
      useGameStore.getState().setErrorMessage(payload.message);
      useGameStore.getState().setIsSearchingMatch(false);
    });

    s.on('error_message', (payload: { code: string; message: string }) => {
      console.warn(`🛑 [Error del Servidor] ${payload.code}: ${payload.message}`);
      useGameStore.getState().setErrorMessage(payload.message);
    });
  }

  return socketInstance;
}

export function useSocket() {
  const { playerId } = useGameStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = initSocketSingleton();
  }, []);

  const getSocket = (): Socket => {
    if (!socketRef.current) {
      socketRef.current = initSocketSingleton();
    }
    return socketRef.current;
  };

  const createRoom = (
    playerName: string,
    isPrivate: boolean = true,
    targetPoints: 15 | 30 = 30
  ) => {
    const s = getSocket();
    s.emit('create_room', {
      playerId,
      playerName,
      isPrivate,
      targetPoints,
    });
  };

  const joinRoom = (roomId: string, playerName: string) => {
    const s = getSocket();
    s.emit('join_room', {
      roomId,
      playerId,
      playerName,
    });
  };

  const joinPublicRoom = (playerName: string, targetPoints: 15 | 30 = 30) => {
    useGameStore.getState().setIsSearchingMatch(true);
    const s = getSocket();
    s.emit('join_public_room', {
      playerId,
      playerName,
      targetPoints,
    });
  };

  const sendAction = (action: ClientGameAction) => {
    if (offlineGameManager.isOfflineMode()) {
      offlineGameManager.handleHumanAction(action);
      return;
    }
    const s = getSocket();
    s.emit('game_action', { ...action, playerId });
  };

  const playCard = (cardId: string) => {
    sendAction({ type: 'play_card', cardId, playerId });
  };

  const callEnvido = (call: EnvidoCallType) => {
    sendAction({ type: 'call_envido', call, playerId });
  };

  const callTruco = (call: TrucoCallType) => {
    sendAction({ type: 'call_truco', call, playerId });
  };

  const respondBet = (response: BetResponse) => {
    sendAction({ type: 'respond_bet', response, playerId });
  };

  const fold = () => {
    sendAction({ type: 'fold', playerId });
  };

  return {
    socket: socketInstance,
    createRoom,
    joinRoom,
    joinPublicRoom,
    playCard,
    callEnvido,
    callTruco,
    respondBet,
    fold,
  };
}
