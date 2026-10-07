import {
  AvailableActions,
  BetResponse,
  Card,
  ClientGameState,
  EnvidoCallType,
  GameLog,
  HandState,
  PublicPlayer,
  RoundResult,
  TrickRoundNumber,
  TrucoCallType,
} from '../../types/truco';
import { createDeck, dealCards, shuffleDeck } from './cards';
import {
  calculateEnvidoPoints,
  calculateEnvidoStakes,
  resolveEnvidoWinner,
} from './envido';

export interface LocalPlayer {
  id: string;
  name: string;
  connected: boolean;
  cards: Card[];
  cardCount: number;
  envidoPoints: number;
}

export interface LocalGameState {
  roomId: string;
  targetPoints: 15 | 30;
  scores: Record<string, number>;
  players: Record<string, LocalPlayer>;
  playerOrder: [string, string];
  currentHand: HandState;
  matchWinnerId: string | null;
  logs: GameLog[];
  status: 'waiting_players' | 'playing' | 'finished';
}

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

export function getOpponentId(state: LocalGameState, playerId: string): string {
  const [p1, p2] = state.playerOrder;
  return playerId === p1 ? p2 : p1;
}

export function initLocalGame(
  roomId: string,
  human: { id: string; name: string },
  bot: { id: string; name: string },
  targetPoints: 15 | 30 = 30
): LocalGameState {
  const players: Record<string, LocalPlayer> = {
    [human.id]: {
      id: human.id,
      name: human.name,
      connected: true,
      cards: [],
      cardCount: 0,
      envidoPoints: 0,
    },
    [bot.id]: {
      id: bot.id,
      name: bot.name,
      connected: true,
      cards: [],
      cardCount: 0,
      envidoPoints: 0,
    },
  };

  const initialHand: HandState = {
    handNumber: 0,
    dealerId: bot.id,
    handPlayerId: human.id,
    currentTurnPlayerId: human.id,
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
      pointsIfAccepted: 1,
      pointsIfDeclined: 1,
    },
    canCallEnvido: true,
    handWinnerId: null,
    isHandFinished: false,
    scoreAwarded: 0,
  };

  const gameState: LocalGameState = {
    roomId,
    targetPoints,
    scores: {
      [human.id]: 0,
      [bot.id]: 0,
    },
    players,
    playerOrder: [human.id, bot.id],
    currentHand: initialHand,
    matchWinnerId: null,
    logs: [
      createLog(`¡Partida 1 vs Bot iniciada a ${targetPoints} puntos!`),
      createLog(`${human.name} vs ${bot.name}`),
    ],
    status: 'playing',
  };

  return startNewHand(gameState, human.id, bot.id);
}

