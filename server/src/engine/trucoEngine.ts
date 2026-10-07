import {
  AvailableActions,
  BetResponse,
  Card,
  ClientGameState,
  EnvidoCallType,
  GameLog,
  GameState,
  HandState,
  Player,
  PublicPlayer,
  RoundResult,
  TrickRoundNumber,
  TrucoCallType,
} from '../types.js';
import { createDeck, dealCards, shuffleDeck } from './cards.js';
import {
  calculateEnvidoPoints,
  calculateEnvidoStakes,
  resolveEnvidoWinner,
} from './envido.js';

/**
 * Generador de logs con ID único
 */
function createLog(
  message: string,
  type: 'info' | 'canto' | 'play' | 'score' | 'alert' = 'info'
): GameLog {
  return {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    message,
    type,
  };
}

/**
 * Obtiene el ID del oponente
 */
export function getOpponentId(state: GameState, playerId: string): string {
  const [p1, p2] = state.playerOrder;
  return playerId === p1 ? p2 : p1;
}

/**
 * Inicializa una nueva partida completa entre dos jugadores
 */
export function initGame(
  roomId: string,
  player1: { id: string; name: string; socketId: string },
  player2: { id: string; name: string; socketId: string },
  targetPoints: 15 | 30 = 30
): GameState {
  const players: Record<string, Player> = {
    [player1.id]: {
      id: player1.id,
      name: player1.name,
      socketId: player1.socketId,
      connected: true,
      cards: [],
      cardCount: 0,
      envidoPoints: 0,
    },
    [player2.id]: {
      id: player2.id,
      name: player2.name,
      socketId: player2.socketId,
      connected: true,
      cards: [],
      cardCount: 0,
      envidoPoints: 0,
    },
  };

  const initialHand: HandState = {
    handNumber: 0,
    dealerId: player2.id, // Jugador 2 reparte primero (es pie)
    handPlayerId: player1.id, // Jugador 1 es Mano
    currentTurnPlayerId: player1.id,
    currentRound: 1,
    playedCards: [],
    roundResults: [],
    envido: {
      history: [],
      state: 'not_called',
      currentCallerId: null,
      waitingResponseFrom: null,
      pointsIfAccepted: 0,
      pointsIfDeclined: 0,
      winnerId: null,
      pointsWon: 0,
      declaredScores: {},
    },
    truco: {
      level: 0,
      currentCall: null,
      state: 'not_called',
      currentCallerId: null,
      waitingResponseFrom: null,
      lastTeamThatRaisedId: null,
      pointsIfAccepted: 1, // Por defecto jugar sin cantar vale 1
      pointsIfDeclined: 1,
    },
    canCallEnvido: true,
    handWinnerId: null,
    isHandFinished: false,
    scoreAwarded: 0,
  };

  const gameState: GameState = {
    roomId,
    targetPoints,
    scores: {
      [player1.id]: 0,
      [player2.id]: 0,
    },
    players,
    playerOrder: [player1.id, player2.id],
    currentHand: initialHand,
    matchWinnerId: null,
    logs: [
      createLog(`¡Comenzó la partida a ${targetPoints} puntos!`),
      createLog(`${player1.name} vs ${player2.name}`),
    ],
    status: 'playing',
  };

  return startNewHand(gameState, player1.id, player2.id);
}

/**
 * Inicia una nueva mano (reparte 3 cartas y resetea rondas y cantos)
 */
