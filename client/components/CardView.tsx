'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardSuit } from '../types/truco';

interface CardViewProps {
  card?: Card;
  isFaceDown?: boolean;
  isPlayable?: boolean;
  onPlay?: () => void;
  isSmall?: boolean;
}

/**
 * Obtiene la ruta al archivo SVG reglamentario correspondiente
 */
export function getCardSvgPath(suit?: CardSuit, number?: number): string {
  if (!suit || !number) {
    return '/cards/card_back.svg';
  }

  const suitMap: Record<CardSuit, string> = {
    espada: 'swords',
    basto: 'clubs',
    oro: 'coins',
    copa: 'cups',
  };

  const suitName = suitMap[suit];
  const formattedNum = number.toString().padStart(2, '0');

  return `/cards/card_${suitName}_${formattedNum}.svg`;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isFaceDown = false,
  isPlayable = false,
  onPlay,
  isSmall = false,
}) => {
  const isBack = isFaceDown || !card;
  const imageSrc = isBack
    ? '/cards/card_back.svg'
    : getCardSvgPath(card.suit, card.number);

  // Distintivos tradicionales del Truco Argentino para cartas bravas
  let badge: string | null = null;
  if (card) {
    if (card.number === 1 && card.suit === 'espada') badge = 'Macho';
    else if (card.number === 1 && card.suit === 'basto') badge = 'Hembra';
    else if (card.number === 7 && card.suit === 'espada') badge = 'Manilla';
    else if (card.number === 7 && card.suit === 'oro') badge = 'Manilla';
  }

  const cardAlt = isBack
    ? 'Dorso de carta española'
    : `${card?.number} de ${card?.suit}`;

  return (
    <motion.div
      whileHover={isPlayable ? { y: -18, scale: 1.06 } : {}}
      whileTap={isPlayable ? { scale: 0.94 } : {}}
      onClick={isPlayable ? onPlay : undefined}
      className={`relative inline-block select-none transition-all duration-200 ${
        isSmall
          ? 'w-14 sm:w-16 aspect-[66/102]'
          : 'w-24 sm:w-28 md:w-32 aspect-[66/102]'
      } ${
        isPlayable
          ? 'cursor-pointer filter hover:brightness-105'
          : 'cursor-default'
      }`}
    >
      {/* Contenedor del Naipe con sombreado y borde estilizado */}
      <div
        className={`w-full h-full rounded-lg sm:rounded-xl overflow-hidden shadow-2xl bg-white border transition-all duration-200 ${
          isPlayable
            ? 'border-amber-400 ring-2 sm:ring-4 ring-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.65)]'
            : 'border-stone-800/60'
        }`}
      >
        <img
          src={imageSrc}
          alt={cardAlt}
          draggable={false}
          className="w-full h-full object-contain pointer-events-none"
        />
      </div>

      {/* Distintivo de cartas bravas (Macho, Hembra, Manilla) */}
      {badge && !isSmall && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-black text-[10px] tracking-wider uppercase shadow-md border border-amber-300">
          {badge}
        </div>
      )}
    </motion.div>
  );
};
