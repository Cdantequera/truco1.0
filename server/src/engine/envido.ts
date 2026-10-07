import { Card, CardSuit, EnvidoCallType } from '../types.js';

/**
 * Calcula el puntaje de envido de una mano de 3 cartas según las reglas oficiales:
 * - 2 cartas del mismo palo: 20 + suma de sus valores de envido (1..7 valen su número, 10..12 valen 0).
 * - 3 cartas del mismo palo: 20 + suma de las dos cartas más altas del palo.
 * - 3 cartas de diferente palo: el valor más alto individual (entre 0 y 7).
 */
export function calculateEnvidoPoints(cards: Card[]): number {
  if (!cards || cards.length === 0) return 0;

  // Agrupar cartas por palo
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

  // Revisar si hay 2 o 3 cartas del mismo palo
  for (const suit in suitGroups) {
    const suitCards = suitGroups[suit as CardSuit];
    if (suitCards.length >= 2) {
      if (suitCards.length === 2) {
        const score = 20 + suitCards[0].envidoValue + suitCards[1].envidoValue;
        if (score > maxEnvido) maxEnvido = score;
      } else if (suitCards.length === 3) {
        // Ordenar de mayor a menor según su valor de envido
        const values = suitCards.map((c) => c.envidoValue).sort((a, b) => b - a);
        const score = 20 + values[0] + values[1];
        if (score > maxEnvido) maxEnvido = score;
      }
    }
  }

  // Si no hay cartas del mismo palo, toma la carta individual más alta
  if (maxEnvido === 0) {
    for (const card of cards) {
      if (card.envidoValue > maxEnvido) {
        maxEnvido = card.envidoValue;
      }
    }
  }

  return maxEnvido;
}

/**
 * Calcula los puntos en disputa del Envido según la secuencia de cantos acumulada
 */
export function calculateEnvidoStakes(
  history: EnvidoCallType[],
  scores: Record<string, number>,
  targetPoints: 15 | 30
): { pointsIfAccepted: number; pointsIfDeclined: number } {
  if (history.length === 0) {
    return { pointsIfAccepted: 0, pointsIfDeclined: 0 };
  }

  const lastCall = history[history.length - 1];

  // Caso Falta Envido
  if (lastCall === 'falta_envido') {
    // Puntos si no se quiere la Falta: lo acumulado antes del canto de falta (mínimo 1)
    let declined = 1;
    if (history.length > 1) {
      const priorHistory = history.slice(0, -1);
      declined = calculateEnvidoStakes(priorHistory, scores, targetPoints).pointsIfAccepted;
    }

    // Puntos si se acepta la Falta:
    // En las buenas: lo que le falta al puntero para salir (target - max(puntos)).
    // En las malas: lo que le falta al puntero para terminar el partido o el chico.
    const maxScore = Math.max(...Object.values(scores));
    const pointsNeeded = Math.max(1, targetPoints - maxScore);

    return {
      pointsIfAccepted: pointsNeeded,
      pointsIfDeclined: declined,
    };
  }

  // Secuencia estándar sin falta envido
  // Envido = 2
  // Envido + Envido = 4
  // Real Envido directo = 3
  // Envido + Real Envido = 5
  // Envido + Envido + Real Envido = 7
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

/**
 * Determina el ganador de la disputa de envido
 * Si empatan en puntos, gana quien sea Mano (o tenga prioridad).
 */
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
    // Empate: gana la mano
    const winnerId = player1.isHand ? player1.id : player2.id;
    const loserId = player1.isHand ? player2.id : player1.id;
    return {
      winnerId,
      loserId,
      reason: `Empate en ${player1.points} tantos (gana por ser mano)`,
    };
  }
}
