import {
  AvailableActions,
  Card,
  CardSuit,
  ClientGameState,
  EnvidoCallType,
  EnvidoState,
  PlayedCard,
  RoundResult,
  TrucoCallType,
  TrucoState,
} from '../types/truco';

// ============================================================================
// TIPOS DEL MÓDULO BOT
// ============================================================================

export type BotDifficulty = 'facil' | 'medio' | 'dificil';

export type BotActionType =
  | 'PLAY_CARD'
  | 'CALL_ENVIDO'
  | 'CALL_REAL_ENVIDO'
  | 'CALL_FALTA_ENVIDO'
  | 'CALL_TRUCO'
  | 'CALL_RETRUCO'
  | 'CALL_VALE_CUATRO'
  | 'QUIERO'
  | 'NO_QUIERO'
  | 'IR_AL_MAZO';

export interface BotDecision {
  action: BotActionType;
  cardId?: string;
  cardIndex?: number;
  reasoning: string;
}

export interface TrucoMatchState {
  roomId?: string;
  targetPoints: 15 | 30;
  scores: {
    bot: number;
    opponent: number;
  };
  botPlayerId: string;
  opponentPlayerId: string;
  isBotHand: boolean;
  currentRound: 1 | 2 | 3;
  playedCards: PlayedCard[];
  roundResults: RoundResult[];
  envido: EnvidoState;
  truco: TrucoState;
  canCallEnvido: boolean;
  availableActions: AvailableActions;
}

// ============================================================================
// FUNCIONES AUXILIARES PURAS (Cálculo de poder, envido y lectura de mesa)
// ============================================================================

/**
 * Calcula los puntos de envido para una colección de cartas
 */
export function calculateHandEnvido(cards: Card[]): number {
  if (!cards || cards.length === 0) return 0;

  const suits: Record<CardSuit, Card[]> = {
    espada: [],
    basto: [],
    oro: [],
    copa: [],
  };

  for (const c of cards) {
    suits[c.suit].push(c);
  }

  let max = 0;
  for (const suit in suits) {
    const list = suits[suit as CardSuit];
    if (list.length >= 2) {
      if (list.length === 2) {
        const val = 20 + list[0].envidoValue + list[1].envidoValue;
        if (val > max) max = val;
      } else if (list.length === 3) {
        const vals = list.map((c) => c.envidoValue).sort((a, b) => b - a);
        const val = 20 + vals[0] + vals[1];
        if (val > max) max = val;
      }
    }
  }

  if (max === 0) {
    for (const c of cards) {
      if (c.envidoValue > max) max = c.envidoValue;
    }
  }

  return max;
}

/**
 * Ordena las cartas de menor a mayor poder
 */
function sortCardsAsc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.power - b.power);
}

/**
 * Ordena las cartas de mayor a menor poder
 */
function sortCardsDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.power - a.power);
}

/**
 * Evalúa la fuerza general de la mano (promedio y carta máxima)
 */
function evaluateHandStrength(hand: Card[]) {
  if (hand.length === 0) return { maxPower: 0, avgPower: 0, hasMatador: false };
  const powers = hand.map((c) => c.power);
  const maxPower = Math.max(...powers);
  const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
  // Matadores: Anchos (14, 13), Manillas (12, 11) o Treses (10)
  const hasMatador = maxPower >= 10;
  return { maxPower, avgPower, hasMatador };
}

/**
 * Normaliza el estado de la partida desde TrucoMatchState o ClientGameState
 */
function normalizeMatchState(
  state: TrucoMatchState | ClientGameState,
  botPlayerId?: string
): TrucoMatchState {
  if ('scores' in state && typeof state.scores.bot === 'number') {
    return state as TrucoMatchState;
  }

  // Es un ClientGameState
  const clientState = state as ClientGameState;
  const isMeBot = botPlayerId
    ? clientState.myId === botPlayerId
    : clientState.opponent === null;

  const bId = botPlayerId || (isMeBot ? clientState.myId : clientState.opponent?.id || 'bot');
  const oppId = bId === clientState.myId ? clientState.opponent?.id || 'human' : clientState.myId;

  return {
    roomId: clientState.roomId,
    targetPoints: clientState.targetPoints,
    scores: {
      bot: clientState.scores[bId] || 0,
      opponent: clientState.scores[oppId] || 0,
    },
    botPlayerId: bId,
    opponentPlayerId: oppId,
    isBotHand: clientState.currentHand.handPlayerId === bId,
    currentRound: clientState.currentHand.currentRound,
    playedCards: clientState.currentHand.playedCards,
    roundResults: clientState.currentHand.roundResults,
    envido: clientState.currentHand.envido,
    truco: clientState.currentHand.truco,
    canCallEnvido: clientState.currentHand.canCallEnvido,
    availableActions: clientState.availableActions,
  };
}