export function startNewHand(
  state: LocalGameState,
  handPlayerIdOverride?: string,
  dealerIdOverride?: string
): LocalGameState {
  const [p1, p2] = state.playerOrder;

  let handPlayerId = handPlayerIdOverride;
  let dealerId = dealerIdOverride;

  if (!handPlayerId || !dealerId) {
    if (state.currentHand.handNumber === 0) {
      handPlayerId = p1;
      dealerId = p2;
    } else {
      handPlayerId = state.currentHand.dealerId;
      dealerId = state.currentHand.handPlayerId;
    }
  }

  const deck = shuffleDeck(createDeck());
  const { hand1, hand2 } = dealCards(deck);

  const player1Envido = calculateEnvidoPoints(hand1);
  const player2Envido = calculateEnvidoPoints(hand2);

  const updatedPlayers: Record<string, LocalPlayer> = {
    [p1]: {
      ...state.players[p1],
      cards: hand1,
      cardCount: 3,
      envidoPoints: player1Envido,
    },
    [p2]: {
      ...state.players[p2],
      cards: hand2,
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
      pointsIfAccepted: 1,
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

export function playCard(
  state: LocalGameState,
  playerId: string,
  cardId: string
): LocalGameState {
  const { currentHand, players } = state;

  if (state.matchWinnerId || currentHand.isHandFinished) {
    throw new Error('La mano o partida ya terminó.');
  }

  if (currentHand.envido.state === 'pending' || currentHand.truco.state === 'pending') {
    throw new Error('Hay un canto pendiente. Debe responderse antes de jugar una carta.');
  }

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

  let canCallEnvido = currentHand.canCallEnvido;
  if (currentHand.playedCards.length >= 1) {
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
  const currentRoundPlays = newPlayedCards.filter((p) => p.round === currentHand.currentRound);

  const logs = [
    ...state.logs,
    createLog(`${player.name} jugó el ${playedCard.number} de ${playedCard.suit}`, 'play'),
  ];

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
    logs.push(createLog(`${players[roundWinner].name} ganó la ${currentHand.currentRound}ª ronda`, 'info'));
  }

  const handDecision = evaluateTrickRounds(newRoundResults, currentHand.handPlayerId);

  if (handDecision.isDecided) {
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
      createLog(`¡${players[handWinnerId].name} se lleva la mano! (+${pointsWon} pts)`, 'score')
    );

    let matchWinnerId = state.matchWinnerId;
    if (newScores[handWinnerId] >= state.targetPoints) {
      matchWinnerId = handWinnerId;
      logs.push(createLog(`🏆 ¡${players[handWinnerId].name} ganó el partido!`, 'alert'));
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

    const nextGameState: LocalGameState = {
      ...state,
      scores: newScores,
      players: updatedPlayers,
      currentHand: finishedHand,
      matchWinnerId,
      logs,
      status: matchWinnerId ? 'finished' : 'playing',
    };

    if (!matchWinnerId) {
      return startNewHand(nextGameState);
    }
    return nextGameState;
  }

  const nextRound = (currentHand.currentRound + 1) as TrickRoundNumber;
  let nextTurnPlayerId: string;
  if (roundWinner !== 'parda') {
    nextTurnPlayerId = roundWinner;
  } else {
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
      canCallEnvido: false,
    },
    logs,
  };
}

export function evaluateTrickRounds(
  roundResults: RoundResult[],
  handPlayerId: string
): { isDecided: boolean; winnerId: string | null } {
  if (roundResults.length === 1) return { isDecided: false, winnerId: null };

  const r1 = roundResults[0].winnerId;
  const r2 = roundResults[1].winnerId;

  if (roundResults.length === 2) {
    if (r1 !== 'parda' && r1 === r2) return { isDecided: true, winnerId: r1 };
    if (r1 !== 'parda' && r2 === 'parda') return { isDecided: true, winnerId: r1 };
    if (r1 === 'parda' && r2 !== 'parda') return { isDecided: true, winnerId: r2 };
    return { isDecided: false, winnerId: null };
  }

  if (roundResults.length === 3) {
    const r3 = roundResults[2].winnerId;
    if (r3 !== 'parda') return { isDecided: true, winnerId: r3 };
    if (r1 !== 'parda') return { isDecided: true, winnerId: r1 };
    return { isDecided: true, winnerId: handPlayerId };
  }

  return { isDecided: false, winnerId: null };
}

export function callEnvido(
  state: LocalGameState,
  playerId: string,
  call: EnvidoCallType
): LocalGameState {
  const { currentHand, players } = state;
  const opponentId = getOpponentId(state, playerId);

  if (!currentHand.canCallEnvido) throw new Error('No es momento de cantar Envido.');
  if (currentHand.truco.state === 'accepted' || currentHand.truco.state === 'declined') {
    throw new Error('Ya se resolvió Truco; no se puede cantar Envido.');
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

export function callTruco(
  state: LocalGameState,
  playerId: string,
  call: TrucoCallType
): LocalGameState {
  const { currentHand, players } = state;
  const opponentId = getOpponentId(state, playerId);

  if (currentHand.envido.state === 'pending') {
    throw new Error('Debe resolverse el Envido antes del Truco.');
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
    if (currentHand.truco.level !== 1) throw new Error('No se puede cantar Retruco.');
    nextLevel = 2;
    pointsIfAccepted = 3;
    pointsIfDeclined = 2;
  } else if (call === 'vale_cuatro') {
    if (currentHand.truco.level !== 2) throw new Error('No se puede cantar Vale Cuatro.');
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

export function respondBet(
  state: LocalGameState,
  playerId: string,
  response: BetResponse
): LocalGameState {
  const { currentHand, players } = state;

  if (currentHand.envido.state === 'pending') {
    const opponentId = getOpponentId(state, playerId);
    const logs = [...state.logs];

    if (response === 'no_quiero') {
      const pointsWon = currentHand.envido.pointsIfDeclined;
      const newScores = {
        ...state.scores,
        [opponentId]: state.scores[opponentId] + pointsWon,
      };

      logs.push(
        createLog(`${players[playerId].name} dijo: No Quiero al Envido (+${pointsWon} pt para ${players[opponentId].name})`, 'canto')
      );

      let matchWinnerId = state.matchWinnerId;
      if (newScores[opponentId] >= state.targetPoints) {
        matchWinnerId = opponentId;
        logs.push(createLog(`🏆 ¡${players[opponentId].name} ganó el partido!`, 'alert'));
      }

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
      createLog(`Tantos: ${players[p1Id].name} tiene ${p1Envido}, ${players[p2Id].name} tiene ${p2Envido}.`, 'canto')
    );
    logs.push(
      createLog(`¡${players[winnerId].name} gana el Envido (+${pointsWon} pts)! [${envidoResult.reason}]`, 'score')
    );

    let matchWinnerId = state.matchWinnerId;
    if (newScores[winnerId] >= state.targetPoints) {
      matchWinnerId = winnerId;
      logs.push(createLog(`🏆 ¡${players[winnerId].name} ganó el partido!`, 'alert'));
    }

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

  if (currentHand.truco.state === 'pending') {
    const opponentId = getOpponentId(state, playerId);
    const logs = [...state.logs];

    if (response === 'no_quiero') {
      const pointsWon = currentHand.truco.pointsIfDeclined;
      const newScores = {
        ...state.scores,
        [opponentId]: state.scores[opponentId] + pointsWon,
      };

      logs.push(
        createLog(`${players[playerId].name} dijo: No Quiero al Truco (+${pointsWon} pt para ${players[opponentId].name})`, 'canto')
      );

      let matchWinnerId = state.matchWinnerId;
      if (newScores[opponentId] >= state.targetPoints) {
        matchWinnerId = opponentId;
        logs.push(createLog(`🏆 ¡${players[opponentId].name} ganó el partido!`, 'alert'));
      }

      const nextGameState: LocalGameState = {
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

      if (!matchWinnerId) return startNewHand(nextGameState);
      return nextGameState;
    }

    logs.push(createLog(`${players[playerId].name} dijo: ¡Quiero!`, 'canto'));
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
        canCallEnvido: false,
      },
      logs,
    };
  }

  throw new Error('No hay apuestas pendientes a responder.');
}

export function foldHand(state: LocalGameState, playerId: string): LocalGameState {
  const { currentHand, players } = state;
  const opponentId = getOpponentId(state, playerId);

  let pointsWon = 1;
  if (currentHand.truco.state === 'accepted') {
    pointsWon = currentHand.truco.pointsIfAccepted;
  } else if (currentHand.truco.state === 'pending') {
    pointsWon = currentHand.truco.pointsIfDeclined;
  }

  let extraEnvido = 0;
  if (currentHand.envido.state === 'pending') {
    extraEnvido = currentHand.envido.pointsIfDeclined;
  }

  const totalPoints = pointsWon + extraEnvido;
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

  const nextGameState: LocalGameState = {
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

  if (!matchWinnerId) return startNewHand(nextGameState);
  return nextGameState;
}

export function getAvailableActions(
  state: LocalGameState,
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

  if (state.status !== 'playing' || state.matchWinnerId) return defaultActions;

  const { currentHand, players } = state;
  const player = players[playerId];
  if (!player) return defaultActions;

  if (currentHand.envido.state === 'pending') {
    if (currentHand.envido.waitingResponseFrom === playerId) {
      const history = currentHand.envido.history;
      const lastCall = history[history.length - 1];

      return {
        ...defaultActions,
        canRespondQuiero: true,
        canRespondNoQuiero: true,
        canCallEnvido: history.length === 1 && lastCall === 'envido',
        canCallRealEnvido: lastCall === 'envido',
        canCallFaltaEnvido: lastCall !== 'falta_envido',
        canFold: true,
      };
    }
    return defaultActions;
  }

  if (currentHand.truco.state === 'pending') {
    if (currentHand.truco.waitingResponseFrom === playerId) {
      const level = currentHand.truco.level;
      return {
        ...defaultActions,
        canRespondQuiero: true,
        canRespondNoQuiero: true,
        canCallRetruco: level === 1,
        canCallValeCuatro: level === 2,
        canCallEnvido: currentHand.canCallEnvido && currentHand.envido.state === 'not_called',
        canCallRealEnvido: currentHand.canCallEnvido && currentHand.envido.state === 'not_called',
        canCallFaltaEnvido: currentHand.canCallEnvido && currentHand.envido.state === 'not_called',
        canFold: true,
      };
    }
    return defaultActions;
  }

  const isMyTurn = currentHand.currentTurnPlayerId === playerId;
  if (isMyTurn) {
    const canPlayCards = player.cards.map((c) => c.id);
    const canEnvido = currentHand.canCallEnvido && currentHand.envido.state === 'not_called';

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

export function sanitizeGameStateForPlayer(
  state: LocalGameState,
  playerId: string
): ClientGameState {
  const [p1Id, p2Id] = state.playerOrder;
  const isP1 = playerId === p1Id;
  const opponentId = isP1 ? p2Id : p1Id;

  const me = state.players[playerId];
  const opponent = state.players[opponentId];

  const sanitizedOpponent: PublicPlayer | null = opponent
    ? {
        id: opponent.id,
        name: opponent.name,
        connected: opponent.connected,
        cardCount: opponent.cardCount,
        envidoPoints:
          state.currentHand.envido.state === 'completed'
            ? opponent.envidoPoints
            : undefined,
      }
    : null;

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
