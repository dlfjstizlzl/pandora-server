import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PandoraAvatar } from '../components/ui/PandoraAvatar';
import { Loader2, Play, Link2, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../store/useAuth';
import { follow, unfollow, isLinked } from '../lib/links';

type Profile = {
  uid: string;
  displayName: string;
  email?: string | null;
};

type Transmission = {
  id: string;
  type: 'text' | 'sample';
  content?: string;
  sampleUrl?: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export default function UserProfile() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feed, setFeed] = useState<Transmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState<boolean | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'profiles', uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as Profile);
      } else {
        setProfile(null);
      }
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'transmissions'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFeed(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Transmission) })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const check = async () => {
      if (!user || !uid) return;
      const status = await isLinked(user.uid, uid);
      setLinked(status);
    };
    check().catch(() => setLinked(null));
  }, [user, uid]);

  const toggleLink = async () => {
    if (!user || !uid || linking) return;
    setLinking(true);
    try {
      if (linked) {
        await unfollow(user.uid, uid);
        setLinked(false);
      } else {
        await follow(user.uid, uid);
        setLinked(true);
      }
    } finally {
      setLinking(false);
    }
  };

  if (!uid) {
    return <div className="text-pandora-muted text-sm">No user specified.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <PandoraAvatar username={profile?.displayName || 'Subject'} size="md" />
        <div className="flex-1 space-y-2">
          <div className="text-lg font-semibold text-pandora-text">{profile?.displayName || 'Subject'}</div>
          {user && user.uid !== uid && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/messages/${uid}`)}
                className="px-3 py-2 border border-pandora-border text-pandora-text text-xs uppercase rounded-sm hover:border-pandora-neon flex items-center gap-2"
              >
                <MessageSquare size={14} />
                Message
              </button>
              <button
                onClick={toggleLink}
                disabled={linking || linked === null}
                className={`px-3 py-2 text-xs uppercase rounded-sm flex items-center gap-2 ${
                  linked ? 'border border-pandora-neon text-pandora-neon' : 'border border-pandora-border text-pandora-text hover:border-pandora-neon'
                } disabled:opacity-50`}
              >
                <Link2 size={14} />
                {linked ? 'Unlink' : 'Link'}
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-pandora-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      )}

      {!loading && feed.length === 0 && <div className="text-sm text-pandora-muted">No posts yet.</div>}

      <div className="space-y-4">
        {feed.map((item) => (
          <article key={item.id} className="space-y-2 border border-pandora-border p-4 bg-pandora-surface rounded-sm">
            <div className="text-[11px] text-pandora-muted">
              {item.createdAt && 'seconds' in item.createdAt
                ? new Date(item.createdAt.seconds * 1000).toLocaleString()
                : 'Just now'}
            </div>
            {item.type === 'text' && item.content && <p className="text-sm text-pandora-text whitespace-pre-line">{item.content}</p>}
            {item.type === 'sample' && item.sampleUrl && (
              <div className="border border-pandora-border rounded-sm overflow-hidden bg-pandora-bg">
                <video
                  key={item.sampleUrl}
                  src={item.sampleUrl}
                  className="w-full h-64 object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
            )}
            {item.type === 'sample' && (
              <span className="text-[11px] uppercase text-pandora-neon font-semibold flex items-center gap-1">
                <Play size={14} /> Sample
              </span>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
