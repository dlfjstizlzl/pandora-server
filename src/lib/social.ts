import { addDoc, collection, deleteDoc, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function toggleLike(transmissionId: string, uid: string) {
  const likeRef = doc(db, 'transmissions', transmissionId, 'likes', uid);
  const docRef = doc(db, 'transmissions', transmissionId);
  const snap = await getDoc(likeRef);

  if (snap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(docRef, { likes: increment(-1) });
    return { liked: false };
  }

  await setDoc(likeRef, { uid, createdAt: serverTimestamp() });
  await updateDoc(docRef, { likes: increment(1) });
  return { liked: true };
}

export async function addComment(transmissionId: string, uid: string, text: string) {
  const commentsRef = collection(db, 'transmissions', transmissionId, 'comments');
  const docRef = doc(db, 'transmissions', transmissionId);
  await addDoc(commentsRef, {
    uid,
    text,
    createdAt: serverTimestamp(),
  });
  await updateDoc(docRef, { comments: increment(1) });
}
