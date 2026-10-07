'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/useGameStore';
import { offlineGameManager } from '../lib/offlineGameManager';
import { BotDifficulty } from '../lib/trucoBot';

export const Lobby: React.FC = () => {
  const { createRoom, joinRoom, joinPublicRoom } = useSocket();
  const {
    isConnected,
    errorMessage,
    isSearchingMatch,
    playerName,
    setPlayerName,
    setErrorMessage,
  } = useGameStore();

  const [inputCode, setInputCode] = useState('');
  const [targetPoints, setTargetPoints] = useState<15 | 30>(30);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medio');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value);
  };

  const getEffectiveName = () => playerName.trim() || 'Jugador ' + Math.floor(100 + Math.random() * 900);

  const handlePlayNow = () => {
    setErrorMessage(null);
    joinPublicRoom(getEffectiveName(), targetPoints);
  };

  const handlePlayVsBot = () => {
    setErrorMessage(null);
    offlineGameManager.startOfflineGame(getEffectiveName(), targetPoints, botDifficulty);
  };

  const handleCreatePrivate = () => {
    setErrorMessage(null);
    createRoom(getEffectiveName(), true, targetPoints);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setErrorMessage(null);
    joinRoom(inputCode.trim().toUpperCase(), getEffectiveName());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-[#0d231b] to-stone-950 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-stone-900/90 border border-amber-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md"
      >
        {/* Encabezado */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-3xl mb-3 shadow-inner">
            ⚔️
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-amber-400 font-serif tracking-tight">
            Truco Argentino
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 mt-1">
            Partidas 1 vs 1 en tiempo real y Modo 1 vs PC con IA adaptable
          </p>

          {/* Indicador de conexión de Socket */}
          <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full bg-stone-950 border border-stone-800 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
              {isConnected ? 'Servidor Conectado' : 'Modo Offline Disponible'}
            </span>
          </div>
        </div>

        {/* Mensaje de Error (Ej: Sala Llena) */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs sm:text-sm flex items-start gap-2"
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </motion.div>
        )}

        {/* Formulario de Configuración Básica */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold uppercase text-stone-400 mb-1.5">
              Tu Apodo / Nombre
            </label>
            <input
              type="text"
              value={playerName}
              onChange={handleNameChange}
              placeholder="Ej: El Chaqueño"
              maxLength={20}
              className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-stone-400 mb-1.5">
              Puntaje del Partido
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetPoints(15)}
                className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                  targetPoints === 15
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                    : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-300'
                }`}
              >
                A 15 Puntos (Rápido)
              </button>
              <button
                type="button"
                onClick={() => setTargetPoints(30)}
                className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                  targetPoints === 30
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                    : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-300'
                }`}
              >
                A 30 Puntos (Completo)
              </button>
            </div>
          </div>

          {/* Selector de Dificultad del Bot */}
          <div>
            <label className="block text-xs font-semibold uppercase text-stone-400 mb-1.5 flex items-center justify-between">
              <span>Dificultad de la Computadora (IA)</span>
              <span className="text-[10px] text-amber-400 lowercase font-normal">
                {botDifficulty === 'facil' && 'principiante / sin bluff'}
                {botDifficulty === 'medio' && 'jugador de peña / equilibrado'}
                {botDifficulty === 'dificil' && 'competitivo / 30% bluff'}
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['facil', 'medio', 'dificil'] as BotDifficulty[]).map((dif) => (
                <button
                  key={dif}
                  type="button"
                  onClick={() => setBotDifficulty(dif)}
                  className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                    botDifficulty === dif
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 shadow-sm'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-300'
                  }`}
                >
                  {dif === 'facil' ? 'Fácil' : dif === 'medio' ? 'Medio' : 'Difícil'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Acciones del Lobby */}
        <div className="space-y-3">
          {/* Opción A: JUGAR VS PC (OFFLINE) */}
          <button
            onClick={handlePlayVsBot}
            className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2"
          >
            <span>🤖</span>
            <span>Jugar vs PC ({botDifficulty})</span>
          </button>

          {/* Opción B: Jugar Ya (Matchmaking Público) */}
          <button
            onClick={handlePlayNow}
            disabled={!isConnected || isSearchingMatch}
            className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-md transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isSearchingMatch ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Buscando Rival Online...</span>
              </>
            ) : (
              <>
                <span>🎲</span>
                <span>Jugar Online (1 vs 1)</span>
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-stone-800"></div>
            <span className="flex-shrink mx-4 text-[11px] uppercase tracking-widest text-stone-600 font-semibold">
              O crear sala con código
            </span>
            <div className="flex-grow border-t border-stone-800"></div>
          </div>

          {/* Opción C: Crear Sala Privada */}
          <button
            onClick={handleCreatePrivate}
            disabled={!isConnected}
            className="w-full py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider bg-stone-950 hover:bg-stone-800/80 text-amber-300 border border-amber-500/40 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <span>🔒</span>
            <span>Crear Mesa Privada</span>
          </button>

          {/* Opción D: Unirse con Código */}
          <form onSubmit={handleJoinByCode} className="flex gap-2 pt-1">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="CÓDIGO (EJ: TRUCO-492)"
              maxLength={12}
              className="flex-1 px-4 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-xs font-mono tracking-wider uppercase text-center"
            />
            <button
              type="submit"
              disabled={!isConnected || !inputCode.trim()}
              className="px-5 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
            >
              Unirme
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
