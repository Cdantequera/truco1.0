'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '../../../store/useGameStore';
import { useSocket } from '../../../hooks/useSocket';
import { Board } from '../../../components/Board';
import { motion } from 'framer-motion';

export default function MesaPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.roomId as string)?.toUpperCase();

  const { gameState, isConnected, errorMessage, playerName, setPlayerName, setErrorMessage } =
    useGameStore();
  const { joinRoom } = useSocket();

  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [customName, setCustomName] = useState(playerName || '');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !isConnected) return;
    const finalName = customName.trim() || 'Jugador ' + Math.floor(100 + Math.random() * 900);
    setPlayerName(finalName);
    setErrorMessage(null);
    joinRoom(roomId, finalName);
    setHasAttemptedJoin(true);
  };

  // Si ya estamos en la sala y tenemos gameState, mostrar el tablero
  if (gameState && gameState.roomId === roomId) {
    return <Board />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-[#0d231b] to-stone-950 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-stone-900 border border-amber-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center"
      >
        <div className="text-4xl mb-3">🃏</div>
        <h1 className="text-2xl sm:text-3xl font-black text-amber-400 font-serif mb-1">
          Unirse a la Mesa
        </h1>
        <p className="text-xs text-stone-400 mb-6 font-mono">
          Código: <span className="text-amber-300 font-bold">{roomId}</span>
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs text-left">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div className="text-left">
            <label className="block text-xs font-semibold uppercase text-stone-400 mb-1.5">
              Ingresá tu nombre o apodo
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ej: El Payador"
              maxLength={20}
              className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={!isConnected}
            className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-stone-950 transition-all disabled:opacity-50 shadow-lg"
          >
            {hasAttemptedJoin ? 'Conectando...' : 'Entrar a la Mesa'}
          </button>
        </form>

        <button
          onClick={() => router.push('/')}
          className="mt-4 text-xs text-stone-500 hover:text-stone-300 underline"
        >
          Volver al Lobby principal
        </button>
      </motion.div>
    </div>
  );
}
