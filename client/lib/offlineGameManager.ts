import {
  callEnvido as engineCallEnvido,
  callTruco as engineCallTruco,
  foldHand as engineFoldHand,
  initLocalGame,
  LocalGameState,
  playCard as enginePlayCard,
  respondBet as engineRespondBet,
  sanitizeGameStateForPlayer,
} from './engine/trucoEngine';
import { BotDecision, BotDifficulty, getBotDecision } from './trucoBot';
import { useGameStore } from '../store/useGameStore';
import { BetResponse, ClientGameAction, EnvidoCallType, TrucoCallType } from '../types/truco';

class OfflineGameManager {
  private localState: LocalGameState | null = null;
  private botDifficulty: BotDifficulty = 'medio';
  private humanId = 'human_player';
  private botId = 'pc_bot';
  private botTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  public startOfflineGame(
    humanName: string = 'Jugador',
    targetPoints: 15 | 30 = 30,
    difficulty: BotDifficulty = 'medio'
  ) {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    this.botDifficulty = difficulty;
    const difficultyLabels: Record<BotDifficulty, string> = {
      facil: 'PC (Fácil)',
      medio: 'PC (Medio)',
      dificil: 'PC (Difícil)',
    };

    this.localState = initLocalGame(
      'MESA-LOCAL',
      { id: this.humanId, name: humanName || 'Vos' },
      { id: this.botId, name: difficultyLabels[difficulty] },
      targetPoints
    );

    this.syncClientStore();
    this.checkAndTriggerBotTurn();
  }

  public handleHumanAction(action: ClientGameAction) {
    if (!this.localState || this.localState.status !== 'playing' || this.isProcessing) return;

    try {
      this.applyAction(this.humanId, action);
      this.syncClientStore();
      this.checkAndTriggerBotTurn();
    } catch (err: any) {
      console.warn('Acción humana rechazada:', err.message);
      useGameStore.getState().setErrorMessage(err.message);
    }
  }

  private applyAction(playerId: string, action: ClientGameAction) {
    if (!this.localState) return;

    switch (action.type) {
      case 'play_card':
        this.localState = enginePlayCard(this.localState, playerId, action.cardId);
        break;
      case 'call_envido':
        this.localState = engineCallEnvido(this.localState, playerId, action.call);
        break;
      case 'call_truco':
        this.localState = engineCallTruco(this.localState, playerId, action.call);
        break;
      case 'respond_bet':
        this.localState = engineRespondBet(this.localState, playerId, action.response);
        break;
      case 'fold':
        this.localState = engineFoldHand(this.localState, playerId);
        break;
    }
  }

  private syncClientStore() {
    if (!this.localState) return;
    const clientState = sanitizeGameStateForPlayer(this.localState, this.humanId);
    useGameStore.getState().setGameState(clientState);
  }

  private checkAndTriggerBotTurn() {
    if (!this.localState || this.localState.status !== 'playing' || this.localState.matchWinnerId) {
      return;
    }

    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    const { currentHand } = this.localState;

    const isEnvidoWaitingBot =
      currentHand.envido.state === 'pending' &&
      currentHand.envido.waitingResponseFrom === this.botId;

    const isTrucoWaitingBot =
      currentHand.truco.state === 'pending' &&
      currentHand.truco.waitingResponseFrom === this.botId;

    const isRegularTurnBot =
      currentHand.currentTurnPlayerId === this.botId &&
      currentHand.envido.state !== 'pending' &&
      currentHand.truco.state !== 'pending';

    const isBotTurn = isEnvidoWaitingBot || isTrucoWaitingBot || isRegularTurnBot;
    if (!isBotTurn) return;

    // Latencia humana simulada (800ms a 1400ms)
    const delay = Math.floor(800 + Math.random() * 600);

    this.botTimer = setTimeout(() => {
      this.executeBotTurn();
    }, delay);
  }

  private executeBotTurn() {
    if (!this.localState || this.localState.status !== 'playing') return;

    const botPlayer = this.localState.players[this.botId];
    if (!botPlayer) return;

    // Obtener vista del bot para tomar la decisión
    const botClientView = sanitizeGameStateForPlayer(this.localState, this.botId);
    const decision: BotDecision = getBotDecision(
      botPlayer.cards,
      botClientView,
      this.botDifficulty
    );

    console.log(`🤖 [Bot Decision - ${this.botDifficulty}]`, decision.action, decision.reasoning);

    // Mapear la decisión del bot a la acción correspondiente
    let botAction: ClientGameAction | null = null;

    switch (decision.action) {
      case 'PLAY_CARD':
        if (decision.cardId) {
          botAction = { type: 'play_card', cardId: decision.cardId };
        }
        break;
      case 'CALL_ENVIDO':
        botAction = { type: 'call_envido', call: 'envido' };
        break;
      case 'CALL_REAL_ENVIDO':
        botAction = { type: 'call_envido', call: 'real_envido' };
        break;
      case 'CALL_FALTA_ENVIDO':
        botAction = { type: 'call_envido', call: 'falta_envido' };
        break;
      case 'CALL_TRUCO':
        botAction = { type: 'call_truco', call: 'truco' };
        break;
      case 'CALL_RETRUCO':
        botAction = { type: 'call_truco', call: 'retruco' };
        break;
      case 'CALL_VALE_CUATRO':
        botAction = { type: 'call_truco', call: 'vale_cuatro' };
        break;
      case 'QUIERO':
        botAction = { type: 'respond_bet', response: 'quiero' };
        break;
      case 'NO_QUIERO':
        botAction = { type: 'respond_bet', response: 'no_quiero' };
        break;
      case 'IR_AL_MAZO':
        botAction = { type: 'fold' };
        break;
    }

    if (botAction) {
      try {
        this.applyAction(this.botId, botAction);
        this.syncClientStore();
        // Si tras la acción del bot aún le toca responder o jugar al bot, volver a chequear
        this.checkAndTriggerBotTurn();
      } catch (err: any) {
        console.error('Error aplicando jugada del bot:', err);
      }
    }
  }

  public isOfflineMode(): boolean {
    return this.localState !== null && this.localState.roomId === 'MESA-LOCAL';
  }

  public reset() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.localState = null;
  }
}

export const offlineGameManager = new OfflineGameManager();
