import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type UiConfig = {
  primaryButtonLabel?: string;
  tickerMessage?: string;
  layoutMode?: 'default' | 'compact';
};

export function subscribeUiConfig(callback: (config: UiConfig | null) => void) {
  const ref = doc(db, 'experiments', 'global');
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(snap.data() as UiConfig);
  });
}

export async function updateUiConfig(config: UiConfig) {
  const ref = doc(db, 'experiments', 'global');
  await setDoc(ref, config, { merge: true });
}
