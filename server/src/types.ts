// ============================================================================
// TRUCO ARGENTINO - SERVER TYPE DEFINITIONS
// ============================================================================

export type CardSuit = 'espada' | 'basto' | 'oro' | 'copa';

export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  id: string; // Ej: '1_espada', '7_oro'
  number: CardNumber;
  suit: CardSuit;
  power: number; // 1 a 14 según la escala oficial del Truco Argentino
  envidoValue: number; // 1..7 valen su número, 10..12 valen 0
}

export type TrickRoundNumber = 1 | 2 | 3;

export interface PlayedCard {
  playerId: string;
  card: Card;
  round: TrickRoundNumber;
}

export interface RoundResult {
  round: TrickRoundNumber;
  winnerId: string | 'parda'; // ID del jugador ganador o 'parda' si empatan
}

// Cantos de Envido y Truco
export type EnvidoCallType = 'envido' | 'real_envido' | 'falta_envido';
export type TrucoCallType = 'truco' | 'retruco' | 'vale_cuatro';
export type BetResponse = 'quiero' | 'no_quiero';

export interface EnvidoState {
  history: EnvidoCallType[];
  state: 'not_called' | 'pending' | 'accepted' | 'declined' | 'completed';
  currentCallerId: string | null;
  waitingResponseFrom: string | null;
  pointsIfAccepted: number;
  pointsIfDeclined: number;
  winnerId: string | null;
  pointsWon: number;
  declaredScores: Record<string, number>;
}

export interface TrucoState {
  level: 0 | 1 | 2 | 3; // 0 = sin cantar, 1 = truco, 2 = retruco, 3 = vale cuatro
  currentCall: TrucoCallType | null;
  state: 'not_called' | 'pending' | 'accepted' | 'declined';
  currentCallerId: string | null;
  waitingResponseFrom: string | null;
  lastTeamThatRaisedId: string | null;
  pointsIfAccepted: number;
  pointsIfDeclined: number;
}

export interface HandState {
  handNumber: number;
  dealerId: string;
  handPlayerId: string;
  currentTurnPlayerId: string;
  currentRound: TrickRoundNumber;
  playedCards: PlayedCard[];
  roundResults: RoundResult[];
  envido: EnvidoState;
  truco: TrucoState;
  canCallEnvido: boolean;
  handWinnerId: string | null;
  isHandFinished: boolean;
  scoreAwarded: number;
  reasonEndHand?: string;
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  connected: boolean;
  cards: Card[];
  cardCount: number;
  envidoPoints: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  cardCount: number;
  cards?: Card[];
  envidoPoints?: number;
}

export interface GameLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'canto' | 'play' | 'score' | 'alert';
}

export interface GameState {
  roomId: string;
  targetPoints: 15 | 30;
  scores: Record<string, number>;
  players: Record<string, Player>;
  playerOrder: [string, string];
  currentHand: HandState;
  matchWinnerId: string | null;
  logs: GameLog[];
  status: 'waiting_players' | 'playing' | 'finished';
}

export interface AvailableActions {
  canPlayCards: string[];
  canCallEnvido: boolean;
  canCallRealEnvido: boolean;
  canCallFaltaEnvido: boolean;
  canCallTruco: boolean;
  canCallRetruco: boolean;
  canCallValeCuatro: boolean;
  canRespondQuiero: boolean;
  canRespondNoQuiero: boolean;
  canFold: boolean;
}

export interface ClientGameState {
  roomId: string;
  targetPoints: 15 | 30;
  scores: Record<string, number>;
  myId: string;
  opponent: PublicPlayer | null;
  me: PublicPlayer;
  playerOrder: [string, string];
  currentHand: HandState;
  matchWinnerId: string | null;
  logs: GameLog[];
  status: 'waiting_players' | 'playing' | 'finished';
  availableActions: AvailableActions;
}

export type ClientGameAction =
  | { type: 'play_card'; cardId: string; playerId?: string }
  | { type: 'call_envido'; call: EnvidoCallType; playerId?: string }
  | { type: 'call_truco'; call: TrucoCallType; playerId?: string }
  | { type: 'respond_bet'; response: BetResponse; playerId?: string }
  | { type: 'fold'; playerId?: string };

export interface ServerToClientEvents {
  game_state_sync: (state: ClientGameState) => void;
  room_created: (payload: { roomId: string; isPrivate: boolean }) => void;
  room_joined: (payload: { roomId: string; isPrivate: boolean }) => void;
  room_full: (payload: { message: string }) => void;
  room_not_found: (payload: { message: string }) => void;
  player_disconnected: (payload: { playerId: string; timeoutSeconds: number }) => void;
  player_reconnected: (payload: { playerId: string }) => void;
  game_over: (payload: { winnerId: string; reason: string }) => void;
  error_message: (payload: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  create_room: (payload: { playerId?: string; playerName: string; isPrivate: boolean; targetPoints?: 15 | 30 }) => void;
  join_room: (payload: { roomId: string; playerId?: string; playerName: string }) => void;
  join_public_room: (payload: { playerId?: string; playerName: string; targetPoints?: 15 | 30 }) => void;
  game_action: (action: ClientGameAction) => void;
  reconnect_player: (payload: { roomId: string; playerId: string }) => void;
}