// ============================================================================
// MOTOR PRINCIPAL DEL BOT DE TRUCO
// ============================================================================

/**
 * Función pura que calcula la mejor decisión del bot de acuerdo a su mano,
 * la situación de la mesa y la dificultad seleccionada.
 */
export function getBotDecision(
  botHand: Card[],
  rawState: TrucoMatchState | ClientGameState,
  difficulty: BotDifficulty = 'medio'
): BotDecision {
  const state = normalizeMatchState(rawState);
  const { availableActions, currentRound, playedCards, isBotHand, scores, targetPoints } = state;

  // Filtrar las cartas que efectivamente se pueden jugar
  const playableCards = botHand.filter((c) =>
    availableActions.canPlayCards.length > 0
      ? availableActions.canPlayCards.includes(c.id)
      : true
  );

  const envidoPoints = calculateHandEnvido(botHand);
  const handStrength = evaluateHandStrength(botHand);

  // Cartas jugadas en la ronda actual
  const roundPlays = playedCards.filter((p) => p.round === currentRound);
  const opponentPlayThisRound = roundPlays.find((p) => p.playerId !== state.botPlayerId);

  // --------------------------------------------------------------------------
  // 1. RESPUESTA A APUESTAS PENDIENTES (PRIORIDAD MÁXIMA)
  // --------------------------------------------------------------------------

  // A. Respuesta al ENVIDO pendiente
  if (state.envido.state === 'pending' && availableActions.canRespondQuiero) {
    return decideEnvidoResponse(envidoPoints, isBotHand, state, difficulty);
  }

  // B. Respuesta al TRUCO pendiente
  if (state.truco.state === 'pending' && availableActions.canRespondQuiero) {
    return decideTrucoResponse(botHand, handStrength, state, difficulty);
  }

  // --------------------------------------------------------------------------
  // 2. INICIAR CANTOS (ENVIDO Y TRUCO)
  // --------------------------------------------------------------------------

  // A. Cantar Envido antes de tirar carta (si es legal)
  if (availableActions.canCallEnvido && state.envido.state === 'not_called') {
    const envidoCall = decideInitiateEnvido(envidoPoints, isBotHand, state, difficulty);
    if (envidoCall) return envidoCall;
  }

  // B. Cantar Truco / Retruco / Vale Cuatro antes de tirar carta
  const trucoCall = decideInitiateTruco(botHand, handStrength, state, difficulty);
  if (trucoCall) return trucoCall;

  // --------------------------------------------------------------------------
  // 3. JUGAR CARTA (Baza actual)
  // --------------------------------------------------------------------------
  if (playableCards.length > 0) {
    return decideCardToPlay(
      playableCards,
      opponentPlayThisRound?.card,
      state,
      difficulty
    );
  }

  // Si no puede tirar carta ni cantar (caso excepcional), se va al mazo
  return {
    action: 'IR_AL_MAZO',
    reasoning: 'Sin acciones disponibles viables',
  };
}

// ============================================================================
// HEURÍSTICAS DE RESPUESTA A ENVIDO
// ============================================================================

