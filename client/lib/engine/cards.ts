import { Card, CardNumber, CardSuit } from '../../types/truco';

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

  throw new Error(`Carta desconocida: ${number} de ${suit}`);
}

export function getEnvidoValue(number: CardNumber): number {
  if (number >= 1 && number <= 7) return number;
  return 0;
}

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

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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
