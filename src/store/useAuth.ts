import { create } from 'zustand';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  updateProfile as setAuthProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
};

type AuthActions = {
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  setError: (message: string | null) => void;
};

const provider = new GoogleAuthProvider();

function mapUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

let listenerStarted = false;

export const useAuthStore = create<AuthState & AuthActions>((set) => {
  if (!listenerStarted) {
    listenerStarted = true;
    onAuthStateChanged(auth, (user) => {
      set({ user: mapUser(user), loading: false, initialized: true, error: null });
    });
  }

  return {
    user: null,
    loading: true,
    error: null,
    initialized: false,
    async signInWithGoogle() {
      set({ loading: true, error: null });
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google sign-in failed.';
        set({ error: message });
      } finally {
        set({ loading: false });
      }
    },
    async loginWithEmail(email, password) {
      set({ loading: true, error: null });
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Email sign-in failed.';
        set({ error: message });
      } finally {
        set({ loading: false });
      }
    },
    async registerWithEmail(email, password, displayName) {
      set({ loading: true, error: null });
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await setAuthProfile(cred.user, { displayName });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Signup failed.';
        set({ error: message });
      } finally {
        set({ loading: false });
      }
    },
    async logout() {
      set({ loading: true, error: null });
      try {
        await signOut(auth);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Logout failed.';
        set({ error: message });
      } finally {
        set({ loading: false });
      }
    },
    setError(message) {
      set({ error: message });
    },
  };
});
