import { create } from 'zustand';

export type ExperimentMode = 'NORMAL' | 'BLIND' | 'SILENCE';

export type UserStats = {
  logic: number;
  altruism: number;
  aggression: number;
  credit: number;
};

type StoreState = {
  experimentMode: ExperimentMode;
  userStats: UserStats;
  setExperimentMode: (mode: ExperimentMode) => void;
  setUserStats: (stats: Partial<UserStats>) => void;
  isBlind: () => boolean;
  isSilenced: () => boolean;
};

export const useStore = create<StoreState>((set, get) => ({
  experimentMode: 'NORMAL',
  userStats: { logic: 88, altruism: 12, aggression: 82, credit: 99 },
  setExperimentMode: (mode) => set({ experimentMode: mode }),
  setUserStats: (stats) => set((state) => ({ userStats: { ...state.userStats, ...stats } })),
  isBlind: () => get().experimentMode === 'BLIND',
  isSilenced: () => get().experimentMode === 'SILENCE',
}));
