import { useEffect, useState } from 'react';
import { Loader2, Settings as SettingsIcon, Save } from 'lucide-react';
import { useAuthStore } from '../store/useAuth';
import { useStore } from '../store/useStore';
import { getOrCreateProfile, updateProfile } from '../lib/profile';
import { fetchLinks, linkUser, unlinkUser } from '../lib/links';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Settings() {
  const { user } = useAuthStore();
  const stats = useStore((s) => s.userStats);
  const setUserStats = useStore((s) => s.setUserStats);

  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<{ uid: string; displayName: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const profile = await getOrCreateProfile({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
      setDisplayName(profile.displayName);
      setUserStats(profile.stats);
      setLoaded(true);
      const linked = await fetchLinks(user.uid);
      setLinks(linked.map((l) => l.targetUid));
    };
    load().catch(() => setLoaded(true));
  }, [user, setUserStats]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'profiles'), (snap) => {
      const list = snap.docs.map((d) => d.data() as { uid: string; displayName: string });
      setProfiles(list);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(user.uid, { displayName });
      setMessage('Saved.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save profile.';
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleLink = async (targetUid: string) => {
    if (!user || targetUid === user.uid) return;
    if (links.includes(targetUid)) {
      await unlinkUser(user.uid, targetUid);
      setLinks((prev) => prev.filter((id) => id !== targetUid));
    } else {
      await linkUser(user.uid, targetUid);
      setLinks((prev) => [...prev, targetUid]);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-pandora-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading profile...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-pandora-text">
          <SettingsIcon size={18} className="text-pandora-text" />
          <h2 className="text-lg font-semibold tracking-wide">Settings</h2>
        </div>
        <span className="text-xs text-pandora-muted font-mono uppercase">Profile</span>
      </div>

      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-2xl space-y-4">
        <div className="space-y-2">
          <label className="text-xs uppercase text-pandora-muted font-semibold">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-2xl font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
            placeholder="Your alias"
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase text-pandora-muted font-semibold">Traits</div>
          <p className="text-xs text-pandora-muted">System-assigned from experiments. Read-only.</p>
          <div className="grid grid-cols-2 gap-3">
            {(['logic', 'altruism', 'aggression', 'credit'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-2xl text-pandora-text text-sm">
                <span className="uppercase text-pandora-muted">{key}</span>
                <span className="font-mono">{stats[key]}</span>
              </div>
            ))}
          </div>
        </div>

        {message && <p className="text-xs text-pandora-accent-from">{message}</p>}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 border border-transparent bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-white font-semibold uppercase text-xs rounded-full hover:shadow-[0_12px_32px_-8px_rgba(110,200,255,0.8)] transition disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save size={14} /> Save
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-pandora-text">
            <span className="text-sm font-semibold">Links</span>
          </div>
          <span className="text-[11px] text-pandora-muted uppercase">Follow users</span>
        </div>
        <div className="space-y-2">
          {profiles
            .filter((p) => p.uid !== user?.uid)
            .map((p) => {
              const linked = links.includes(p.uid);
              return (
                <div key={p.uid} className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm">
                  <div>
                    <p className="text-sm text-pandora-text">{p.displayName || p.uid.slice(0, 6)}</p>
                    <p className="text-[11px] text-pandora-muted">{p.uid}</p>
                  </div>
                  <button
                    onClick={() => toggleLink(p.uid)}
                    className={`px-3 py-2 text-xs uppercase border rounded-sm ${
                      linked ? 'border-pandora-pink text-pandora-pink' : 'border-pandora-neon text-pandora-neon'
                    }`}
                  >
                    {linked ? 'Unlink' : 'Link'}
                  </button>
                </div>
              );
            })}
          {profiles.filter((p) => p.uid !== user?.uid).length === 0 && <p className="text-sm text-pandora-muted">No other profiles yet.</p>}
        </div>
      </div>
    </div>
  );
}