function decideEnvidoResponse(
  envidoPoints: number,
  isBotHand: boolean,
  state: TrucoMatchState,
  difficulty: BotDifficulty
): BotDecision {
  const { availableActions, envido, scores, targetPoints } = state;
  const history = envido.history;
  const lastCall = history[history.length - 1];

  // --- DIFICULTAD FÁCIL ---
  if (difficulty === 'facil') {
    // Solo acepta con 28 puntos o más. Cero subidas.
    if (envidoPoints >= 28) {
      return { action: 'QUIERO', reasoning: `[Fácil] Tengo ${envidoPoints} puntos (>= 28)` };
    }
    return { action: 'NO_QUIERO', reasoning: `[Fácil] Tengo ${envidoPoints} puntos (< 28)` };
  }

  // --- DIFICULTAD MEDIA ---
  if (difficulty === 'medio') {
    // Mano: acepta con 26+. Pie: acepta con 27+.
    const threshold = isBotHand ? 26 : 27;

    // Con 31 o más, busca subir la apuesta
    if (envidoPoints >= 31) {
      if (lastCall === 'envido' && availableActions.canCallRealEnvido) {
        return { action: 'CALL_REAL_ENVIDO', reasoning: `[Medio] Tengo ${envidoPoints} puntos, subo a Real Envido` };
      }
      if (lastCall === 'envido' && availableActions.canCallEnvido) {
        return { action: 'CALL_ENVIDO', reasoning: `[Medio] Tengo ${envidoPoints} puntos, subo a Envido-Envido` };
      }
    }

    if (envidoPoints >= threshold) {
      return { action: 'QUIERO', reasoning: `[Medio] Acepto con ${envidoPoints} puntos (umbral: ${threshold})` };
    }
    return { action: 'NO_QUIERO', reasoning: `[Medio] No quiero con ${envidoPoints} puntos (umbral: ${threshold})` };
  }

  // --- DIFICULTAD DIFÍCIL (Lectura de tanteador y psicología de peña) ---
  const isMalas = scores.bot < targetPoints / 2;
  const botTrailing = scores.opponent - scores.bot >= 5;
  const botCloseToWinning = targetPoints - scores.bot <= 4;

  // Si está cerca de ganar el partido, asegura el tanto
  if (botCloseToWinning && envidoPoints >= 28 && isBotHand) {
    return { action: 'QUIERO', reasoning: `[Difícil] Definiendo partido: ${envidoPoints} puntos siendo mano` };
  }

  // En las malas y perdiendo por mucho con mano monstruosa (30+): arriesga Falta Envido
  if (isMalas && botTrailing && envidoPoints >= 31 && availableActions.canCallFaltaEnvido) {
    return { action: 'CALL_FALTA_ENVIDO', reasoning: `[Difícil] En las malas perdiendo por ${scores.opponent - scores.bot}, clavo Falta Envido con ${envidoPoints}` };
  }

  // Umbral dinámico por posición: Mano gana empates (25+), Pie necesita más (27+)
  const dynamicThreshold = isBotHand ? 25 : 27;

  if (envidoPoints >= 32 && availableActions.canCallRealEnvido && lastCall === 'envido') {
    return { action: 'CALL_REAL_ENVIDO', reasoning: `[Difícil] 32+ puntos: subo a Real Envido` };
  }

  if (envidoPoints >= dynamicThreshold) {
    return { action: 'QUIERO', reasoning: `[Difícil] Quiero con ${envidoPoints} tantos (Mano: ${isBotHand})` };
  }

  return { action: 'NO_QUIERO', reasoning: `[Difícil] No quiero con ${envidoPoints} tantos` };
}

// ============================================================================
// HEURÍSTICAS DE INICIACIÓN DE ENVIDO
// ============================================================================

function decideInitiateEnvido(
  envidoPoints: number,
  isBotHand: boolean,
  state: TrucoMatchState,
  difficulty: BotDifficulty
): BotDecision | null {
  const { availableActions, scores, targetPoints } = state;

  if (difficulty === 'facil') {
    if (envidoPoints >= 28) {
      return { action: 'CALL_ENVIDO', reasoning: `[Fácil] Canto Envido directo con ${envidoPoints}` };
    }
    return null;
  }

  if (difficulty === 'medio') {
    const minToCall = isBotHand ? 26 : 28;
    if (envidoPoints >= 31 && availableActions.canCallRealEnvido) {
      return { action: 'CALL_REAL_ENVIDO', reasoning: `[Medio] Canto Real Envido con ${envidoPoints}` };
    }
    if (envidoPoints >= minToCall) {
      return { action: 'CALL_ENVIDO', reasoning: `[Medio] Canto Envido con ${envidoPoints} (Mano: ${isBotHand})` };
    }
    return null;
  }

  // DIFICULTAD DIFÍCIL
  const isMalas = scores.bot < targetPoints / 2;
  const botTrailing = scores.opponent - scores.bot >= 6;

  // En las malas y muy abajo con 32 o 33: canto Falta Envido de entrada
  if (isMalas && botTrailing && envidoPoints >= 32 && availableActions.canCallFaltaEnvido) {
    return { action: 'CALL_FALTA_ENVIDO', reasoning: `[Difícil] Falta Envido de entrada en las malas con ${envidoPoints}` };
  }

  if (envidoPoints >= 31 && availableActions.canCallRealEnvido) {
    return { action: 'CALL_REAL_ENVIDO', reasoning: `[Difícil] Real Envido con ${envidoPoints}` };
  }

  // Si es mano canta con 26+, si es pie espera o canta con 27+
  if (envidoPoints >= (isBotHand ? 26 : 27)) {
    return { action: 'CALL_ENVIDO', reasoning: `[Difícil] Canto Envido con ${envidoPoints} (Mano: ${isBotHand})` };
  }

  return null;
}

