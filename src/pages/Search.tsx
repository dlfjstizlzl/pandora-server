import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search as SearchIcon, UserPlus, UserX } from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuth';
import { linkUser, unlinkUser, fetchLinks } from '../lib/links';
import { useNavigate } from 'react-router-dom';

type Profile = {
  uid: string;
  displayName: string;
  email?: string | null;
  displayNameLower?: string;
};

export default function Search() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<string[]>([]);

  useEffect(() => {
    const loadLinks = async () => {
      if (!user) return;
      const linked = await fetchLinks(user.uid);
      setLinks(linked.map((l) => l.targetUid));
    };
    loadLinks().catch(() => undefined);
  }, [user]);

  const search = async () => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const normalized = term.trim().toLowerCase();
    try {
      const start = normalized;
      const end = normalized + '\uf8ff';
      const q = query(
        collection(db, 'profiles'),
        where('displayNameLower', '>=', start),
        where('displayNameLower', '<=', end),
        orderBy('displayNameLower', 'asc'),
        limit(20),
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => d.data() as Profile).filter((p) => p.uid !== user?.uid);
      setResults(rows);
    } finally {
      setLoading(false);
    }
  };

  const toggleLink = async (uid: string) => {
    if (!user) return;
    if (links.includes(uid)) {
      await unlinkUser(user.uid, uid);
      setLinks((prev) => prev.filter((id) => id !== uid));
    } else {
      await linkUser(user.uid, uid);
      setLinks((prev) => [...prev, uid]);
    }
  };

  const showEmpty = useMemo(() => !loading && term && results.length === 0, [loading, term, results.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-pandora-text">
          <SearchIcon size={18} className="text-pandora-text" />
          <h2 className="text-lg font-semibold tracking-wide">Search Users</h2>
        </div>
      </div>

      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-2xl space-y-3">
        <div className="flex gap-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            className="flex-1 bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-2xl font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
            placeholder="Search by display name"
          />
          <button
            onClick={search}
            className="px-4 py-2 border border-transparent bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg font-semibold uppercase text-xs rounded-full hover:shadow-lg transition"
          >
            Go
          </button>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-pandora-muted text-sm">
            <Loader2 size={16} className="animate-spin" /> Searching...
          </div>
        )}
        {showEmpty && <p className="text-sm text-pandora-muted">No users found.</p>}
        <div className="space-y-2">
          {results.map((p) => {
            const linked = links.includes(p.uid);
            return (
              <div
                key={p.uid}
                className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-2xl hover:bg-white/5 cursor-pointer transition"
                onClick={() => navigate(`/u/${p.uid}`)}
              >
                <div className="min-w-0">
                  <p className="text-sm text-pandora-text truncate">{p.displayName || p.uid}</p>
                  <p className="text-[11px] text-pandora-muted truncate">{p.email || p.uid}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLink(p.uid);
                  }}
                  className={`px-3 py-2 text-xs uppercase border rounded-full flex items-center gap-2 ${
                    linked
                      ? 'border-transparent bg-gradient-to-r from-pandora-accent-from/70 to-pandora-accent-to/70 text-pandora-bg'
                      : 'border-pandora-border text-pandora-text hover:border-pandora-accent-to hover:text-pandora-text'
                  }`}
                >
                  {linked ? <UserX size={14} /> : <UserPlus size={14} />}
                  {linked ? 'Unlink' : 'Link'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