export function startNewHand(
  state: GameState,
  handPlayerIdOverride?: string,
  dealerIdOverride?: string
): GameState {
  const [p1, p2] = state.playerOrder;

  // Determinar quién es mano y quién reparte en esta mano
  let handPlayerId = handPlayerIdOverride;
  let dealerId = dealerIdOverride;

  if (!handPlayerId || !dealerId) {
    if (state.currentHand.handNumber === 0) {
      handPlayerId = p1;
      dealerId = p2;
    } else {
      // Rotar mano y pie
      handPlayerId = state.currentHand.dealerId;
      dealerId = state.currentHand.handPlayerId;
    }
  }

  // Barajar y repartir
  const deck = shuffleDeck(createDeck());
  const { hand1, hand2 } = dealCards(deck);

  const player1Cards = hand1;
  const player2Cards = hand2;

  const player1Envido = calculateEnvidoPoints(player1Cards);
  const player2Envido = calculateEnvidoPoints(player2Cards);

  const updatedPlayers: Record<string, Player> = {
    [p1]: {
      ...state.players[p1],
      cards: player1Cards,
      cardCount: 3,
      envidoPoints: player1Envido,
    },
    [p2]: {
      ...state.players[p2],
      cards: player2Cards,
      cardCount: 3,
      envidoPoints: player2Envido,
    },
  };

  const newHand: HandState = {
    handNumber: state.currentHand.handNumber + 1,
    dealerId,
    handPlayerId,
    currentTurnPlayerId: handPlayerId,
    currentRound: 1,
    playedCards: [],
    roundResults: [],
    envido: {
      history: [],
      state: 'not_called',
      currentCallerId: null,
      waitingResponseFrom: null,
      pointsIfAccepted: 0,
      pointsIfDeclined: 0,
      winnerId: null,
      pointsWon: 0,
      declaredScores: {},
    },
    truco: {
      level: 0,
      currentCall: null,
      state: 'not_called',
      currentCallerId: null,
      waitingResponseFrom: null,
      lastTeamThatRaisedId: null,
      pointsIfAccepted: 1, // Si no se canta Truco, la mano vale 1 punto
      pointsIfDeclined: 1,
    },
    canCallEnvido: true,
    handWinnerId: null,
    isHandFinished: false,
    scoreAwarded: 0,
  };

  const handPlayerName = state.players[handPlayerId].name;

  return {
    ...state,
    players: updatedPlayers,
    currentHand: newHand,
    logs: [
      ...state.logs,
      createLog(`--- Mano #${newHand.handNumber} ---`),
      createLog(`Mano: ${handPlayerName}`),
    ],
  };
}

/**
 * Valida y procesa la jugada de una carta
 */
