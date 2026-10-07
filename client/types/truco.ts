export type CardSuit = 'espada' | 'basto' | 'oro' | 'copa';

export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  id: string;
  number: CardNumber;
  suit: CardSuit;
  power: number;
  envidoValue: number;
}

export type TrickRoundNumber = 1 | 2 | 3;

export interface PlayedCard {
  playerId: string;
  card: Card;
  round: TrickRoundNumber;
}

export interface RoundResult {
  round: TrickRoundNumber;
  winnerId: string | 'parda';
}

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
  level: 0 | 1 | 2 | 3;
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
