import { useEffect, useMemo, useState } from 'react';
import { PanelsTopLeft, Lock, ShieldCheck, AlertTriangle, PlusCircle, Loader2, Send } from 'lucide-react';
import { useStore, UserStats } from '../store/useStore';
import { useAuthStore } from '../store/useAuth';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChatRoom } from '../components/chat/ChatRoom';

type Sector = {
  id: string;
  name: string;
  type: 'PUBLIC' | 'CLASSIFIED';
  requirement?: { stat: keyof UserStats; value: number };
  description: string;
  createdBy?: string;
};

type Screen = {
  id: string;
  sectorId: string;
  createdBy?: string;
  title: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

type Post = {
  id: string;
  sectorId: string;
  createdBy?: string;
  content: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export default function Sectors() {
  const stats = useStore((s) => s.userStats);
  const { user } = useAuthStore();

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selected, setSelected] = useState<Sector | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [creatingSector, setCreatingSector] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'PUBLIC' | 'CLASSIFIED'>('PUBLIC');
  const [newReqStat, setNewReqStat] = useState<keyof UserStats>('logic');
  const [newReqValue, setNewReqValue] = useState(50);
  const [savingSector, setSavingSector] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState('');
  const sectorChannelId = selected ? `sector-${selected.id}` : null;

  useEffect(() => {
    const handler = () => setCreatingSector(true);
    window.addEventListener('open-sector-modal', handler);
    return () => window.removeEventListener('open-sector-modal', handler);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'sectors'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Sector) }));
      setSectors(items);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selected) {
      setPosts([]);
      return;
    }
    const q = query(collection(db, 'sectors', selected.id, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, sectorId: selected.id, ...(d.data() as Post) }));
      setPosts(rows);
    });
    return () => unsub();
  }, [selected]);

  const handleAccess = (sector: Sector) => {
    if (sector.type === 'CLASSIFIED' && sector.requirement) {
      const current = stats[sector.requirement.stat];
      if (current < sector.requirement.value) {
        window.alert(`입장 불가: ${sector.requirement.stat.toUpperCase()} ${sector.requirement.value}+ 필요`);
        return;
      }
    }
    setSelected(sector);
  };

  const handleCreateSector = async () => {
    if (!newName.trim() || !user) return;
    setSavingSector(true);
    try {
      await addDoc(collection(db, 'sectors'), {
        name: newName.trim(),
        type: newType,
        description: newDesc.trim() || 'No description.',
        requirement: newType === 'CLASSIFIED' ? { stat: newReqStat, value: newReqValue } : null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewName('');
      setNewDesc('');
      setNewType('PUBLIC');
      setNewReqStat('logic');
      setNewReqValue(50);
      setCreatingSector(false);
    } finally {
      setSavingSector(false);
    }
  };

  const handleCreatePost = async () => {
    if (!selected || !user || !draft.trim()) return;
    setPosting(true);
    try {
      await addDoc(collection(db, 'sectors', selected.id, 'posts'), {
        content: draft.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setDraft('');
    } finally {
      setPosting(false);
    }
  };

  const requirementText = (sector: Sector) => {
    if (!sector.requirement) return null;
    return `입장 조건: ${sector.requirement.stat.toUpperCase()} ${sector.requirement.value}+ (현재 ${stats[sector.requirement.stat]})`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-pandora-text">
          <PanelsTopLeft size={18} className="text-pandora-text" />
          <h2 className="text-lg font-semibold tracking-wide">COMMUNITIES</h2>
        </div>
        <button
          onClick={() => setCreatingSector(true)}
          className="flex items-center gap-2 text-xs uppercase px-3 py-2 rounded-full bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg shadow hover:shadow-lg transition"
        >
          <PlusCircle size={14} /> New Community
        </button>
      </div>

      <div className="space-y-3">
        {sectors.map((sector) => {
          const locked =
            sector.type === 'CLASSIFIED' && sector.requirement && stats[sector.requirement.stat] < sector.requirement.value;
          return (
            <button
              key={sector.id}
              onClick={() => handleAccess(sector)}
              className="w-full text-left border border-pandora-border px-4 py-3 bg-pandora-surface rounded-2xl hover:border-pandora-accent-to hover:bg-white/5 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sector.type === 'PUBLIC' ? (
                    <ShieldCheck size={16} className="text-pandora-text" />
                  ) : locked ? (
                    <Lock size={16} className="text-pandora-pink" />
                  ) : (
                    <AlertTriangle size={16} className="text-pandora-text" />
                  )}
                  <div className="font-semibold text-pandora-text">{sector.name}</div>
                </div>
                <span
                  className={`text-[11px] font-mono px-2 py-1 rounded-full ${
                    sector.type === 'PUBLIC'
                      ? 'bg-gradient-to-r from-pandora-accent-from/70 to-pandora-accent-to/70 text-pandora-bg'
                      : 'border border-pandora-pink text-pandora-pink'
                  }`}
                >
                  {sector.type === 'PUBLIC' ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="text-xs text-pandora-muted mt-1">{sector.description}</div>
              {sector.requirement && <div className="text-[11px] font-mono text-pandora-muted mt-1">{requirementText(sector)}</div>}
            </button>
          );
        })}
        {sectors.length === 0 && <p className="text-sm text-pandora-muted">No communities yet. Create one to begin.</p>}
      </div>

      {selected && (
        <div className="border border-pandora-border bg-pandora-bg p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-pandora-text">
              <PanelsTopLeft size={16} className="text-pandora-text" />
              <h3 className="text-sm font-semibold uppercase">{selected.name} 커뮤니티</h3>
            </div>
          </div>
          <p className="text-xs text-pandora-muted">{selected.description}</p>

          <div className="space-y-2">
            <div className="text-[11px] uppercase text-pandora-muted font-semibold">새 글 올리기</div>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="커뮤니티에 남길 메시지를 입력하세요"
                className="flex-1 h-20 bg-pandora-surface/80 border border-pandora-border text-pandora-text text-sm p-3 rounded-2xl font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
              />
              <button
                onClick={handleCreatePost}
                disabled={!draft.trim() || posting}
                className="h-20 w-12 rounded-2xl border border-white/15 bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg flex items-center justify-center hover:shadow-lg transition disabled:opacity-50"
              >
                {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase text-pandora-muted font-semibold">최근 글</div>
            {posts.map((post) => {
              const created =
                post.createdAt && 'seconds' in post.createdAt
                  ? new Date(post.createdAt.seconds * 1000).toLocaleString()
                  : 'Just now';
              return (
                <div key={post.id} className="border border-pandora-border bg-pandora-surface/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-pandora-muted">
                    <span>{created}</span>
                  </div>
                  <p className="text-sm text-pandora-text whitespace-pre-line">{post.content}</p>
                </div>
              );
            })}
            {posts.length === 0 && <p className="text-sm text-pandora-muted">아직 글이 없습니다.</p>}
          </div>

          {sectorChannelId && (
            <div className="mt-3">
              <ChatRoom channelId={sectorChannelId} type={1} title={`${selected.name} Chat`} subtitle="커뮤니티 채팅" />
            </div>
          )}
        </div>
      )}

      {creatingSector && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center">
          <div className="w-full max-w-md border border-white/15 bg-pandora-surface/95 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase text-pandora-text">Create Community</h3>
              <button onClick={() => setCreatingSector(false)} className="text-pandora-muted hover:text-pandora-text text-lg">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs uppercase text-pandora-muted font-semibold">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-2xl font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
                  placeholder="Community name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-pandora-muted font-semibold">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-2xl font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
                  placeholder="What happens here?"
                />
              </div>
              <div className="flex items-center gap-3 text-xs uppercase text-pandora-muted">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={newType === 'PUBLIC'}
                    onChange={() => setNewType('PUBLIC')}
                  />
                  Public
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={newType === 'CLASSIFIED'}
                    onChange={() => setNewType('CLASSIFIED')}
                  />
                  Classified
                </label>
              </div>
              {newType === 'CLASSIFIED' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs uppercase text-pandora-muted font-semibold">Stat</label>
                    <select
                      value={newReqStat}
                      onChange={(e) => setNewReqStat(e.target.value as keyof UserStats)}
                      className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-2 rounded-2xl"
                    >
                      {(['logic', 'altruism', 'aggression', 'credit'] as const).map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase text-pandora-muted font-semibold">Value</label>
                    <input
                      type="number"
                      value={newReqValue}
                      onChange={(e) => setNewReqValue(Number(e.target.value))}
                      className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-2 rounded-2xl"
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleCreateSector}
                  disabled={savingSector}
                  className="px-4 py-2 border border-transparent bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg font-semibold uppercase text-xs rounded-full hover:shadow-lg transition disabled:opacity-50"
                >
                  {savingSector ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={14} />
                      Creating...
                    </span>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
