// ============================================================================
// TRUCO ARGENTINO - SHARED TYPE DEFINITIONS
// Tipos estrictos compartidos entre Frontend y Backend
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

// ============================================================================
// CANTOS Y APUESTAS
// ============================================================================

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
  declaredScores: Record<string, number>; // Tanto declarado por cada jugador
}

export interface TrucoState {
  level: 0 | 1 | 2 | 3; // 0 = sin cantar, 1 = truco, 2 = retruco, 3 = vale cuatro
  currentCall: TrucoCallType | null;
  state: 'not_called' | 'pending' | 'accepted' | 'declined';
  currentCallerId: string | null;
  waitingResponseFrom: string | null;
  lastTeamThatRaisedId: string | null; // El jugador que cantó el nivel actual no puede re-cantar
  pointsIfAccepted: number; // 2, 3 o 4
  pointsIfDeclined: number; // 1, 2 o 3
}

// ============================================================================
// ESTADO DE LA MANO Y PARTIDA
// ============================================================================

export interface HandState {
  handNumber: number;
  dealerId: string; // Quien reparte (Pie)
  handPlayerId: string; // Quien es Mano (inicia y tiene prioridad en empates)
  currentTurnPlayerId: string; // A quién le toca jugar o responder
  currentRound: TrickRoundNumber;
  playedCards: PlayedCard[];
  roundResults: RoundResult[];
  envido: EnvidoState;
  truco: TrucoState;
  canCallEnvido: boolean; // Solo se puede en 1ra ronda antes de jugar la 2da carta del mano
  handWinnerId: string | null;
  isHandFinished: boolean;
  scoreAwarded: number;
  reasonEndHand?: string;
}

export interface Player {
  id: string; // ID único permanente de jugador (UUID en sesión)
  socketId: string;
  name: string;
  connected: boolean;
  cards: Card[]; // Solo disponible en el servidor autoritativo
  cardCount: number; // Visible para el rival (cuántas cartas le quedan)
  envidoPoints: number; // Calculado autoritativamente por el servidor
}

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  cardCount: number;
  cards?: Card[]; // Solo presente para el propio jugador dueño de la mano
  envidoPoints?: number; // Solo se muestra si ya se cantó o terminó el envido
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
  scores: Record<string, number>; // Puntos acumulados en el partido
  players: Record<string, Player>;
  playerOrder: [string, string]; // [jugador1, jugador2]
  currentHand: HandState;
  matchWinnerId: string | null;
  logs: GameLog[];
  status: 'waiting_players' | 'playing' | 'finished';
}

// Vista sanitizada que el backend envía a un jugador específico
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

// ============================================================================
// ACCIONES PERMITIDAS EN TIEMPO REAL
// ============================================================================

export interface AvailableActions {
  canPlayCards: string[]; // IDs de cartas que el jugador puede tirar
  canCallEnvido: boolean;
  canCallRealEnvido: boolean;
  canCallFaltaEnvido: boolean;
  canCallTruco: boolean;
  canCallRetruco: boolean;
  canCallValeCuatro: boolean;
  canRespondQuiero: boolean;
  canRespondNoQuiero: boolean;
  canFold: boolean; // Irse al mazo
}

// ============================================================================
// INTENCIONES DEL CLIENTE (EVENTOS DE ENTRADA)
// ============================================================================

export type ClientGameAction =
  | { type: 'play_card'; cardId: string }
  | { type: 'call_envido'; call: EnvidoCallType }
  | { type: 'call_truco'; call: TrucoCallType }
  | { type: 'respond_bet'; response: BetResponse }
  | { type: 'fold' }; // Me voy al mazo

// ============================================================================
// EVENTOS DE WEBSOCKETS (SOCKET.IO PROTOCOL)
// ============================================================================

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
  create_room: (payload: { playerName: string; isPrivate: boolean; targetPoints?: 15 | 30 }) => void;
  join_room: (payload: { roomId: string; playerName: string }) => void;
  join_public_room: (payload: { playerName: string; targetPoints?: 15 | 30 }) => void;
  game_action: (action: ClientGameAction) => void;
  reconnect_player: (payload: { roomId: string; playerId: string }) => void;
}
