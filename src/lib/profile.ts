import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { UserStats } from '../store/useStore';

export type UserProfile = {
  uid: string;
  displayName: string;
  displayNameLower?: string;
  email?: string | null;
  photoURL?: string | null;
  stats: UserStats;
  role?: 'user' | 'admin';
  updatedAt?: unknown;
  createdAt?: unknown;
};

const defaultStats: UserStats = { logic: 50, altruism: 50, aggression: 50, credit: 50 };

export async function getOrCreateProfile(params: {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}): Promise<UserProfile> {
  const profileRef = doc(db, 'profiles', params.uid);
  const snapshot = await getDoc(profileRef);

  const baseProfile: UserProfile = {
    uid: params.uid,
    displayName: params.displayName || params.email || 'New Subject',
    displayNameLower: (params.displayName || params.email || 'New Subject').toLowerCase(),
    email: params.email ?? null,
    photoURL: params.photoURL ?? null,
    stats: defaultStats,
    role: 'user',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!snapshot.exists()) {
    await setDoc(profileRef, baseProfile);
    return baseProfile;
  }

  const data = snapshot.data() as UserProfile;
  return {
    ...baseProfile,
    ...data,
    uid: params.uid,
    stats: data.stats || defaultStats,
    displayNameLower: (data.displayName || baseProfile.displayName).toLowerCase(),
  };
}

export async function updateProfile(uid: string, update: Partial<UserProfile>) {
  const profileRef = doc(db, 'profiles', uid);
  const withLower = update.displayName ? { displayNameLower: update.displayName.toLowerCase() } : {};
  await updateDoc(profileRef, { ...update, ...withLower, updatedAt: serverTimestamp() });
}
