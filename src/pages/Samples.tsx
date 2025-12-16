import { useEffect, useRef, useState } from 'react';
import { Share2, MessageSquare, Activity, Hexagon, Loader2, Volume2, VolumeX } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';
import { useAuthStore } from '../store/useAuth';
import { toggleLike, addComment, toggleCommentLike } from '../lib/social';

type Sample = {
  id: string;
  sampleUrl?: string;
  type?: string;
  uid?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

type Comment = {
  id: string;
  uid?: string | null;
  text: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export default function Samples() {
  const isBlind = useStore((s) => s.isBlind());
  const { user } = useAuthStore();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [active, setActive] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [comments, setComments] = useState<Record<string, number>>({});
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null);
  const [commentList, setCommentList] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [muted, setMuted] = useState(true);
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [profiles, setProfiles] = useState<Record<string, { displayName?: string; email?: string | null }>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-idx'));
            setActive(idx);
          }
        });
      },
      { threshold: 0.6 },
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!commentOpenId) return;
    const q = query(collection(db, 'transmissions', commentOpenId, 'comments'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setCommentList((prev) => ({
        ...prev,
        [commentOpenId]: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Comment) })),
      }));
      setCommentLikes((prev) => {
        const next = { ...prev };
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const existing = prev[d.id];
          next[d.id] = { count: data.likes || 0, liked: existing?.liked || false };
          if (user && existing?.liked === undefined) {
            const likeDoc = doc(db, 'transmissions', commentOpenId, 'comments', d.id, 'likes', user.uid);
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
  }, [commentOpenId, user]);

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

  const handleComment = async (id: string) => {
    if (!user) return;
    const text = (commentText[id] || '').trim();
    if (!text) return;
    setCommentText((prev) => ({ ...prev, [id]: '' }));
    setComments((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    try {
      await addComment(id, user.uid, text);
    } catch {
      setComments((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 1) - 1) }));
    }
  };

  const handleCommentLike = async (transmissionId: string, commentId: string) => {
    if (!user) return;
    const current = commentLikes[commentId] || { count: 0, liked: false };
    setCommentLikes((prev) => ({ ...prev, [commentId]: { count: current.count + (current.liked ? -1 : 1), liked: !current.liked } }));
    try {
      await toggleCommentLike(transmissionId, commentId, user.uid);
    } catch {
      setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'transmissions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Sample[] = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Sample) }));
        const onlySamples = rows.filter((row) => row.type === 'sample' && row.sampleUrl);
        setSamples(onlySamples);
        setLikes((prev) => {
          const next: Record<string, { count: number; liked: boolean }> = { ...prev };
          onlySamples.forEach((item) => {
            next[item.id] = {
              count: (item as any).likes || 0,
              liked: prev[item.id]?.liked || false,
            };
          });
          return next;
        });
        setComments((prev) => {
          const next: Record<string, number> = { ...prev };
          onlySamples.forEach((item) => {
            next[item.id] = (item as any).comments || 0;
          });
          return next;
        });
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  // Load per-user liked state so the toggle reflects reality
  useEffect(() => {
    if (!user) {
      // clear liked flags when signed out
      setLikes((prev) =>
        Object.fromEntries(Object.entries(prev).map(([id, val]) => [id, { ...val, liked: false }])),
      );
      return;
    }
    if (samples.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const states = await Promise.all(
          samples.map(async (sample) => {
            const likeRef = doc(db, 'transmissions', sample.id, 'likes', user.uid);
            const snap = await getDoc(likeRef);
            return { id: sample.id, liked: snap.exists() };
          }),
        );
        if (cancelled) return;
        setLikes((prev) => {
          const next = { ...prev };
          states.forEach(({ id, liked }) => {
            next[id] = { count: prev[id]?.count ?? 0, liked };
          });
          return next;
        });
      } catch {
        // ignore silently if permissions fail; user can still toggle
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, samples]);

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center text-pandora-muted">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (!loading && samples.length === 0) {
    return (
      <div className="h-dvh flex items-center justify-center text-pandora-muted px-4 text-center">
        No samples yet. Upload one from the write modal.
      </div>
    );
  }

  const handleLike = async (id: string) => {
    if (!user) return;
    const current = likes[id] || { count: 0, liked: false };
    const before = { ...current };
    // optimistic toggle so UI feels snappy
    setLikes((prev) => ({ ...prev, [id]: { count: current.count + (current.liked ? -1 : 1), liked: !current.liked } }));
    try {
      const result = await toggleLike(id, user.uid);
      setLikes((prev) => {
        const nextCount = before.count + (result.liked ? 1 : -1);
        return { ...prev, [id]: { count: Math.max(0, nextCount), liked: result.liked } };
      });
    } catch (err) {
      setLikes((prev) => ({ ...prev, [id]: current }));
    }
  };

  return (
    <div className="h-dvh overflow-y-auto snap-y snap-mandatory no-scrollbar pb-16">
      {samples
        .filter((s) => s.sampleUrl)
        .map((sample, idx) => {
          const playing = idx === active;
          return (
          <div
            key={sample.id}
            data-idx={idx}
            ref={(el) => (cardRefs.current[idx] = el)}
            className="snap-start h-dvh flex justify-center items-center"
          >
            <div className="relative h-full w-full max-w-[520px] aspect-[9/16] border border-pandora-border rounded-sm overflow-hidden bg-pandora-bg">
              <div className="absolute inset-0 overflow-hidden">
                <video
                  key={sample.sampleUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted={muted}
                  loop
                  playsInline
                  src={sample.sampleUrl}
                  poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(167,199,255,0.12),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(110,200,255,0.12),transparent_35%)]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pandora-bg/55 via-transparent to-transparent" />
              </div>

              {/* HUD */}
              <div className="absolute top-4 right-4 flex items-center gap-3 text-xs font-mono uppercase z-10">
                <div className="flex items-center gap-1 text-pandora-pink">
                  <span className="w-2 h-2 bg-pandora-pink animate-pulseDot inline-block" />
                  REC
                </div>
                <div className="px-2 py-1 border border-pandora-border rounded-sm bg-pandora-surface text-pandora-text">
                  {sample.uid ? (isBlind ? 'Subject-****' : sample.uid) : 'Unknown'}
                </div>
              </div>

              <div className="absolute bottom-4 left-4 text-pandora-text space-y-2">
                <a href={sample.uid ? `/u/${sample.uid}` : '#'} className="flex items-center gap-2 text-sm font-semibold">
                  <span>{isBlind ? 'Subject-****' : sample.uid || sample.id}</span>
                  <Hexagon size={16} className="text-pandora-neon" />
                </a>
                <div className="text-xs font-mono text-pandora-muted uppercase">
                  {likes[sample.id]?.count ?? 0} Likes · {comments[sample.id] ?? 0} Comments
                </div>
              </div>

              <div className="absolute bottom-10 right-4 flex flex-col items-center gap-4 text-pandora-text z-20">
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="w-11 h-11 border border-pandora-border/70 rounded-xl flex items-center justify-center transition bg-pandora-surface/90 text-white backdrop-blur hover:border-pandora-accent-to hover:shadow-[0_10px_30px_-12px_rgba(165,180,252,0.8)]"
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button
                  onClick={() => handleLike(sample.id)}
                  className={cn(
                    'w-11 h-11 border border-pandora-border/70 rounded-xl flex items-center justify-center transition bg-pandora-surface/90 text-white backdrop-blur hover:border-pandora-accent-to hover:shadow-[0_10px_30px_-12px_rgba(165,180,252,0.8)]',
                    likes[sample.id]?.liked && 'border-green-400 text-green-400 shadow-[0_0_20px_rgba(74,222,128,0.35)]',
                  )}
                >
                  <Activity size={18} />
                </button>
                <button
                  onClick={() => setCommentOpenId((prev) => (prev === sample.id ? null : sample.id))}
                  className="w-11 h-11 border border-pandora-border/70 rounded-xl flex items-center justify-center transition bg-pandora-surface/90 text-white backdrop-blur hover:border-pandora-accent-to hover:shadow-[0_10px_30px_-12px_rgba(165,180,252,0.8)]"
                >
                  <MessageSquare size={18} />
                </button>
                <button className="w-11 h-11 border border-pandora-border/70 rounded-xl flex items-center justify-center transition bg-pandora-surface/90 text-white backdrop-blur hover:border-pandora-accent-to hover:shadow-[0_10px_30px_-12px_rgba(165,180,252,0.8)]">
                  <Share2 size={18} />
                </button>
              </div>

            </div>
          </div>
        );
      })}

      {commentOpenId && (
        <div className="fixed top-0 right-0 h-full w-full lg:w-[360px] bg-pandora-bg border-l border-pandora-border z-50 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold uppercase text-pandora-text">Comments</div>
            <button
              onClick={() => setCommentOpenId(null)}
              className="text-pandora-muted hover:text-pandora-text text-lg"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {commentList[commentOpenId]?.map((c) => {
              const time =
                c.createdAt && 'seconds' in c.createdAt
                  ? new Date(c.createdAt.seconds * 1000).toLocaleTimeString()
                  : 'Just now';
              const name = isBlind ? 'Subject-****' : profiles[c.uid || '']?.displayName || profiles[c.uid || '']?.email || 'User';
              const stats = commentLikes[c.id] || { count: (c as any).likes || 0, liked: false };
              return (
                <div key={c.id} className="border border-pandora-border rounded-2xl p-2 bg-pandora-bg">
                  <div className="flex items-center justify-between text-[11px] text-pandora-muted">
                    <span className="truncate">{name}</span>
                    <span>{time}</span>
                  </div>
                  <p className="text-sm text-pandora-text whitespace-pre-line">{c.text}</p>
                  <button
                    onClick={() => handleCommentLike(commentOpenId, c.id)}
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
            {(commentList[commentOpenId] || []).length === 0 && (
              <p className="text-[11px] text-pandora-muted">No comments yet.</p>
            )}
          </div>
          <div className="pt-3 border-t border-pandora-border/70 mt-3">
            <div className="flex gap-2 items-end">
              <textarea
                value={commentText[commentOpenId] || ''}
                onChange={(e) => setCommentText((prev) => ({ ...prev, [commentOpenId]: e.target.value }))}
                placeholder="Leave a comment..."
                className="flex-1 h-16 bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-2 rounded-2xl font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
              />
              <button
                onClick={() => handleComment(commentOpenId)}
                disabled={!commentText[commentOpenId]?.trim()}
                className="px-3.5 py-2 text-[11px] font-semibold uppercase rounded-lg bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-white shadow-[0_12px_30px_-10px_rgba(165,180,252,0.8)] hover:shadow-[0_14px_34px_-8px_rgba(165,180,252,0.95)] transition disabled:opacity-50 self-stretch border border-white/20"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
