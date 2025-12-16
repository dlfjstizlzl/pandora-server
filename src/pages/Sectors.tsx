import { useEffect, useMemo, useState } from 'react';
import { PanelsTopLeft, Lock, ShieldCheck, AlertTriangle, PlusCircle, Image, Loader2 } from 'lucide-react';
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

export default function Sectors() {
  const stats = useStore((s) => s.userStats);
  const { user } = useAuthStore();

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selected, setSelected] = useState<Sector | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [creatingSector, setCreatingSector] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'PUBLIC' | 'CLASSIFIED'>('PUBLIC');
  const [newReqStat, setNewReqStat] = useState<keyof UserStats>('logic');
  const [newReqValue, setNewReqValue] = useState(50);
  const [savingSector, setSavingSector] = useState(false);
  const [creatingScreen, setCreatingScreen] = useState(false);
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
      setScreens([]);
      return;
    }
    const q = query(collection(db, 'sectors', selected.id, 'screens'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, sectorId: selected.id, ...(d.data() as Screen) }));
      setScreens(rows);
    });
    return () => unsub();
  }, [selected]);

  const handleAccess = (sector: Sector) => {
    if (sector.type === 'CLASSIFIED' && sector.requirement) {
      const current = stats[sector.requirement.stat];
      if (current < sector.requirement.value) {
        window.alert(`ACCESS DENIED: Need ${sector.requirement.stat.toUpperCase()} > ${sector.requirement.value}`);
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

  const handleCreateScreen = async () => {
    if (!selected || !user) return;
    setCreatingScreen(true);
    try {
      await addDoc(collection(db, 'sectors', selected.id, 'screens'), {
        title: `${selected.name} Screen ${screens.length + 1}`,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
    } finally {
      setCreatingScreen(false);
    }
  };

  const requirementText = (sector: Sector) => {
    if (!sector.requirement) return null;
    return `Req: ${sector.requirement.stat.toUpperCase()} > ${sector.requirement.value} (yours: ${stats[sector.requirement.stat]})`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-pandora-text">
          <PanelsTopLeft size={18} className="text-pandora-text" />
          <h2 className="text-lg font-semibold tracking-wide">SECTORS</h2>
        </div>
        <button
          onClick={() => setCreatingSector(true)}
          className="flex items-center gap-2 text-xs uppercase px-3 py-2 rounded-full bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg shadow hover:shadow-lg transition"
        >
          <PlusCircle size={14} /> New Sector
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
                  [{sector.type}]
                </span>
              </div>
              <div className="text-xs text-pandora-muted mt-1">{sector.description}</div>
              {sector.requirement && <div className="text-[11px] font-mono text-pandora-muted mt-1">{requirementText(sector)}</div>}
            </button>
          );
        })}
        {sectors.length === 0 && <p className="text-sm text-pandora-muted">No sectors yet. Create one to begin.</p>}
      </div>

      {selected && (
        <div className="border border-pandora-border bg-pandora-bg p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-pandora-text">
              <Image size={16} className="text-pandora-text" />
              <h3 className="text-sm font-semibold uppercase">{selected.name} Gallery</h3>
            </div>
            <button
              onClick={handleCreateScreen}
              disabled={creatingScreen}
              className="text-xs uppercase px-3 py-1 rounded-full bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg shadow hover:shadow-lg transition disabled:opacity-50"
            >
              {creatingScreen ? 'Creating...' : 'Create Screen'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {screens.map((screen) => {
              const created =
                screen.createdAt && 'seconds' in screen.createdAt
                  ? new Date(screen.createdAt.seconds * 1000).toLocaleString()
                  : 'Just now';
              return (
                <div key={screen.id} className="border border-pandora-border bg-pandora-surface p-3 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-pandora-text truncate">{screen.title}</div>
                    <span className="text-[11px] text-pandora-muted uppercase">Screen</span>
                  </div>
                  <div className="text-xs text-pandora-muted">Created: {created}</div>
                  <div className="h-32 border border-dashed border-pandora-border bg-pandora-bg flex items-center justify-center text-xs text-pandora-muted">
                    Visuals reserved
                  </div>
                </div>
              );
            })}
            {screens.length === 0 && (
              <div className="text-sm text-pandora-muted border border-pandora-border bg-pandora-surface p-4 rounded-2xl">
                No screens yet. Create one to start the gallery.
              </div>
            )}
          </div>
          {sectorChannelId && (
            <div className="mt-3">
              <ChatRoom channelId={sectorChannelId} type={1} title={`${selected.name} Chat`} subtitle="Sector room" />
            </div>
          )}
        </div>
      )}

      {creatingSector && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center">
          <div className="w-full max-w-md border border-white/15 bg-pandora-surface/95 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase text-pandora-text">Create Sector</h3>
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
                  placeholder="Sector name"
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
