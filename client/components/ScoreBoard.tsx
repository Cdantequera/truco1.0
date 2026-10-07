'use client';

import React from 'react';
import { ClientGameState } from '../types/truco';

interface ScoreBoardProps {
  gameState: ClientGameState;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ gameState }) => {
  const { me, opponent, scores, targetPoints, currentHand, roomId } = gameState;

  const myScore = scores[me.id] || 0;
  const opponentScore = opponent ? scores[opponent.id] || 0 : 0;

  const isMyHand = currentHand.handPlayerId === me.id;
  const isOpponentHand = opponent && currentHand.handPlayerId === opponent.id;

  // Formato tradicional: en partidas a 30 se divide en "malas" (0-15) y "buenas" (15-30)
  const formatScoreDescription = (pts: number) => {
    if (targetPoints === 30) {
      if (pts < 15) return `${pts} malas`;
      return `${pts - 15} buenas`;
    }
    return `${pts} pts`;
  };

  return (
    <div className="bg-gradient-to-b from-stone-900 to-stone-950 text-stone-100 border border-amber-900/40 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
      {/* Cabecera con Código de Sala y Objetivo */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-stone-400">Sala:</span>
          <span className="font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
            {roomId}
          </span>
        </div>
        <div className="text-amber-300 font-semibold">
          A {targetPoints} puntos
        </div>
      </div>

      {/* Marcador Principal */}
      <div className="grid grid-cols-2 gap-3 text-center">
        {/* Jugador Actual (Vos) */}
        <div
          className={`p-3 rounded-xl border transition-all ${
            currentHand.currentTurnPlayerId === me.id
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-stone-900/60 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="font-bold text-sm text-stone-200 truncate max-w-[100px]">
              {me.name} (Vos)
            </span>
            {isMyHand && (
              <span title="Es Mano" className="text-xs bg-amber-500/20 text-amber-300 px-1 rounded border border-amber-500/40">
                🖐️ Mano
              </span>
            )}
          </div>
          <div className="text-3xl font-black text-amber-400 font-serif">
            {myScore}
          </div>
          <div className="text-[11px] text-stone-400 font-mono mt-0.5">
            {formatScoreDescription(myScore)}
          </div>
        </div>

        {/* Rival */}
        <div
          className={`p-3 rounded-xl border transition-all ${
            opponent && currentHand.currentTurnPlayerId === opponent.id
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-stone-900/60 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="font-bold text-sm text-stone-200 truncate max-w-[100px]">
              {opponent ? opponent.name : 'Esperando...'}
            </span>
            {isOpponentHand && (
              <span title="Es Mano" className="text-xs bg-amber-500/20 text-amber-300 px-1 rounded border border-amber-500/40">
                🖐️ Mano
              </span>
            )}
          </div>
          <div className="text-3xl font-black text-amber-400 font-serif">
            {opponentScore}
          </div>
          <div className="text-[11px] text-stone-400 font-mono mt-0.5">
            {formatScoreDescription(opponentScore)}
          </div>
        </div>
      </div>

      {/* Mini indicador de rondas ganadas en la mano actual */}
      <div className="mt-3 pt-2 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
        <span>Rondas:</span>
        <div className="flex gap-2">
          {[1, 2, 3].map((r) => {
            const result = currentHand.roundResults.find((res) => res.round === r);
            let badgeBg = 'bg-stone-800 text-stone-500';
            let label = `${r}ª`;

            if (result) {
              if (result.winnerId === 'parda') {
                badgeBg = 'bg-amber-600/30 text-amber-300 border border-amber-600/50';
                label = 'Parda';
              } else if (result.winnerId === me.id) {
                badgeBg = 'bg-emerald-600 text-white font-bold';
                label = 'Vos';
              } else {
                badgeBg = 'bg-rose-700 text-white font-bold';
                label = 'Rival';
              }
            }

            return (
              <span
                key={r}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${badgeBg}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
