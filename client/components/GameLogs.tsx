'use client';

import React, { useEffect, useRef } from 'react';
import { GameLog } from '../types/truco';

interface GameLogsProps {
  logs: GameLog[];
}

export const GameLogs: React.FC<GameLogsProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getTypeStyle = (type: GameLog['type']) => {
    switch (type) {
      case 'canto':
        return 'text-amber-300 font-bold';
      case 'play':
        return 'text-stone-300';
      case 'score':
        return 'text-emerald-400 font-semibold';
      case 'alert':
        return 'text-yellow-400 font-black';
      default:
        return 'text-stone-400';
    }
  };

  return (
    <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-3 flex flex-col h-44 sm:h-56 shadow-lg backdrop-blur-sm">
      <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 pb-1 border-b border-stone-800/80 flex items-center justify-between">
        <span>Historial de la Mano</span>
        <span className="text-[10px] text-stone-500 font-mono">
          {logs.length} eventos
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1.5 text-xs pr-1 scrollbar-thin scrollbar-thumb-stone-700"
      >
        {logs.length === 0 ? (
          <div className="text-stone-600 italic text-center py-4">
            Esperando jugadas...
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`leading-relaxed px-2 py-0.5 rounded bg-stone-900/40 ${getTypeStyle(
                log.type
              )}`}
            >
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
