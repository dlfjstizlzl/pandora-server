import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, collection, orderBy, query, getDoc } from 'firebase/firestore';
import { Loader2, Activity, MessageSquare, Play, Volume2, VolumeX } from 'lucide-react';
import { db } from '../lib/firebase';
import { toggleLike, addComment, toggleCommentLike } from '../lib/social';
import { useAuthStore } from '../store/useAuth';
import { useStore } from '../store/useStore';
import { PandoraAvatar } from '../components/ui/PandoraAvatar';
import { cn } from '../utils/cn';

type Transmission = {
  id: string;
  type: 'text' | 'sample';
  content?: string;
  sampleUrl?: string;
  uid?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  likes?: number;
  comments?: number;
};

type Comment = {
  id: string;
  uid?: string | null;
  text: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export default function TransmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const isBlind = useStore((s) => s.isBlind());
  const [item, setItem] = useState<Transmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<{ count: number; liked: boolean }>({ count: 0, liked: false });
  const [commentText, setCommentText] = useState('');
  const [commentList, setCommentList] = useState<Comment[]>([]);
  const [muted, setMuted] = useState(true);
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [profiles, setProfiles] = useState<Record<string, { displayName?: string; email?: string | null }>>({});

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'transmissions', id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Transmission;
        setItem({ id, ...data });
        setLikes((prev) => ({ count: data.likes || 0, liked: prev.liked }));
      } else {
        setItem(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'transmissions', id, 'comments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCommentList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Comment) })));
      setCommentLikes((prev) => {
        const next = { ...prev };
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const existing = prev[d.id];
          next[d.id] = { count: data.likes || 0, liked: existing?.liked || false };
          if (user && existing?.liked === undefined) {
            const likeDoc = doc(db, 'transmissions', id, 'comments', d.id, 'likes', user.uid);
            getDoc(likeDoc)
              .then((likeSnap) => {
                setCommentLikes((inner) => ({
                  ...inner,
                  [d.id]: { count: data.likes || 0, liked: likeSnap.exists() },
                }));
              })
              .catch(() => undefined);
          }
        });
        return next;
      });
    });
    return () => unsub();
  }, [id, user]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'profiles'), (snap) => {
      const map: Record<string, { displayName?: string; email?: string | null }> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        map[data.uid] = { displayName: data.displayName, email: data.email };
      });
      setProfiles(map);
    });
    return () => unsub();
  }, []);

  const handleLike = async () => {
    if (!user || !id) return;
    const current = likes;
    setLikes({ count: current.count + (current.liked ? -1 : 1), liked: !current.liked });
    try {
      await toggleLike(id, user.uid);
    } catch {
      setLikes(current);
    }
  };

  const handleComment = async () => {
    if (!user || !id) return;
    const text = commentText.trim();
    if (!text) return;
    const tempId = `temp-${Date.now()}`;
    setCommentText('');
    setCommentList((prev) => [
      { id: tempId, uid: user.uid, text, createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any },
      ...prev,
    ]);
    setCommentLikes((prev) => ({ ...prev, [tempId]: { count: 0, liked: false } }));
    try {
      await addComment(id, user.uid, text);
    } catch {
      // ignore; realtime feed will correct
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!user || !id) return;
    const current = commentLikes[commentId] || { count: 0, liked: false };
    setCommentLikes((prev) => ({ ...prev, [commentId]: { count: current.count + (current.liked ? -1 : 1), liked: !current.liked } }));
    try {
      await toggleCommentLike(id, commentId, user.uid);
    } catch {
      setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
    }
  };

  const relative = (ts?: { seconds: number; nanoseconds: number } | null) => {
    if (!ts || !('seconds' in ts)) return 'Just now';
    const diff = Date.now() - ts.seconds * 1000;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };
  const displayNameFor = (uid?: string | null) => {
    if (!uid) return 'User';
    const p = profiles[uid];
    return p?.displayName || p?.email || 'User';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-pandora-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </div>
    );
  }

  if (!item) {
    return <div className="text-sm text-pandora-muted">Transmission not found.</div>;
  }

  const authorName = item.uid ? (isBlind ? 'Subject-****' : displayNameFor(item.uid)) : 'Unknown';
  const isSample = item.type === 'sample';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={item.uid ? `/u/${item.uid}` : '#'} className="flex items-center gap-3">
          <PandoraAvatar username={authorName} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-pandora-text truncate">{authorName}</div>
            <div className="text-[11px] text-pandora-muted">{relative(item.createdAt)}</div>
          </div>
        </Link>
        {item.type === 'sample' && (
          <span className="text-[11px] uppercase text-pandora-neon font-semibold flex items-center gap-1">
            <Play size={14} /> Sample
          </span>
        )}
      </div>

      {isSample ? (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs uppercase font-semibold tracking-wide">
              <button
                onClick={handleLike}
                className={cn('flex items-center gap-2', likes.liked ? 'text-pandora-neon' : 'text-pandora-muted hover:text-pandora-text')}
              >
                <Activity size={14} />
                <span>{likes.count} Likes</span>
              </button>
              <div className="flex items-center gap-2 text-pandora-muted">
                <MessageSquare size={14} />
                <span>{item.comments ?? commentList.length} Comments</span>
              </div>
            </div>
            <div className="border border-pandora-border rounded-sm overflow-hidden bg-black relative">
              <div className="relative w-full max-h-[80vh] aspect-[9/16]">
                <video
                  key={item.sampleUrl}
                  src={item.sampleUrl}
                  className="w-full h-full object-contain bg-black"
                  autoPlay
                  muted={muted}
                  loop
                  playsInline
                  controls
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="absolute top-3 left-3 z-10 w-10 h-10 flex items-center justify-center border border-pandora-border bg-pandora-bg/80 text-pandora-text hover:border-pandora-neon rounded-sm"
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3 border border-pandora-border rounded-sm p-3 bg-pandora-bg/60">
            <div className="flex gap-2 items-end">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Leave a comment..."
                className="flex-1 h-20 bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-2 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim()}
                className="px-4 py-2 border border-pandora-neon text-pandora-neon text-[11px] uppercase rounded-sm hover:bg-pandora-neon hover:text-pandora-bg transition disabled:opacity-50 self-stretch"
              >
                Post
              </button>
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {commentList.map((c) => {
                const name = isBlind ? 'Subject-****' : displayNameFor(c.uid);
                const time =
                  c.createdAt && 'seconds' in c.createdAt
                    ? new Date((c.createdAt as any).seconds * 1000).toLocaleTimeString()
                    : 'Just now';
                const stats = commentLikes[c.id] || { count: (c as any).likes || 0, liked: false };
                return (
                  <div key={c.id} className="border border-pandora-border rounded-sm p-2 bg-pandora-bg">
                    <div className="flex items-center justify-between text-[11px] text-pandora-muted">
                      <span className="truncate">{name}</span>
                      <span>{time}</span>
                    </div>
                    <p className="text-sm text-pandora-text whitespace-pre-line">{c.text}</p>
                    <button
                      onClick={() => handleCommentLike(c.id)}
                      className={cn(
                        'mt-2 text-[11px] uppercase flex items-center gap-1',
                        stats.liked ? 'text-pandora-neon' : 'text-pandora-muted hover:text-pandora-text',
                      )}
                    >
                      <Activity size={12} /> {stats.count} Likes
                    </button>
                  </div>
                );
              })}
              {commentList.length === 0 && <p className="text-[11px] text-pandora-muted">No comments yet.</p>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {item.content && <p className="text-sm text-pandora-text whitespace-pre-line">{item.content}</p>}

          <div className="flex items-center gap-4 text-xs uppercase font-semibold tracking-wide">
            <button
              onClick={handleLike}
              className={cn('flex items-center gap-2', likes.liked ? 'text-pandora-neon' : 'text-pandora-muted hover:text-pandora-text')}
            >
              <Activity size={14} />
              <span>{likes.count} Likes</span>
            </button>
            <div className="flex items-center gap-2 text-pandora-muted">
              <MessageSquare size={14} />
              <span>{item.comments ?? commentList.length} Comments</span>
            </div>
          </div>

          <div className="space-y-2 border border-pandora-border rounded-sm p-3 bg-pandora-bg/60">
            <div className="flex gap-2 items-end">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Leave a comment..."
                className="flex-1 h-16 bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-2 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim()}
                className="px-4 py-2 border border-pandora-neon text-pandora-neon text-[11px] uppercase rounded-sm hover:bg-pandora-neon hover:text-pandora-bg transition disabled:opacity-50 self-stretch"
              >
                Post
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {commentList.map((c) => {
                const name = isBlind ? 'Subject-****' : displayNameFor(c.uid);
                const time =
                  c.createdAt && 'seconds' in c.createdAt
                    ? new Date((c.createdAt as any).seconds * 1000).toLocaleTimeString()
                    : 'Just now';
                const stats = commentLikes[c.id] || { count: (c as any).likes || 0, liked: false };
                return (
                  <div key={c.id} className="border border-pandora-border rounded-sm p-2 bg-pandora-bg">
                    <div className="flex items-center justify-between text-[11px] text-pandora-muted">
                      <span className="truncate">{name}</span>
                      <span>{time}</span>
                    </div>
                    <p className="text-sm text-pandora-text whitespace-pre-line">{c.text}</p>
                    <button
                      onClick={() => handleCommentLike(c.id)}
                      className={cn(
                        'mt-2 text-[11px] uppercase flex items-center gap-1',
                        stats.liked ? 'text-pandora-neon' : 'text-pandora-muted hover:text-pandora-text',
                      )}
                    >
                      <Activity size={12} /> {stats.count} Likes
                    </button>
                  </div>
                );
              })}
              {commentList.length === 0 && <p className="text-[11px] text-pandora-muted">No comments yet.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