export function playCard(
  state: GameState,
  playerId: string,
  cardId: string
): GameState {
  const { currentHand, players } = state;

  if (state.matchWinnerId) {
    throw new Error('La partida ya ha finalizado.');
  }

  if (currentHand.isHandFinished) {
    throw new Error('La mano ya ha concluido.');
  }

  // Verificar si hay una apuesta pendiente de respuesta
  if (
    currentHand.envido.state === 'pending' ||
    currentHand.truco.state === 'pending'
  ) {
    throw new Error('Hay un canto pendiente. Debe responderse antes de jugar una carta.');
  }

  // Verificar turno
  if (currentHand.currentTurnPlayerId !== playerId) {
    throw new Error('No es tu turno de jugar.');
  }

  const player = players[playerId];
  const cardIndex = player.cards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error('No posees esa carta.');
  }

  const playedCard = player.cards[cardIndex];
  const updatedCards = player.cards.filter((_, idx) => idx !== cardIndex);

  // Si se tira la 2da carta del mano en 1ra ronda, se cierra la posibilidad de cantar envido
  let canCallEnvido = currentHand.canCallEnvido;
  const cardsPlayedInHandSoFar = currentHand.playedCards.length;
  if (cardsPlayedInHandSoFar >= 1) {
    // Si ya tiró el primero y ahora tira el segundo, o si ya tiró el mano su 2da carta
    canCallEnvido = false;
  }

  const newPlayedCard = {
    playerId,
    card: playedCard,
    round: currentHand.currentRound,
  };

  const newPlayedCards = [...currentHand.playedCards, newPlayedCard];

  const updatedPlayers = {
    ...players,
    [playerId]: {
      ...player,
      cards: updatedCards,
      cardCount: updatedCards.length,
    },
  };

  const opponentId = getOpponentId(state, playerId);

  // Comprobar cuántas cartas se han jugado en la ronda actual
  const currentRoundPlays = newPlayedCards.filter(
    (p) => p.round === currentHand.currentRound
  );

  const logs = [
    ...state.logs,
    createLog(`${player.name} jugó el ${playedCard.number} de ${playedCard.suit}`, 'play'),
  ];

  // Si solo jugó uno en esta ronda, pasa el turno al rival
  if (currentRoundPlays.length < 2) {
    return {
      ...state,
      players: updatedPlayers,
      currentHand: {
        ...currentHand,
        playedCards: newPlayedCards,
        currentTurnPlayerId: opponentId,
        canCallEnvido,
      },
      logs,
    };
  }

  // Ambos jugaron en esta ronda: resolver la ronda
  const [play1, play2] = currentRoundPlays;
  let roundWinner: string | 'parda';

  if (play1.card.power > play2.card.power) {
    roundWinner = play1.playerId;
  } else if (play2.card.power > play1.card.power) {
    roundWinner = play2.playerId;
  } else {
    roundWinner = 'parda';
  }

  const newRoundResults: RoundResult[] = [
    ...currentHand.roundResults,
    { round: currentHand.currentRound, winnerId: roundWinner },
  ];

  if (roundWinner === 'parda') {
    logs.push(createLog(`¡Parda en la ${currentHand.currentRound}ª ronda!`, 'alert'));
  } else {
    const winnerName = players[roundWinner].name;
    logs.push(createLog(`${winnerName} ganó la ${currentHand.currentRound}ª ronda`, 'info'));
  }

  // Evaluar si se definió la mano según el reglamento del Truco
  const handDecision = evaluateTrickRounds(
    newRoundResults,
    currentHand.handPlayerId
  );

  if (handDecision.isDecided) {
    // La mano terminó
    const handWinnerId = handDecision.winnerId!;
    const pointsWon =
      currentHand.truco.state === 'accepted'
        ? currentHand.truco.pointsIfAccepted
        : 1;

    const newScores = {
      ...state.scores,
      [handWinnerId]: state.scores[handWinnerId] + pointsWon,
    };

    logs.push(
      createLog(
        `¡${players[handWinnerId].name} se lleva la mano! (+${pointsWon} pts)`,
        'score'
      )
    );

    // Verificar si ganó el partido
    let matchWinnerId = state.matchWinnerId;
    if (newScores[handWinnerId] >= state.targetPoints) {
      matchWinnerId = handWinnerId;
      logs.push(
        createLog(
          `🏆 ¡${players[handWinnerId].name} ganó el partido (${newScores[handWinnerId]} pts)!`,
          'alert'
        )
      );
    }

    const finishedHand: HandState = {
      ...currentHand,
      playedCards: newPlayedCards,
      roundResults: newRoundResults,
      handWinnerId,
      isHandFinished: true,
      scoreAwarded: pointsWon,
      canCallEnvido: false,
    };

    const nextGameState: GameState = {
      ...state,
      scores: newScores,
      players: updatedPlayers,
      currentHand: finishedHand,
      matchWinnerId,
      logs,
      status: matchWinnerId ? 'finished' : 'playing',
    };

    // Si el partido no terminó, iniciar la siguiente mano inmediatamente o tras breve delay
    if (!matchWinnerId) {
      return startNewHand(nextGameState);
    }

    return nextGameState;
  }

  // La mano sigue a la siguiente ronda
  const nextRound = (currentHand.currentRound + 1) as TrickRoundNumber;

  // Quién arranca la siguiente ronda:
  // Si hubo ganador en la ronda actual, arranca el ganador.
  // Si fue parda, arranca quien era mano (o el ganador de la 1ra ronda si fue parda la 2da).
  let nextTurnPlayerId: string;
  if (roundWinner !== 'parda') {
    nextTurnPlayerId = roundWinner;
  } else {
    // Si la 1ra fue parda, arranca el Mano.
    // Si la 2da fue parda, arranca quien ganó la 1ra.
    if (currentHand.currentRound === 1) {
      nextTurnPlayerId = currentHand.handPlayerId;
    } else {
      const firstRoundWinner = newRoundResults[0].winnerId;
      nextTurnPlayerId =
        firstRoundWinner !== 'parda' ? firstRoundWinner : currentHand.handPlayerId;
    }
  }

  return {
    ...state,
    players: updatedPlayers,
    currentHand: {
      ...currentHand,
      playedCards: newPlayedCards,
      roundResults: newRoundResults,
      currentRound: nextRound,
      currentTurnPlayerId: nextTurnPlayerId,
      canCallEnvido: false, // Pasada la 1ra ronda nunca más se puede cantar envido
    },
    logs,
  };
}

