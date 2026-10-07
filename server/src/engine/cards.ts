import { Card, CardNumber, CardSuit } from '../types.js';

/**
 * Jerarquía oficial del Truco Argentino (de mayor a menor poder: 14 a 1):
 * 14 -> 1 de Espada (Macho / Ancho de espada)
 * 13 -> 1 de Basto (Hembra / Ancho de basto)
 * 12 -> 7 de Espada (Manilla espada)
 * 11 -> 7 de Oro (Manilla oro)
 * 10 -> Todos los 3
 * 9  -> Todos los 2
 * 8  -> 1 de Oro y 1 de Copa (Anchos falsos)
 * 7  -> Todos los 12 (Reyes)
 * 6  -> Todos los 11 (Caballos)
 * 5  -> Todos los 10 (Sotas)
 * 4  -> 7 de Basto y 7 de Copa (Sietes falsos)
 * 3  -> Todos los 6
 * 2  -> Todos los 5
 * 1  -> Todos los 4
 */
export function getCardPower(number: CardNumber, suit: CardSuit): number {
  if (number === 1 && suit === 'espada') return 14;
  if (number === 1 && suit === 'basto') return 13;
  if (number === 7 && suit === 'espada') return 12;
  if (number === 7 && suit === 'oro') return 11;
  if (number === 3) return 10;
  if (number === 2) return 9;
  if (number === 1 && (suit === 'oro' || suit === 'copa')) return 8;
  if (number === 12) return 7;
  if (number === 11) return 6;
  if (number === 10) return 5;
  if (number === 7 && (suit === 'basto' || suit === 'copa')) return 4;
  if (number === 6) return 3;
  if (number === 5) return 2;
  if (number === 4) return 1;

  throw new Error(`Carta desconocida en Truco: ${number} de ${suit}`);
}

/**
 * Valor para envido:
 * Las cartas del 1 al 7 valen su número nominal.
 * Las figuras (10, 11, 12) valen 0 puntos.
 */
export function getEnvidoValue(number: CardNumber): number {
  if (number >= 1 && number <= 7) return number;
  return 0; // 10, 11 y 12 valen 0
}

/**
 * Genera el mazo español reglamentario de 40 cartas
 */
export function createDeck(): Card[] {
  const suits: CardSuit[] = ['espada', 'basto', 'oro', 'copa'];
  const numbers: CardNumber[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const num of numbers) {
      deck.push({
        id: `${num}_${suit}`,
        number: num,
        suit,
        power: getCardPower(num, suit),
        envidoValue: getEnvidoValue(num),
      });
    }
  }

  return deck;
}

/**
 * Barajado seguro usando algoritmo Fisher-Yates
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Reparte 3 cartas a cada jugador desde un mazo barajado
 */
export function dealCards(shuffledDeck: Card[]): {
  hand1: Card[];
  hand2: Card[];
  remaining: Card[];
} {
  return {
    hand1: shuffledDeck.slice(0, 3),
    hand2: shuffledDeck.slice(3, 6),
    remaining: shuffledDeck.slice(6),
  };
}
