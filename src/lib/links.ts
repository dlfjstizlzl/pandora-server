import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type LinkRecord = {
  targetUid: string;
  createdAt?: unknown;
};

export async function fetchLinks(uid: string): Promise<LinkRecord[]> {
  const snap = await getDocs(collection(db, 'profiles', uid, 'links'));
  return snap.docs.map((d) => d.data() as LinkRecord);
}

export async function linkUser(uid: string, targetUid: string) {
  const ref = doc(db, 'profiles', uid, 'links', targetUid);
  await setDoc(ref, { targetUid, createdAt: serverTimestamp() });
}

export async function unlinkUser(uid: string, targetUid: string) {
  const ref = doc(db, 'profiles', uid, 'links', targetUid);
  await deleteDoc(ref);
}

export async function isLinked(uid: string, targetUid: string): Promise<boolean> {
  const ref = doc(db, 'profiles', uid, 'links', targetUid);
  const snap = await getDoc(ref);
  return snap.exists();
}

// aliases for compatibility
export const follow = linkUser;
export const unfollow = unlinkUser;