// ============================================================================
// HEURÍSTICAS DE RESPUESTA A TRUCO / RETRUCO / VALE CUATRO
// ============================================================================

function decideTrucoResponse(
  botHand: Card[],
  handStrength: { maxPower: number; avgPower: number; hasMatador: boolean },
  state: TrucoMatchState,
  difficulty: BotDifficulty
): BotDecision {
  const { truco, availableActions, roundResults } = state;
  const level = truco.level;

  // --- DIFICULTAD FÁCIL (Cero bluffing, solo cartas ultra top) ---
  if (difficulty === 'facil') {
    // Solo acepta si tiene carta poder >= 11 (7 de oro, 7 de espada, 1 de basto, 1 de espada)
    if (handStrength.maxPower >= 11) {
      return { action: 'QUIERO', reasoning: `[Fácil] Acepto porque tengo carta top (poder ${handStrength.maxPower})` };
    }
    return { action: 'NO_QUIERO', reasoning: `[Fácil] No tengo cartas bravas (< 11)` };
  }

  // --- DIFICULTAD MEDIA ---
  if (difficulty === 'medio') {
    // Si ya ganó la 1ra ronda, es muy difícil que no acepte
    const wonR1 = roundResults.length > 0 && roundResults[0].winnerId === state.botPlayerId;
    const canRetruco = level === 1 && availableActions.canCallRetruco;

    // Subida con cartas salvajes (Anchos)
    if (handStrength.maxPower >= 13 && canRetruco) {
      return { action: 'CALL_RETRUCO', reasoning: `[Medio] Retruco con Ancho (poder ${handStrength.maxPower})` };
    }

    if (wonR1 || handStrength.maxPower >= 10 || (handStrength.maxPower >= 8 && botHand.length >= 2)) {
      return { action: 'QUIERO', reasoning: `[Medio] Mano respetable para aceptar Truco (max: ${handStrength.maxPower})` };
    }

    return { action: 'NO_QUIERO', reasoning: `[Medio] Mano insuficiente para responder al Truco` };
  }

  // --- DIFICULTAD DIFÍCIL (Lectura de contexto, pardas y probabilidades) ---
  const wonR1 = roundResults.length > 0 && roundResults[0].winnerId === state.botPlayerId;
  const isR1Parda = roundResults.length > 0 && roundResults[0].winnerId === 'parda';

  // Si la 1ra fue parda y el bot es Mano: acepta con casi cualquier carta media porque la parda en 2da o 3ra le da el juego
  if (isR1Parda && state.isBotHand && handStrength.maxPower >= 7) {
    return { action: 'QUIERO', reasoning: `[Difícil] Primera parda y soy mano: tengo ventaja reglamentaria` };
  }

  // Manos monstruosas: subir a Retruco o Vale Cuatro
  if (level === 1 && availableActions.canCallRetruco && handStrength.maxPower >= 12) {
    return { action: 'CALL_RETRUCO', reasoning: `[Difícil] ¡Quiero Retruco! Mano armada con manilla o ancho` };
  }

  if (level === 2 && availableActions.canCallValeCuatro && handStrength.maxPower >= 13) {
    return { action: 'CALL_VALE_CUATRO', reasoning: `[Difícil] ¡Quiero Vale Cuatro! Tengo Ancho invicto` };
  }

  // Con 1ra ganada, cualquier carta >= 9 es un Quiero cantado
  if (wonR1 && handStrength.maxPower >= 8) {
    return { action: 'QUIERO', reasoning: `[Difícil] 1ª ronda ganada y carta decente (poder ${handStrength.maxPower})` };
  }

  // En 3ra ronda con carta >= 10 (un 3 o mejor): siempre Quiero
  if (state.currentRound === 3 && handStrength.maxPower >= 10) {
    return { action: 'QUIERO', reasoning: `[Difícil] Tercera ronda con carta mayor a 3 (poder ${handStrength.maxPower})` };
  }

  // Probabilidad de aceptación si la mano es competitiva
  if (handStrength.maxPower >= 9) {
    return { action: 'QUIERO', reasoning: `[Difícil] Carta de peso para pelear la baza` };
  }

  return { action: 'NO_QUIERO', reasoning: `[Difícil] No quiero Truco: probabilidades matemáticas bajas` };
}

