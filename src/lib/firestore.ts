import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from './firebase';
import type { ExperimentMode } from '../store/useStore';

export type TransmissionPayload = {
  type: 'text' | 'sample';
  content?: string;
  sampleUrl?: string;
  mode?: ExperimentMode;
  attachments?: Array<{
    url: string;
    name: string;
    contentType?: string;
  }>;
};

async function ensureUser() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}

export async function saveTransmission(payload: TransmissionPayload) {
  await ensureUser();

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  const docRef = await addDoc(collection(db, 'transmissions'), {
    ...cleanPayload,
    uid: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}