/**
 * Evaluación de las 3 rondas del truco contemplando pardas
 */
export function evaluateTrickRounds(
  roundResults: RoundResult[],
  handPlayerId: string
): { isDecided: boolean; winnerId: string | null } {
  if (roundResults.length === 1) {
    return { isDecided: false, winnerId: null };
  }

  const r1 = roundResults[0].winnerId;
  const r2 = roundResults[1].winnerId;

  if (roundResults.length === 2) {
    // R1 A, R2 A -> Gana A
    if (r1 !== 'parda' && r1 === r2) {
      return { isDecided: true, winnerId: r1 };
    }

    // R1 A, R2 Parda -> Gana A (primera parda la segunda gana la primera)
    if (r1 !== 'parda' && r2 === 'parda') {
      return { isDecided: true, winnerId: r1 };
    }

    // R1 Parda, R2 A -> Gana A (parda la primera, el que gana la segunda gana)
    if (r1 === 'parda' && r2 !== 'parda') {
      return { isDecided: true, winnerId: r2 };
    }

    // R1 A, R2 B -> Va a tercera
    // R1 Parda, R2 Parda -> Va a tercera
    return { isDecided: false, winnerId: null };
  }

  if (roundResults.length === 3) {
    const r3 = roundResults[2].winnerId;

    // R1 A, R2 B, R3 C -> Gana C
    if (r3 !== 'parda') {
      return { isDecided: true, winnerId: r3 };
    }

    // R3 Parda con R1 A y R2 B -> Gana quien ganó la 1ra ronda
    if (r1 !== 'parda') {
      return { isDecided: true, winnerId: r1 };
    }

    // Triple parda -> Gana el jugador Mano
    return { isDecided: true, winnerId: handPlayerId };
  }

  return { isDecided: false, winnerId: null };
}

/**
 * Cantar Envido, Real Envido o Falta Envido
 */
export function callEnvido(
  state: GameState,
  playerId: string,
  call: EnvidoCallType
): GameState {
  const { currentHand, players } = state;
  const opponentId = getOpponentId(state, playerId);

  if (!currentHand.canCallEnvido) {
    throw new Error('No es momento reglamentario para cantar Envido.');
  }

  if (
    currentHand.truco.state === 'accepted' ||
    currentHand.truco.state === 'declined'
  ) {
    throw new Error('Ya se cantó y resolvió Truco; no se puede cantar Envido.');
  }

  const history = [...currentHand.envido.history, call];
  const stakes = calculateEnvidoStakes(history, state.scores, state.targetPoints);

  const callNames: Record<EnvidoCallType, string> = {
    envido: '¡Envido!',
    real_envido: '¡Real Envido!',
    falta_envido: '¡Falta Envido!',
  };

  const logs = [
    ...state.logs,
    createLog(`${players[playerId].name} cantó ${callNames[call]}`, 'canto'),
  ];

  return {
    ...state,
    currentHand: {
      ...currentHand,
      envido: {
        ...currentHand.envido,
        history,
        state: 'pending',
        currentCallerId: playerId,
        waitingResponseFrom: opponentId,
        pointsIfAccepted: stakes.pointsIfAccepted,
        pointsIfDeclined: stakes.pointsIfDeclined,
      },
      currentTurnPlayerId: opponentId,
    },
    logs,
  };
}

/**
 * Cantar Truco, Retruco o Vale Cuatro
 */
