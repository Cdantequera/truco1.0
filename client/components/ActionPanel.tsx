'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { ClientGameState } from '../types/truco';

interface ActionPanelProps {
  gameState: ClientGameState;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ gameState }) => {
  const { callEnvido, callTruco, respondBet, fold } = useSocket();
  const { availableActions, currentHand, me, opponent } = gameState;

  const isMyTurn = currentHand.currentTurnPlayerId === me.id;
  const isEnvidoPending = currentHand.envido.state === 'pending';
  const isTrucoPending = currentHand.truco.state === 'pending';

  // Mensaje de estado explicativo
  let statusMessage = '';
  if (isEnvidoPending) {
    if (currentHand.envido.waitingResponseFrom === me.id) {
      statusMessage = `¡Tu rival cantó ${currentHand.envido.history.at(-1)?.replace('_', ' ')}! ¿Qué respondés?`;
    } else {
      statusMessage = 'Esperando la respuesta de tu rival al canto de Envido...';
    }
  } else if (isTrucoPending) {
    if (currentHand.truco.waitingResponseFrom === me.id) {
      statusMessage = `¡Tu rival cantó ${currentHand.truco.currentCall?.replace('_', ' ')}! ¿Qué respondés?`;
    } else {
      statusMessage = 'Esperando la respuesta de tu rival al canto de Truco...';
    }
  } else if (isMyTurn) {
    statusMessage = 'Es tu turno: podés tirar una carta o cantar.';
  } else {
    statusMessage = opponent ? `Turno de ${opponent.name}...` : 'Esperando rival...';
  }

  const anyResponseAvailable =
    availableActions.canRespondQuiero || availableActions.canRespondNoQuiero;

  const anyEnvidoAvailable =
    availableActions.canCallEnvido ||
    availableActions.canCallRealEnvido ||
    availableActions.canCallFaltaEnvido;

  const anyTrucoAvailable =
    availableActions.canCallTruco ||
    availableActions.canCallRetruco ||
    availableActions.canCallValeCuatro;

  return (
    <div className="w-full max-w-3xl mx-auto bg-stone-950/85 backdrop-blur-md border border-amber-900/40 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
      {/* Banner de Estado Contextual */}
      <div className="flex items-center justify-between px-2">
        <span
          className={`text-xs sm:text-sm font-semibold tracking-wide flex items-center gap-2 ${
            isMyTurn ? 'text-amber-300' : 'text-stone-400'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isMyTurn ? 'bg-amber-400 animate-ping' : 'bg-stone-500'
            }`}
          />
          {statusMessage}
        </span>
      </div>

      {/* Botonera de Acciones */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {/* RESPUESTAS: Quiero / No Quiero */}
        {anyResponseAvailable && (
          <div className="flex items-center gap-2 border-r border-stone-800 pr-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => respondBet('quiero')}
              className="px-4 sm:px-6 py-2.5 rounded-xl font-black text-sm sm:text-base uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-colors"
            >
              ¡Quiero!
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => respondBet('no_quiero')}
              className="px-4 sm:px-6 py-2.5 rounded-xl font-bold text-sm sm:text-base uppercase tracking-wider bg-rose-700 hover:bg-rose-600 text-white shadow-lg shadow-rose-950/50 transition-colors"
            >
              No Quiero
            </motion.button>
          </div>
        )}

        {/* CANTOS DE ENVIDO */}
        {anyEnvidoAvailable && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {availableActions.canCallEnvido && (
              <button
                onClick={() => callEnvido('envido')}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
              >
                Envido
              </button>
            )}
            {availableActions.canCallRealEnvido && (
              <button
                onClick={() => callEnvido('real_envido')}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 border border-amber-600/40 transition-colors"
              >
                Real Envido
              </button>
            )}
            {availableActions.canCallFaltaEnvido && (
              <button
                onClick={() => callEnvido('falta_envido')}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-red-600/30 hover:bg-red-600/40 text-red-300 border border-red-500/50 transition-colors"
              >
                Falta Envido
              </button>
            )}
          </div>
        )}

        {/* CANTOS DE TRUCO */}
        {anyTrucoAvailable && (
          <div className="flex items-center gap-1.5 sm:gap-2 border-l border-stone-800 pl-3">
            {availableActions.canCallTruco && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => callTruco('truco')}
                className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md transition-colors"
              >
                ¡Truco!
              </motion.button>
            )}
            {availableActions.canCallRetruco && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => callTruco('retruco')}
                className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md transition-colors"
              >
                ¡Retruco!
              </motion.button>
            )}
            {availableActions.canCallValeCuatro && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => callTruco('vale_cuatro')}
                className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider bg-red-500 hover:bg-red-400 text-stone-950 shadow-md transition-colors"
              >
                ¡Vale Cuatro!
              </motion.button>
            )}
          </div>
        )}

        {/* ME VOY AL MAZO */}
        {availableActions.canFold && (
          <div className="ml-auto">
            <button
              onClick={() => {
                if (confirm('¿Estás seguro de que querés irte al mazo?')) {
                  fold();
                }
              }}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 border border-stone-800 transition-colors"
            >
              Me voy al mazo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
