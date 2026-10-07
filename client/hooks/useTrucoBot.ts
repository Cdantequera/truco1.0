'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, ClientGameState } from '../types/truco';
import { BotDecision, BotDifficulty, getBotDecision } from '../lib/trucoBot';

export interface UseTrucoBotOptions {
  botId: string;
  botHand: Card[];
  gameState: ClientGameState | null;
  difficulty: BotDifficulty;
  onBotAction: (decision: BotDecision) => void;
  minDelayMs?: number; // Por defecto: 800ms
  maxDelayMs?: number; // Por defecto: 1500ms
  isEnabled?: boolean;
}

export function useTrucoBot({
  botId,
  botHand,
  gameState,
  difficulty,
  onBotAction,
  minDelayMs = 800,
  maxDelayMs = 1500,
  isEnabled = true,
}: UseTrucoBotOptions) {
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [lastDecision, setLastDecision] = useState<BotDecision | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Limpiar timeout previo si el estado cambia antes de ejecutarse
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!isEnabled || !gameState || gameState.status !== 'playing' || gameState.matchWinnerId) {
      setIsBotThinking(false);
      return;
    }

    const { currentHand } = gameState;

    // Determinar si es el turno del bot para actuar
    const isEnvidoWaitingBot =
      currentHand.envido.state === 'pending' &&
      currentHand.envido.waitingResponseFrom === botId;

    const isTrucoWaitingBot =
      currentHand.truco.state === 'pending' &&
      currentHand.truco.waitingResponseFrom === botId;

    const isRegularTurnBot =
      currentHand.currentTurnPlayerId === botId &&
      currentHand.envido.state !== 'pending' &&
      currentHand.truco.state !== 'pending';

    const isBotTurnToAct = isEnvidoWaitingBot || isTrucoWaitingBot || isRegularTurnBot;

    if (!isBotTurnToAct) {
      setIsBotThinking(false);
      return;
    }

    setIsBotThinking(true);

    // Latencia humana simulada (entre minDelayMs y maxDelayMs)
    const delay = Math.floor(
      minDelayMs + Math.random() * (maxDelayMs - minDelayMs)
    );

    timeoutRef.current = setTimeout(() => {
      try {
        const decision = getBotDecision(botHand, gameState, difficulty);
        setLastDecision(decision);
        setIsBotThinking(false);
        onBotAction(decision);
      } catch (err) {
        console.error('Error al calcular jugada del bot:', err);
        setIsBotThinking(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    isEnabled,
    botId,
    botHand,
    gameState,
    difficulty,
    onBotAction,
    minDelayMs,
    maxDelayMs,
  ]);

  return {
    isBotThinking,
    lastDecision,
  };
}