export function callTruco(
  state: GameState,
  playerId: string,
  call: TrucoCallType
): GameState {
  const { currentHand, players } = state;
  const opponentId = getOpponentId(state, playerId);

  // No se puede cantar Truco si el Envido está pendiente de respuesta
  if (currentHand.envido.state === 'pending') {
    throw new Error('Debe resolverse el Envido antes de cantar Truco.');
  }

  let nextLevel: 1 | 2 | 3;
  let pointsIfAccepted: number;
  let pointsIfDeclined: number;

  if (call === 'truco') {
    if (currentHand.truco.level !== 0) throw new Error('El Truco ya fue cantado.');
    nextLevel = 1;
    pointsIfAccepted = 2;
    pointsIfDeclined = 1;
  } else if (call === 'retruco') {
    if (currentHand.truco.level !== 1) throw new Error('No se puede cantar Retruco ahora.');
    if (currentHand.truco.lastTeamThatRaisedId === playerId) {
      throw new Error('No puedes re-cantar a tu propio canto.');
    }
    nextLevel = 2;
    pointsIfAccepted = 3;
    pointsIfDeclined = 2;
  } else if (call === 'vale_cuatro') {
    if (currentHand.truco.level !== 2) throw new Error('No se puede cantar Vale Cuatro ahora.');
    if (currentHand.truco.lastTeamThatRaisedId === playerId) {
      throw new Error('No puedes re-cantar a tu propio canto.');
    }
    nextLevel = 3;
    pointsIfAccepted = 4;
    pointsIfDeclined = 3;
  } else {
    throw new Error('Canto de Truco inválido.');
  }

  const callNames: Record<TrucoCallType, string> = {
    truco: '¡Truco!',
    retruco: '¡Quiero Retruco!',
    vale_cuatro: '¡Quiero Vale Cuatro!',
  };

  const logs = [
    ...state.logs,
    createLog(`${players[playerId].name} cantó ${callNames[call]}`, 'canto'),
  ];

  return {
    ...state,
    currentHand: {
      ...currentHand,
      truco: {
        ...currentHand.truco,
        level: nextLevel,
        currentCall: call,
        state: 'pending',
        currentCallerId: playerId,
        waitingResponseFrom: opponentId,
        lastTeamThatRaisedId: playerId,
        pointsIfAccepted,
        pointsIfDeclined,
      },
      currentTurnPlayerId: opponentId,
    },
    logs,
  };
}

/**
 * Responder a un canto pendiente ("quiero" o "no_quiero")
 */