// ============================================================================
// HEURÍSTICAS DE INICIACIÓN DE TRUCO
// ============================================================================

function decideInitiateTruco(
  botHand: Card[],
  handStrength: { maxPower: number; avgPower: number; hasMatador: boolean },
  state: TrucoMatchState,
  difficulty: BotDifficulty
): BotDecision | null {
  const { availableActions, currentRound, roundResults } = state;

  if (difficulty === 'facil') {
    // Solo canta truco si tiene al menos 1 ancho o manilla (poder >= 12)
    if (availableActions.canCallTruco && handStrength.maxPower >= 12) {
      return { action: 'CALL_TRUCO', reasoning: `[Fácil] Canto Truco con carta superior a manilla` };
    }
    return null;
  }

  if (difficulty === 'medio') {
    const wonR1 = roundResults.length > 0 && roundResults[0].winnerId === state.botPlayerId;

    if (availableActions.canCallTruco) {
      // Canta truco con mano sólida
      if (handStrength.maxPower >= 11 || (wonR1 && handStrength.maxPower >= 9)) {
        return { action: 'CALL_TRUCO', reasoning: `[Medio] Canto Truco con mano ganadora o 1ª a favor` };
      }
      // Bluffing bajo (15% de probabilidad si estamos en 2da o 3ra ronda)
      if (currentRound >= 2 && Math.random() < 0.15) {
        return { action: 'CALL_TRUCO', reasoning: `[Medio] Bluff ligero (15%) en ronda ${currentRound}` };
      }
    }

    if (availableActions.canCallRetruco && handStrength.maxPower >= 12) {
      return { action: 'CALL_RETRUCO', reasoning: `[Medio] Canto Retruco con carta alta` };
    }

    return null;
  }

  // DIFICULTAD DIFÍCIL (Bluffing calculado y control de ronda)
  const wonR1 = roundResults.length > 0 && roundResults[0].winnerId === state.botPlayerId;
  const isR1Parda = roundResults.length > 0 && roundResults[0].winnerId === 'parda';

  if (availableActions.canCallTruco) {
    // Si ganó primera y tiene al menos un 2 o un Rey (>= 7), aprieta con Truco
    if (wonR1 && handStrength.maxPower >= 7) {
      return { action: 'CALL_TRUCO', reasoning: `[Difícil] Gané primera, canto Truco para forzar o cobrar` };
    }

    // Si tiene Ancho de espada o de basto (>= 13), canta Truco en 2da ronda para asfixiar
    if (handStrength.maxPower >= 13 && currentRound >= 2) {
      return { action: 'CALL_TRUCO', reasoning: `[Difícil] Ancho en mano: aprieto con Truco en ronda ${currentRound}` };
    }

    // Si la 1ra fue parda y el bot es Mano: canto Truco de una
    if (isR1Parda && state.isBotHand) {
      return { action: 'CALL_TRUCO', reasoning: `[Difícil] Primera parda y soy mano: canto Truco` };
    }

    // Bluffing calculado (25% en 2da/3ra si el bot tiene posición favorable)
    if (currentRound >= 2 && Math.random() < 0.25) {
      return { action: 'CALL_TRUCO', reasoning: `[Difícil] Mentira calculada (25%) aprovechando debilidad del rival` };
    }
  }

  if (availableActions.canCallRetruco && (handStrength.maxPower >= 12 || (wonR1 && handStrength.maxPower >= 10))) {
    return { action: 'CALL_RETRUCO', reasoning: `[Difícil] Retruco táctico con control de mesa` };
  }

  if (availableActions.canCallValeCuatro && handStrength.maxPower >= 13) {
    return { action: 'CALL_VALE_CUATRO', reasoning: `[Difícil] ¡Vale Cuatro! Con Ancho definitorio` };
  }

  return null;
}

// ============================================================================
// HEURÍSTICAS DE TIRADA DE CARTA
// ============================================================================

