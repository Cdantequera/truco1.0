'use client';

import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { Lobby } from '../components/Lobby';
import { Board } from '../components/Board';

export default function HomePage() {
  const { gameState } = useGameStore();

  // Si hay una partida activa o mesa en curso, renderizar el tablero
  if (gameState) {
    return <Board />;
  }

  // De lo contrario, mostrar el Lobby principal
  return <Lobby />;
}