export function respondBet(
  state: GameState,
  playerId: string,
  response: BetResponse
): GameState {
  const { currentHand, players } = state;

  // 1. Responder al Envido
  if (currentHand.envido.state === 'pending') {
    if (currentHand.envido.waitingResponseFrom !== playerId) {
      throw new Error('No es tu turno de responder al Envido.');
    }

    const opponentId = getOpponentId(state, playerId);
    const logs = [...state.logs];

    if (response === 'no_quiero') {
      const pointsWon = currentHand.envido.pointsIfDeclined;
      const newScores = {
        ...state.scores,
        [opponentId]: state.scores[opponentId] + pointsWon,
      };

      logs.push(
        createLog(
          `${players[playerId].name} dijo: No Quiero al Envido (+${pointsWon} pt para ${players[opponentId].name})`,
          'canto'
        )
      );

      // Comprobar si termina el partido
      let matchWinnerId = state.matchWinnerId;
      if (newScores[opponentId] >= state.targetPoints) {
        matchWinnerId = opponentId;
        logs.push(createLog(`🏆 ¡${players[opponentId].name} ganó el partido!`, 'alert'));
      }

      // Restablecer el turno de juego de cartas
      const resumeTurnPlayerId = currentHand.playedCards.length === 0
        ? currentHand.handPlayerId
        : getOpponentId(state, currentHand.playedCards[currentHand.playedCards.length - 1].playerId);

      return {
        ...state,
        scores: newScores,
        currentHand: {
          ...currentHand,
          envido: {
            ...currentHand.envido,
            state: 'declined',
            waitingResponseFrom: null,
            winnerId: opponentId,
            pointsWon,
          },
          canCallEnvido: false,
          currentTurnPlayerId: resumeTurnPlayerId,
        },
        matchWinnerId,
        logs,
        status: matchWinnerId ? 'finished' : 'playing',
      };
    }

    // response === 'quiero'
    logs.push(createLog(`${players[playerId].name} dijo: ¡Quiero!`, 'canto'));

    const p1Id = state.playerOrder[0];
    const p2Id = state.playerOrder[1];
    const p1Envido = players[p1Id].envidoPoints;
    const p2Envido = players[p2Id].envidoPoints;

    const envidoResult = resolveEnvidoWinner(
      { id: p1Id, points: p1Envido, isHand: currentHand.handPlayerId === p1Id },
      { id: p2Id, points: p2Envido, isHand: currentHand.handPlayerId === p2Id }
    );

    const winnerId = envidoResult.winnerId;
    const pointsWon = currentHand.envido.pointsIfAccepted;

    const newScores = {
      ...state.scores,
      [winnerId]: state.scores[winnerId] + pointsWon,
    };

    logs.push(
      createLog(
        `Tantos de Envido: ${players[p1Id].name} tiene ${p1Envido}, ${players[p2Id].name} tiene ${p2Envido}.`,
        'canto'
      )
    );
    logs.push(
      createLog(
        `¡${players[winnerId].name} gana el Envido (+${pointsWon} pts)! [${envidoResult.reason}]`,
        'score'
      )
    );

    let matchWinnerId = state.matchWinnerId;
    if (newScores[winnerId] >= state.targetPoints) {
      matchWinnerId = winnerId;
      logs.push(createLog(`🏆 ¡${players[winnerId].name} ganó el partido!`, 'alert'));
    }

    // Si había un canto de Truco que se interrumpió con el envido, vuelve a resolver el truco; si no, al juego de cartas
    let resumeTurnPlayerId = currentHand.currentTurnPlayerId;
    if (currentHand.truco.state === 'pending') {
      resumeTurnPlayerId = currentHand.truco.waitingResponseFrom!;
    } else {
      resumeTurnPlayerId = currentHand.playedCards.length === 0
        ? currentHand.handPlayerId
        : getOpponentId(state, currentHand.playedCards[currentHand.playedCards.length - 1].playerId);
    }

    return {
      ...state,
      scores: newScores,
      currentHand: {
        ...currentHand,
        envido: {
          ...currentHand.envido,
          state: 'completed',
          waitingResponseFrom: null,
          winnerId,
          pointsWon,
          declaredScores: {
            [p1Id]: p1Envido,
            [p2Id]: p2Envido,
          },
        },
        canCallEnvido: false,
        currentTurnPlayerId: resumeTurnPlayerId,
      },
      matchWinnerId,
      logs,
      status: matchWinnerId ? 'finished' : 'playing',
    };
  }

  // 2. Responder al Truco
  if (currentHand.truco.state === 'pending') {
    if (currentHand.truco.waitingResponseFrom !== playerId) {
      throw new Error('No es tu turno de responder al Truco.');
    }

    const opponentId = getOpponentId(state, playerId);
    const logs = [...state.logs];

    if (response === 'no_quiero') {
      const pointsWon = currentHand.truco.pointsIfDeclined;
      const newScores = {
        ...state.scores,
        [opponentId]: state.scores[opponentId] + pointsWon,
      };

      logs.push(
        createLog(
          `${players[playerId].name} dijo: No Quiero al Truco (+${pointsWon} pt para ${players[opponentId].name})`,
          'canto'
        )
      );

      let matchWinnerId = state.matchWinnerId;
      if (newScores[opponentId] >= state.targetPoints) {
        matchWinnerId = opponentId;
        logs.push(createLog(`🏆 ¡${players[opponentId].name} ganó el partido!`, 'alert'));
      }

      const nextGameState: GameState = {
        ...state,
        scores: newScores,
        currentHand: {
          ...currentHand,
          truco: {
            ...currentHand.truco,
            state: 'declined',
            waitingResponseFrom: null,
          },
          handWinnerId: opponentId,
          isHandFinished: true,
          scoreAwarded: pointsWon,
        },
        matchWinnerId,
        logs,
        status: matchWinnerId ? 'finished' : 'playing',
      };

      if (!matchWinnerId) {
        return startNewHand(nextGameState);
      }
      return nextGameState;
    }

    // response === 'quiero'
    logs.push(createLog(`${players[playerId].name} dijo: ¡Quiero!`, 'canto'));

    // Al aceptar el truco, el turno vuelve a quien le correspondía tirar carta
    // (normalmente quien cantó o el que tenía el turno de tirar)
    const turnPlayerId = currentHand.truco.currentCallerId!;

    return {
      ...state,
      currentHand: {
        ...currentHand,
        truco: {
          ...currentHand.truco,
          state: 'accepted',
          waitingResponseFrom: null,
        },
        currentTurnPlayerId: turnPlayerId,
        canCallEnvido: false, // Al decir quiero al Truco se invalida el Envido
      },
      logs,
    };
  }

  throw new Error('No hay ninguna apuesta pendiente a la cual responder.');
}