function decideCardToPlay(
  playableCards: Card[],
  opponentCard: Card | undefined,
  state: TrucoMatchState,
  difficulty: BotDifficulty
): BotDecision {
  const sortedAsc = sortCardsAsc(playableCards);
  const sortedDesc = sortCardsDesc(playableCards);

  // --------------------------------------------------------------------------
  // NIVEL FÁCIL: Juego plano (siempre la carta más baja primero)
  // --------------------------------------------------------------------------
  if (difficulty === 'facil') {
    const card = sortedAsc[0];
    return {
      action: 'PLAY_CARD',
      cardId: card.id,
      reasoning: `[Fácil] Tira carta más baja (${card.number} de ${card.suit}, poder ${card.power})`,
    };
  }

  // --------------------------------------------------------------------------
  // NIVEL MEDIO: Economía de bazas
  // --------------------------------------------------------------------------
  if (difficulty === 'medio') {
    // Si el rival ya tiró en esta ronda:
    if (opponentCard) {
      // Buscar la carta MÍNIMA que supere a la del rival
      const winningCards = sortedAsc.filter((c) => c.power > opponentCard.power);
      if (winningCards.length > 0) {
        const bestCard = winningCards[0];
        return {
          action: 'PLAY_CARD',
          cardId: bestCard.id,
          reasoning: `[Medio] Mata al ${opponentCard.number} de ${opponentCard.suit} con la mínima carta necesaria (${bestCard.number} de ${bestCard.suit})`,
        };
      }

      // Si no le alcanza para matar, descarta su carta más baja
      const discard = sortedAsc[0];
      return {
        action: 'PLAY_CARD',
        cardId: discard.id,
        reasoning: `[Medio] No puede matar al rival; descarta la más baja (${discard.number} de ${discard.suit})`,
      };
    }

    // Si el bot tira primero en la ronda:
    if (state.currentRound === 1) {
      // En primera ronda tira una carta intermedia o alta para disputar la baza
      const midCard = sortedDesc.length >= 2 ? sortedDesc[1] : sortedDesc[0];
      return {
        action: 'PLAY_CARD',
        cardId: midCard.id,
        reasoning: `[Medio] Abre 1ª ronda con carta media/alta (${midCard.number} de ${midCard.suit})`,
      };
    }

    // En 2ª o 3ª ronda tira su carta más fuerte para definir
    const topCard = sortedDesc[0];
    return {
      action: 'PLAY_CARD',
      cardId: topCard.id,
      reasoning: `[Medio] Tira su carta más fuerte disponible (${topCard.number} de ${topCard.suit})`,
    };
  }

  // --------------------------------------------------------------------------
  // NIVEL DIFÍCIL: Estrategia de Primera, Pardas y Lectura de Baraja
  // --------------------------------------------------------------------------
  const { currentRound, roundResults, isBotHand } = state;

  // CASO: EL RIVAL YA JUGÓ EN ESTA RONDA (El bot responde)
  if (opponentCard) {
    const oppPower = opponentCard.power;

    // Cartas que le ganan al rival
    const winningCards = sortedAsc.filter((c) => c.power > oppPower);
    // Cartas que empatan (pardan) con el rival
    const tyingCards = sortedAsc.filter((c) => c.power === oppPower);

    // ESTRATEGIA DE PARDA EN 1ª RONDA:
    // Si el bot es Mano y puede empatar con carta chica/mediana: ¡la parda favorece al mano!
    if (currentRound === 1 && isBotHand && tyingCards.length > 0) {
      const tieCard = tyingCards[0];
      return {
        action: 'PLAY_CARD',
        cardId: tieCard.id,
        reasoning: `[Difícil] Parda táctica en 1ª ronda siendo Mano con ${tieCard.number} de ${tieCard.suit}`,
      };
    }

    // Si puede matar la carta del rival:
    if (winningCards.length > 0) {
      // Si el rival tiró un Ancho (14 o 13) en 1ª ronda:
      // Si el bot tiene el 1 de espada y el rival tiró 1 de basto, lo mata con 1 de espada.
      // Pero si para matar tiene que gastar su única carta salvadora y quedar desnudo, evalúa "ir a menos":
      if (currentRound === 1 && oppPower >= 12 && playableCards.length === 3) {
        const minWinner = winningCards[0];
        // Si la que gana es un 1 de espada o basto pero sus otras 2 cartas son basuras (< 5),
        // matar le garantiza 1ra pero le deja 2da y 3ra perdidas. Mata con la mínima que gane.
        return {
          action: 'PLAY_CARD',
          cardId: minWinner.id,
          reasoning: `[Difícil] Mata carta brava del rival en 1ª con ${minWinner.number} de ${minWinner.suit}`,
        };
      }

      // En cualquier otro caso, mata con la mínima carta posible (eficiencia de poder)
      const optimalWinner = winningCards[0];
      return {
        action: 'PLAY_CARD',
        cardId: optimalWinner.id,
        reasoning: `[Difícil] Mata con la menor carta posible (${optimalWinner.number} de ${optimalWinner.suit})`,
      };
    }

    // Si NO le puede ganar al rival:
    // "Ir a menos": regala su carta más baja para guardarse las cartas más fuertes para las siguientes rondas
    const lowest = sortedAsc[0];
    return {
      action: 'PLAY_CARD',
      cardId: lowest.id,
      reasoning: `[Difícil] No puede matar; va a menos tirando la más débil (${lowest.number} de ${lowest.suit})`,
    };
  }

  // CASO: EL BOT JUEGA PRIMERO EN LA RONDA (Abre la baza)
  if (currentRound === 1) {
    // "La primera vale dos":
    // Si tiene una carta muy alta (>= 11) y una carta media (>= 8): abre con la alta para ganar primera
    if (sortedDesc[0].power >= 10 && sortedDesc.length >= 2 && sortedDesc[1].power >= 7) {
      const leadCard = sortedDesc[0];
      return {
        action: 'PLAY_CARD',
        cardId: leadCard.id,
        reasoning: `[Difícil] Abre 1ª ronda fuerte para asegurar primera (${leadCard.number} de ${leadCard.suit})`,
      };
    }

    // Si tiene una sola carta buena y dos chicas: tira una chica para sondear la mano del rival ("engañar")
    if (sortedDesc[0].power >= 11 && sortedDesc[1].power <= 5) {
      const baitCard = sortedAsc[0];
      return {
        action: 'PLAY_CARD',
        cardId: baitCard.id,
        reasoning: `[Difícil] Tira señuelo en 1ª para hacer quemar carta al rival (${baitCard.number} de ${baitCard.suit})`,
      };
    }

    // En general abre con carta media
    const openingCard = sortedDesc.length >= 2 ? sortedDesc[1] : sortedDesc[0];
    return {
      action: 'PLAY_CARD',
      cardId: openingCard.id,
      reasoning: `[Difícil] Apertura estratégica con carta intermedia (${openingCard.number} de ${openingCard.suit})`,
    };
  }

  if (currentRound === 2) {
    const wonR1 = roundResults.length > 0 && roundResults[0].winnerId === state.botPlayerId;
    const isR1Parda = roundResults.length > 0 && roundResults[0].winnerId === 'parda';

    // Si la 1ra fue parda: ¡el que gana 2da gana el partido! Tira la más alta que tenga sin dudar
    if (isR1Parda) {
      const killerCard = sortedDesc[0];
      return {
        action: 'PLAY_CARD',
        cardId: killerCard.id,
        reasoning: `[Difícil] Primera fue parda; tira a matar en 2ª con ${killerCard.number} de ${killerCard.suit}`,
      };
    }

    // Si ganó la 1ra: tira su carta más fuerte para liquidar la mano de inmediato
    if (wonR1) {
      const finisherCard = sortedDesc[0];
      return {
        action: 'PLAY_CARD',
        cardId: finisherCard.id,
        reasoning: `[Difícil] Ganó 1ª: remata la mano en 2ª con ${finisherCard.number} de ${finisherCard.suit}`,
      };
    }

    // Si perdió la 1ra: está obligado a ganar la 2da para forzar la 3ra baza
    const mustWinCard = sortedDesc[0];
    return {
      action: 'PLAY_CARD',
      cardId: mustWinCard.id,
      reasoning: `[Difícil] Perdió 1ª: obligado a poner lo mejor en 2ª (${mustWinCard.number} de ${mustWinCard.suit})`,
    };
  }

  // Ronda 3: Tira la carta final más potente
  const finalCard = sortedDesc[0];
  return {
    action: 'PLAY_CARD',
    cardId: finalCard.id,
    reasoning: `[Difícil] Ronda definitoria: tira ${finalCard.number} de ${finalCard.suit}`,
  };
}
