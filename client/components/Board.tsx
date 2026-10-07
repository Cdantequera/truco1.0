'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { CardView } from './CardView';
import { ScoreBoard } from './ScoreBoard';
import { ActionPanel } from './ActionPanel';
import { GameLogs } from './GameLogs';
import { offlineGameManager } from '../lib/offlineGameManager';
import { Card } from '../types/truco';

export const Board: React.FC = () => {
  const { gameState, errorMessage, setErrorMessage, resetGame } = useGameStore();
  const { playCard } = useSocket();

  // Auto-dismiss del mensaje de error tras 3.5 segundos
  React.useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, setErrorMessage]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-medium">Conectando a la mesa...</p>
        </div>
      </div>
    );
  }

  const { me, opponent, currentHand, availableActions, matchWinnerId } = gameState;

  // Filtrar jugadas por ronda
  const r1Plays = currentHand.playedCards.filter((p) => p.round === 1);
  const r2Plays = currentHand.playedCards.filter((p) => p.round === 2);
  const r3Plays = currentHand.playedCards.filter((p) => p.round === 3);

  const isGameOver = !!matchWinnerId;
  const isWinner = matchWinnerId === me.id;

  return (
    <div className="relative min-h-screen bg-[#0d231b] flex flex-col justify-between overflow-x-hidden p-2 sm:p-4 select-none">
      {/* Notificación flotante de error/aviso */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-950/95 border border-rose-500 text-rose-200 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wide"
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fondo de Paño Verde de Truco con sombra y textura */}
      <div className="absolute inset-0 bg-radial from-[#1e5847] via-[#123e31] to-[#0a1f18] opacity-95 pointer-events-none" />

      {/* Barra Superior: Marcador & Info */}
      <header className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        {/* Marcador Principal */}
        <div className="md:col-span-2">
          <ScoreBoard gameState={gameState} />
        </div>

        {/* Historial en Vivo */}
        <div className="hidden md:block">
          <GameLogs logs={gameState.logs} />
        </div>
      </header>

      {/* ÁREA CENTRAL DEL TABLERO */}
      <main className="relative z-10 w-full max-w-5xl mx-auto flex-1 flex flex-col justify-between my-2 sm:my-4">
        {/* 1. ZONA DEL RIVAL (Arriba) */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 bg-stone-950/60 px-4 py-1 rounded-full border border-stone-800 text-xs text-stone-300">
            <span
              className={`w-2 h-2 rounded-full ${
                opponent?.connected ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold">
              {opponent ? opponent.name : 'Esperando rival...'}
            </span>
            {opponent && (
              <span className="text-stone-500">
                ({opponent.cardCount} cartas)
              </span>
            )}
          </div>

          {/* Cartas del Rival (Dorso) */}
          <div className="flex items-center justify-center gap-2">
            {opponent ? (
              Array.from({ length: opponent.cardCount }).map((_, idx) => (
                <CardView key={idx} isFaceDown isSmall />
              ))
            ) : (
              <div className="text-stone-400 text-xs italic py-4">
                El rival se unirá en breve...
              </div>
            )}
          </div>
        </div>

        {/* 2. PAÑO CENTRAL: CARTAS JUGADAS POR RONDA */}
        <div className="my-auto py-3 sm:py-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl bg-black/25 border border-emerald-900/40 rounded-3xl p-3 sm:p-5 shadow-felt">
            <div className="text-[11px] font-semibold text-emerald-400/80 uppercase tracking-widest text-center mb-3">
              Cartas en la Mesa
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 divide-x divide-emerald-900/30">
              {/* Ronda 1 */}
              <div className="flex flex-col items-center gap-2 px-1">
                <span className="text-[10px] font-mono text-emerald-300/70">
                  1ª Ronda
                </span>
                <div className="flex flex-col items-center gap-1.5 min-h-[90px] justify-center">
                  {r1Plays.length === 0 && (
                    <div className="w-14 sm:w-16 aspect-[66/102] border border-dashed border-emerald-800/40 rounded-xl" />
                  )}
                  {r1Plays.map((p, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative"
                    >
                      <CardView card={p.card} isSmall />
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-black/80 px-1 rounded text-stone-300 border border-stone-700">
                        {p.playerId === me.id ? 'Vos' : 'Rival'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Ronda 2 */}
              <div className="flex flex-col items-center gap-2 px-1">
                <span className="text-[10px] font-mono text-emerald-300/70">
                  2ª Ronda
                </span>
                <div className="flex flex-col items-center gap-1.5 min-h-[90px] justify-center">
                  {r2Plays.length === 0 && (
                    <div className="w-14 sm:w-16 aspect-[66/102] border border-dashed border-emerald-800/40 rounded-xl" />
                  )}
                  {r2Plays.map((p, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative"
                    >
                      <CardView card={p.card} isSmall />
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-black/80 px-1 rounded text-stone-300 border border-stone-700">
                        {p.playerId === me.id ? 'Vos' : 'Rival'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Ronda 3 */}
              <div className="flex flex-col items-center gap-2 px-1">
                <span className="text-[10px] font-mono text-emerald-300/70">
                  3ª Ronda
                </span>
                <div className="flex flex-col items-center gap-1.5 min-h-[90px] justify-center">
                  {r3Plays.length === 0 && (
                    <div className="w-14 sm:w-16 aspect-[66/102] border border-dashed border-emerald-800/40 rounded-xl" />
                  )}
                  {r3Plays.map((p, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative"
                    >
                      <CardView card={p.card} isSmall />
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-black/80 px-1 rounded text-stone-300 border border-stone-700">
                        {p.playerId === me.id ? 'Vos' : 'Rival'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. ZONA DEL JUGADOR (Abajo) */}
        <div className="flex flex-col items-center gap-3">
          {/* Cartas de la Mano del Jugador */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <AnimatePresence>
              {me.cards && me.cards.length > 0 ? (
                me.cards.map((card: Card) => {
                  const isPlayable = availableActions.canPlayCards.includes(card.id);
                  return (
                    <CardView
                      key={card.id}
                      card={card}
                      isPlayable={isPlayable}
                      onPlay={() => playCard(card.id)}
                    />
                  );
                })
              ) : (
                <div className="text-stone-400 text-xs italic py-2">
                  No tenés cartas restantes en esta mano.
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Info del jugador y tantos de envido */}
          <div className="flex items-center gap-3 bg-stone-950/80 px-4 py-1.5 rounded-full border border-stone-800 text-xs text-stone-200">
            <span className="font-bold text-amber-300">{me.name} (Vos)</span>
            <span className="text-stone-500">•</span>
            <span className="text-emerald-400 font-mono">
              Envido: <strong>{me.envidoPoints}</strong> tantos
            </span>
          </div>
        </div>
      </main>

      {/* FOOTER: PANEL CONTEXTUAL DE ACCIONES */}
      <footer className="relative z-20 w-full max-w-4xl mx-auto pt-2">
        <ActionPanel gameState={gameState} />
      </footer>

      {/* MODAL DE FIN DE PARTIDA */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-stone-900 border-2 border-amber-500/70 rounded-3xl p-6 text-center shadow-2xl"
          >
            <div className="text-5xl mb-3">{isWinner ? '🏆' : '💀'}</div>
            <h2 className="text-2xl sm:text-3xl font-black text-amber-400 font-serif mb-2">
              {isWinner ? '¡Victoria Criolla!' : 'Derrota'}
            </h2>
            <p className="text-stone-300 text-sm mb-6">
              {isWinner
                ? '¡Ganaste el partido! Coronaste la partida con honor.'
                : 'Tu rival alcanzó el puntaje pactado. ¡La próxima sale!'}
            </p>

            <button
              onClick={() => {
                offlineGameManager.reset();
                resetGame();
              }}
              className="w-full py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors uppercase tracking-wider text-sm shadow-lg"
            >
              Volver al Lobby
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};