/**
 * Irse al mazo (Fold)
 */
export function foldHand(state: GameState, playerId: string): GameState {
  const { currentHand, players } = state;
  const opponentId = getOpponentId(state, playerId);

  if (state.matchWinnerId || currentHand.isHandFinished) {
    throw new Error('La mano o partida ya terminó.');
  }

  // Puntos ganados por irse al mazo:
  // Si había truco aceptado, los puntos del truco.
  // Si había truco pendiente, los puntos del no quiero.
  // Si no se cantó nada, 1 punto.
  let pointsWon = 1;
  if (currentHand.truco.state === 'accepted') {
    pointsWon = currentHand.truco.pointsIfAccepted;
  } else if (currentHand.truco.state === 'pending') {
    pointsWon = currentHand.truco.pointsIfDeclined;
  }

  // Si había envido pendiente sin responder, el oponente también se lleva los puntos del envido no querido
  let extraEnvidoPoints = 0;
  if (currentHand.envido.state === 'pending') {
    extraEnvidoPoints = currentHand.envido.pointsIfDeclined;
  }

  const totalPoints = pointsWon + extraEnvidoPoints;
  const newScores = {
    ...state.scores,
    [opponentId]: state.scores[opponentId] + totalPoints,
  };

  const logs = [
    ...state.logs,
    createLog(`¡${players[playerId].name} se fue al mazo! (+${totalPoints} pts para ${players[opponentId].name})`, 'alert'),
  ];

  let matchWinnerId = state.matchWinnerId;
  if (newScores[opponentId] >= state.targetPoints) {
    matchWinnerId = opponentId;
    logs.push(createLog(`🏆 ¡${players[opponentId].name} ganó el partido!`, 'alert'));
  }

  const nextGameState: GameState = {
    ...state,
    scores: newScores,
    currentHand: {
      ...currentHand,
      handWinnerId: opponentId,
      isHandFinished: true,
      scoreAwarded: totalPoints,
    },
    matchWinnerId,
    logs,
    status: matchWinnerId ? 'finished' : 'playing',
  };

  if (!matchWinnerId) {
    return startNewHand(nextGameState);
  }
  return nextGameState;
}

/**
 * Calcula las acciones disponibles en tiempo real para un jugador específico
 */
