import { create } from 'zustand';
import { ClientGameState } from '../types/truco';

function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'ssr_player';
  let id = localStorage.getItem('truco_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('truco_player_id', id);
  }
  return id;
}

interface GameStoreState {
  playerId: string;
  gameState: ClientGameState | null;
  isConnected: boolean;
  errorMessage: string | null;
  isSearchingMatch: boolean;
  playerName: string;

  setGameState: (state: ClientGameState | null) => void;
  setIsConnected: (connected: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  setIsSearchingMatch: (searching: boolean) => void;
  setPlayerName: (name: string) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  playerId: getOrCreatePlayerId(),
  gameState: null,
  isConnected: false,
  errorMessage: null,
  isSearchingMatch: false,
  playerName: typeof window !== 'undefined' ? localStorage.getItem('truco_player_name') || '' : '',

  setGameState: (gameState) => set({ gameState }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setIsSearchingMatch: (isSearchingMatch) => set({ isSearchingMatch }),
  setPlayerName: (name) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('truco_player_name', name);
    }
    set({ playerName: name });
  },
  resetGame: () =>
    set({
      gameState: null,
      errorMessage: null,
      isSearchingMatch: false,
    }),
}));
