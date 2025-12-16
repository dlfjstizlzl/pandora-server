import { useEffect, useState } from 'react';
import { Activity, Loader2, Play, TerminalSquare, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PandoraAvatar } from '../components/ui/PandoraAvatar';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuth';
import { addComment, toggleCommentLike, toggleLike } from '../lib/social';
import { useT } from '../lib/i18n';

type Transmission = {
  id: string;
  type: 'text' | 'sample';
  content?: string;
  sampleUrl?: string;
  attachments?: Array<{ url: string; name: string; contentType?: string }>;
  mode?: string;
  uid?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

type Profile = {
  uid: string;
  displayName: string;
  email?: string | null;
};

export default function Home() {
  const isBlind = useStore((s) => s.isBlind());
  const { user } = useAuthStore();
  const [feed, setFeed] = useState<Transmission[]>([]);
  const [likes, setLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [comments, setComments] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentList, setCommentList] = useState<Record<string, any[]>>({});
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const t = useT();

  useEffect(() => {
    const q = query(collection(db, 'transmissions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows: Transmission[] = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Transmission) }));
        setFeed(rows);
        setLikes((prev) => {
          const next = { ...prev };
          rows.forEach((item) => {
            if (!next[item.id]) {
              next[item.id] = { count: (item as any).likes || 0, liked: prev[item.id]?.liked || false };
            }
          });
          return next;
        });
        setComments((prev) => {
          const next = { ...prev };
          rows.forEach((item) => {
            if (next[item.id] === undefined) next[item.id] = (item as any).comments || 0;
          });
          return next;
        });
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'profiles'), (snap) => {
      const map: Record<string, Profile> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as Profile;
        map[data.uid] = data;
      });
      setProfiles(map);
    });
    return () => unsub();
  }, []);

  const masked = (value: string | undefined) => {
    if (!value) return 'Subject';
    if (!isBlind) return value;
    return value.slice(0, 2) + '****';
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

  const handleLike = async (id: string) => {
    if (!user) return;
    const current = likes[id] || { count: 0, liked: false };
    setLikes((prev) => ({ ...prev, [id]: { count: current.count + (current.liked ? -1 : 1), liked: !current.liked } }));
    try {
      await toggleLike(id, user.uid);
    } catch {
      setLikes((prev) => ({ ...prev, [id]: current }));
    }
  };

  useEffect(() => {
    if (!commentOpenId) return;
    const q = query(collection(db, 'transmissions', commentOpenId, 'comments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCommentList((prev) => ({
        ...prev,
        [commentOpenId]: snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
      }));
      setCommentLikes((prev) => {
        const next = { ...prev };
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const existing = prev[d.id];
          next[d.id] = {
            count: data.likes || 0,
            liked: existing?.liked || false,
          };
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

  const handleComment = async (id: string) => {
    if (!user) return;
    const text = (commentText[id] || '').trim();
    if (!text) return;
    const tempId = `temp-${Date.now()}`;
    setCommentText((prev) => ({ ...prev, [id]: '' }));
    setCommentList((prev) => ({
      ...prev,
      [id]: [{ id: tempId, uid: user.uid, text, createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } }, ...(prev[id] || [])],
    }));
    setCommentLikes((prev) => ({ ...prev, [tempId]: { count: 0, liked: false } }));
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

  return (
    <div className="space-y-6">
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="flex items-center gap-2 self-end mb-2">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="px-3 py-1 text-xs rounded-full border border-white/20 text-white hover:border-white/60"
            >
              -
            </button>
            <span className="text-white text-xs px-2">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
              className="px-3 py-1 text-xs rounded-full border border-white/20 text-white hover:border-white/60"
            >
              +
            </button>
            <button
              onClick={() => {
                setZoomLevel(1);
                setZoomedImage(null);
              }}
              className="px-3 py-1 text-xs rounded-full border border-white/30 text-white hover:border-white/60"
            >
              Close
            </button>
          </div>
          <div className="max-w-6xl w-full flex-1 flex items-center justify-center">
            <img
              src={zoomedImage}
              alt="zoomed"
              className="max-h-[90vh] max-w-full object-contain transition-transform duration-150"
              style={{ transform: `scale(${zoomLevel})` }}
              onDoubleClick={() => setZoomLevel(1)}
            />
          </div>
        </div>
      )}
      <header className="sticky top-0 z-10 h-12 bg-pandora-surface/85 border-b border-pandora-border/70 overflow-hidden hidden lg:block backdrop-blur-md px-4">
        <div className="flex items-center gap-4 text-[11px] uppercase h-full">
          <span className="text-[10px] font-bold text-pandora-neon">{t('banner.feedLive')}</span>
          <span className="text-[10px] font-bold text-[#FF6B6B]">{t('banner.authRequired')}</span>
          <span className="text-pandora-text truncate">{t('banner.transmissions')}</span>
        </div>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-pandora-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading transmissions...
        </div>
      )}

      {!loading && feed.length === 0 && (
        <article className="border border-pandora-border bg-pandora-surface p-4 rounded-none font-mono text-sm text-pandora-muted space-y-2">
          <div className="flex items-center gap-2 text-pandora-neon text-xs uppercase">
            <TerminalSquare size={14} /> No transmissions yet
          </div>
          <p>Share a note or upload a sample from the Compose modal.</p>
        </article>
      )}

      <div className="space-y-4">
        {feed.map((item) => {
          const author = item.uid ? profiles[item.uid] : undefined;
          const display = author?.displayName || author?.email || 'User';
          return (
            <article key={item.id} className="space-y-3 border border-pandora-border p-4 bg-pandora-surface rounded-none">
              <div className="flex items-center gap-3">
                <a href={item.uid ? `/u/${item.uid}` : '#'} className="flex items-center gap-3 min-w-0">
                  <PandoraAvatar username={masked(display ?? 'Subject')} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pandora-text truncate">{masked(display ?? 'Subject')}</div>
                    <div className="text-[11px] text-pandora-muted">{relative(item.createdAt)}</div>
                  </div>
                </a>
                {item.type === 'sample' && (
                  <span className="text-[11px] uppercase font-semibold flex items-center gap-1 px-2 py-1 rounded-full bg-[#8D7BFF]/85 text-white shadow-[0_10px_24px_-16px_rgba(141,123,255,0.35)] border border-transparent ring-1 ring-white/10 backdrop-blur">
                    <Play size={14} /> Sample
                  </span>
                )}
              </div>

              {item.type === 'text' && item.content && <p className="text-sm text-pandora-text whitespace-pre-line">{item.content}</p>}
              {item.type === 'text' && item.attachments && item.attachments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
                    {item.attachments.map((att) => {
                      const isImage = att.contentType?.startsWith('image');
                      const isVideo = att.contentType?.startsWith('video');
                      if (isImage) {
                        return (
                          <button
                            type="button"
                            key={att.url}
                            onClick={() => {
                              setZoomedImage(att.url);
                              setZoomLevel(1);
                            }}
                            className="min-w-[220px] max-w-[80vw] h-[260px] snap-center border border-pandora-border rounded-2xl overflow-hidden bg-black/60 flex items-center justify-center hover:border-pandora-accent-to transition shrink-0"
                          >
                            <img
                              src={att.url}
                              alt={att.name}
                              className="w-full h-full object-contain transition-transform duration-200 hover:scale-105"
                            />
                          </button>
                        );
                      }
                      if (isVideo) {
                        return (
                          <div
                            key={att.url}
                            className="min-w-[240px] max-w-[80vw] h-[260px] snap-center border border-pandora-border rounded-2xl overflow-hidden bg-black/60 flex items-center justify-center shrink-0"
                          >
                            <video src={att.url} controls className="w-full h-full object-contain bg-black" />
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                  <div className="space-y-1">
                    {item.attachments
                      .filter((att) => !att.contentType?.startsWith('image') && !att.contentType?.startsWith('video'))
                      .map((att) => (
                        <a
                          key={att.url}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between text-xs text-pandora-text border border-pandora-border px-3 py-2 rounded-2xl hover:border-pandora-accent-to hover:text-pandora-text"
                        >
                          <span className="truncate">{att.name}</span>
                          <span className="text-pandora-muted text-[11px]">Open</span>
                        </a>
                      ))}
                  </div>
                </div>
              )}

              {item.type === 'sample' && item.sampleUrl && (
                <div className="relative border border-pandora-border rounded-sm overflow-hidden bg-pandora-bg">
                  <div className="relative w-full aspect-[9/16] max-h-[480px] bg-black">
                    <video
                      key={item.sampleUrl}
                      src={item.sampleUrl}
                      className="w-full h-full object-contain bg-black"
                      controls
                      muted={muted}
                      playsInline
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                      <button
                        onClick={() => setMuted((m) => !m)}
                        className="w-9 h-9 flex items-center justify-center border border-pandora-border bg-pandora-bg/80 text-pandora-text hover:border-pandora-neon rounded-sm"
                        title={muted ? 'Unmute' : 'Mute'}
                      >
                        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                    <Link
                      to={`/t/${item.id}`}
                      className="text-[11px] uppercase px-2.5 py-1.5 rounded-full bg-[#8D7BFF]/85 text-white shadow-[0_10px_24px_-16px_rgba(141,123,255,0.35)] border border-transparent ring-1 ring-white/10 hover:shadow-lg backdrop-blur"
                    >
                      View sample
                    </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs uppercase font-semibold tracking-wide">
                <button
                  onClick={() => handleLike(item.id)}
                  className={cn(
                    'flex items-center gap-2',
                    likes[item.id]?.liked ? 'text-pandora-neon' : 'text-pandora-muted hover:text-pandora-text',
                  )}
                >
                  <Activity size={14} />
                  <span>{likes[item.id]?.count ?? 0} Likes</span>
                </button>
                <button
                  className="flex items-center gap-2 text-pandora-muted hover:text-pandora-text"
                  onClick={() => setCommentOpenId((prev) => (prev === item.id ? null : item.id))}
                >
                  <MessageSquare size={14} />
                  <span>{comments[item.id] ?? 0} Comments</span>
                </button>
              </div>
              {commentOpenId === item.id && (
                <div className="mt-3 space-y-3 border border-pandora-border/70 bg-pandora-surface/70 rounded-2xl p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={commentText[item.id] || ''}
                      onChange={(e) => setCommentText((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Write a comment..."
                      className="flex-1 h-16 bg-pandora-bg/70 border border-white/10 text-pandora-text text-sm p-2 rounded-2xl focus:outline-none focus:border-pandora-neon"
                    />
                    <button
                      onClick={() => handleComment(item.id)}
                      disabled={!commentText[item.id]?.trim()}
                      className="px-4 py-2 text-xs font-semibold rounded-full bg-white/10 text-pandora-text border border-white/25 transition hover:bg-gradient-to-r hover:from-pandora-accent-from hover:to-pandora-accent-to hover:text-pandora-text hover:shadow-[0_12px_32px_-8px_rgba(125,140,255,0.9)] disabled:opacity-60"
                    >
                      Post
                    </button>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {(commentList[item.id] || []).map((c) => {
                      const name = isBlind ? 'Subject-****' : displayNameFor(c.uid);
                      const time =
                        c.createdAt && 'seconds' in c.createdAt
                          ? new Date((c.createdAt as any).seconds * 1000).toLocaleTimeString()
                          : 'Just now';
                    const stats = commentLikes[c.id] || { count: c.likes || 0, liked: false };
                    return (
                      <div key={c.id} className="border border-pandora-border/60 bg-pandora-bg/60 rounded-2xl p-2">
                        <div className="flex items-center justify-between text-[11px] text-pandora-muted">
                          <span className="truncate">{name}</span>
                          <span>{time}</span>
                        </div>
                        <p className="text-sm text-pandora-text whitespace-pre-line">{c.text}</p>
                        <button
                          onClick={() => handleCommentLike(item.id, c.id)}
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
                    {(commentList[item.id] || []).length === 0 && (
                      <p className="text-xs text-pandora-muted">No comments yet.</p>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
