import { Card, CardSuit, EnvidoCallType } from '../../types/truco';

export function calculateEnvidoPoints(cards: Card[]): number {
  if (!cards || cards.length === 0) return 0;

  const suitGroups: Record<CardSuit, Card[]> = {
    espada: [],
    basto: [],
    oro: [],
    copa: [],
  };

  for (const card of cards) {
    suitGroups[card.suit].push(card);
  }

  let maxEnvido = 0;

  for (const suit in suitGroups) {
    const suitCards = suitGroups[suit as CardSuit];
    if (suitCards.length >= 2) {
      if (suitCards.length === 2) {
        const score = 20 + suitCards[0].envidoValue + suitCards[1].envidoValue;
        if (score > maxEnvido) maxEnvido = score;
      } else if (suitCards.length === 3) {
        const values = suitCards.map((c) => c.envidoValue).sort((a, b) => b - a);
        const score = 20 + values[0] + values[1];
        if (score > maxEnvido) maxEnvido = score;
      }
    }
  }

  if (maxEnvido === 0) {
    for (const card of cards) {
      if (card.envidoValue > maxEnvido) {
        maxEnvido = card.envidoValue;
      }
    }
  }

  return maxEnvido;
}

export function calculateEnvidoStakes(
  history: EnvidoCallType[],
  scores: Record<string, number>,
  targetPoints: 15 | 30
): { pointsIfAccepted: number; pointsIfDeclined: number } {
  if (history.length === 0) {
    return { pointsIfAccepted: 0, pointsIfDeclined: 0 };
  }

  const lastCall = history[history.length - 1];

  if (lastCall === 'falta_envido') {
    let declined = 1;
    if (history.length > 1) {
      const priorHistory = history.slice(0, -1);
      declined = calculateEnvidoStakes(priorHistory, scores, targetPoints).pointsIfAccepted;
    }

    const maxScore = Math.max(...Object.values(scores));
    const pointsNeeded = Math.max(1, targetPoints - maxScore);

    return {
      pointsIfAccepted: pointsNeeded,
      pointsIfDeclined: declined,
    };
  }

  let accepted = 0;
  let declined = 1;

  for (let i = 0; i < history.length; i++) {
    const call = history[i];
    if (call === 'envido') {
      if (i === 0) {
        accepted = 2;
        declined = 1;
      } else {
        declined = accepted;
        accepted += 2;
      }
    } else if (call === 'real_envido') {
      if (i === 0) {
        accepted = 3;
        declined = 1;
      } else {
        declined = accepted;
        accepted += 3;
      }
    }
  }

  return { pointsIfAccepted: accepted, pointsIfDeclined: declined };
}

export function resolveEnvidoWinner(
  player1: { id: string; points: number; isHand: boolean },
  player2: { id: string; points: number; isHand: boolean }
): { winnerId: string; loserId: string; reason: string } {
  if (player1.points > player2.points) {
    return {
      winnerId: player1.id,
      loserId: player2.id,
      reason: `${player1.points} a ${player2.points}`,
    };
  } else if (player2.points > player1.points) {
    return {
      winnerId: player2.id,
      loserId: player1.id,
      reason: `${player2.points} a ${player1.points}`,
    };
  } else {
    const winnerId = player1.isHand ? player1.id : player2.id;
    const loserId = player1.isHand ? player2.id : player1.id;
    return {
      winnerId,
      loserId,
      reason: `Empate en ${player1.points} tantos (gana por ser mano)`,
    };
  }
}
