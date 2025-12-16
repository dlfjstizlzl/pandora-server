import { create } from 'zustand';
import type { UserStats } from './useStore';

export type Profile = {
  uid: string;
  displayName: string;
  email?: string | null;
  photoURL?: string | null;
  role?: 'user' | 'admin';
  stats: UserStats;
};

type ProfileState = {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