export function getAvailableActions(
  state: GameState,
  playerId: string
): AvailableActions {
  const defaultActions: AvailableActions = {
    canPlayCards: [],
    canCallEnvido: false,
    canCallRealEnvido: false,
    canCallFaltaEnvido: false,
    canCallTruco: false,
    canCallRetruco: false,
    canCallValeCuatro: false,
    canRespondQuiero: false,
    canRespondNoQuiero: false,
    canFold: false,
  };

  if (state.status !== 'playing' || state.matchWinnerId) {
    return defaultActions;
  }

  const { currentHand, players } = state;
  const player = players[playerId];
  if (!player) return defaultActions;

  // CASO 1: Hay un canto pendiente de Envido
  if (currentHand.envido.state === 'pending') {
    if (currentHand.envido.waitingResponseFrom === playerId) {
      const history = currentHand.envido.history;
      const lastCall = history[history.length - 1];

      return {
        ...defaultActions,
        canRespondQuiero: true,
        canRespondNoQuiero: true,
        // Subidas permitidas de envido
        canCallEnvido: history.length === 1 && lastCall === 'envido',
        canCallRealEnvido: lastCall === 'envido',
        canCallFaltaEnvido: lastCall !== 'falta_envido',
        canFold: true,
      };
    }
    return defaultActions;
  }

  // CASO 2: Hay un canto pendiente de Truco
  if (currentHand.truco.state === 'pending') {
    if (currentHand.truco.waitingResponseFrom === playerId) {
      const level = currentHand.truco.level;
      return {
        ...defaultActions,
        canRespondQuiero: true,
        canRespondNoQuiero: true,
        // Al truco se le puede responder con Retruco, y al retruco con Vale Cuatro
        canCallRetruco: level === 1,
        canCallValeCuatro: level === 2,
        // Si aún es posible cantar envido y el truco no fue aceptado ("el envido va primero"):
        canCallEnvido: currentHand.canCallEnvido && currentHand.envido.state === 'not_called',
        canCallRealEnvido: currentHand.canCallEnvido && currentHand.envido.state === 'not_called',
        canCallFaltaEnvido: currentHand.canCallEnvido && currentHand.envido.state === 'not_called',
        canFold: true,
      };
    }
    return defaultActions;
  }

  // CASO 3: Turno normal para tirar carta o iniciar cantos
  const isMyTurn = currentHand.currentTurnPlayerId === playerId;

  if (isMyTurn) {
    const canPlayCards = player.cards.map((c) => c.id);

    // Cantos de Envido disponibles
    const canEnvido = currentHand.canCallEnvido && currentHand.envido.state === 'not_called';

    // Cantos de Truco disponibles
    const trucoLevel = currentHand.truco.level;
    const trucoState = currentHand.truco.state;
    const lastRaisedId = currentHand.truco.lastTeamThatRaisedId;

    const canCallTruco = trucoLevel === 0;
    const canCallRetruco = trucoLevel === 1 && trucoState === 'accepted' && lastRaisedId !== playerId;
    const canCallValeCuatro = trucoLevel === 2 && trucoState === 'accepted' && lastRaisedId !== playerId;

    return {
      ...defaultActions,
      canPlayCards,
      canCallEnvido: canEnvido,
      canCallRealEnvido: canEnvido,
      canCallFaltaEnvido: canEnvido,
      canCallTruco,
      canCallRetruco,
      canCallValeCuatro,
      canFold: true,
    };
  }

  return defaultActions;
}

/**
 * Sanitiza el estado del juego para un jugador en específico.
 * SEGURIDAD CRÍTICA: Nunca expone las cartas del rival por la red.
 */
export function sanitizeGameStateForPlayer(
  state: GameState,
  playerId: string
): ClientGameState {
  const [p1Id, p2Id] = state.playerOrder;
  const isP1 = playerId === p1Id;
  const opponentId = isP1 ? p2Id : p1Id;

  const me = state.players[playerId];
  const opponent = state.players[opponentId];

  // Sanitizar al oponente: enviar solo cardCount y envido si ya fue declarado
  const sanitizedOpponent: PublicPlayer | null = opponent
    ? {
        id: opponent.id,
        name: opponent.name,
        connected: opponent.connected,
        cardCount: opponent.cardCount,
        // Cartas ocultas: undefined!
        envidoPoints:
          state.currentHand.envido.state === 'completed'
            ? opponent.envidoPoints
            : undefined,
      }
    : null;

  // Sanitizar a uno mismo: incluye sus cartas
  const sanitizedMe: PublicPlayer = {
    id: me.id,
    name: me.name,
    connected: me.connected,
    cardCount: me.cardCount,
    cards: me.cards,
    envidoPoints: me.envidoPoints,
  };

  return {
    roomId: state.roomId,
    targetPoints: state.targetPoints,
    scores: state.scores,
    myId: playerId,
    me: sanitizedMe,
    opponent: sanitizedOpponent,
    playerOrder: state.playerOrder,
    currentHand: state.currentHand,
    matchWinnerId: state.matchWinnerId,
    logs: state.logs,
    status: state.status,
    availableActions: getAvailableActions(state, playerId),
  };
}
