import { useEffect, useState } from 'react';
import { HexagonChart } from '../components/ui/HexagonChart';
import { PandoraAvatar } from '../components/ui/PandoraAvatar';
import { AuthForm } from '../components/features/AuthForm';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuth';
import { fetchLinks } from '../lib/links';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Profile() {
  const stats = useStore((s) => s.userStats);
  const user = useAuthStore((s) => s.user);
  const [links, setLinks] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<{ uid: string; displayName: string; email?: string | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchLinks(user.uid)
      .then((linked) => setLinks(linked.map((l) => l.targetUid)))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'profiles'), (snap) => {
      const list = snap.docs.map((d) => d.data() as { uid: string; displayName: string; email?: string | null });
      setProfiles(list);
    });
    return () => unsub();
  }, []);
  return (
    <div className="space-y-6">
      <AuthForm />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-pandora-text">{user?.displayName || user?.email || 'Subject-9218'}</div>
          <div className="text-xs text-pandora-neon font-mono uppercase">{user ? 'Authenticated' : 'Guest'}</div>
        </div>
        <PandoraAvatar username={user?.displayName || user?.email || 'Subject-9218'} size="md" />
      </div>
      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-sm space-y-3">
        <HexagonChart stats={[stats.logic, stats.altruism, stats.aggression, stats.credit, 54, 32]} />
        <div className="grid grid-cols-2 gap-3 text-sm font-mono uppercase">
          <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm text-pandora-text">
            <span className="text-pandora-muted">LOGIC</span>
            <span>{stats.logic}</span>
          </div>
          <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm text-pandora-text">
            <span className="text-pandora-muted">ALTRUISM</span>
            <span>{stats.altruism}</span>
          </div>
          <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm text-pandora-text">
            <span className="text-pandora-muted">AGGRESSION</span>
            <span>{stats.aggression}</span>
          </div>
          <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm text-pandora-text">
            <span className="text-pandora-muted">CREDIT</span>
            <span>{stats.credit}%</span>
          </div>
        </div>
      </div>
      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-sm space-y-3">
        <div className="text-xs uppercase text-pandora-muted font-semibold">Linked Users</div>
        <div className="space-y-2">
          {links.length === 0 && <p className="text-sm text-pandora-muted">No links yet.</p>}
          {links.map((uid) => {
            const p = profiles.find((prof) => prof.uid === uid);
            return (
              <div key={uid} className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm">
                <div className="min-w-0">
                  <p className="text-sm text-pandora-text truncate">{p?.displayName || uid}</p>
                  <p className="text-[11px] text-pandora-muted truncate">{p?.email || uid}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
