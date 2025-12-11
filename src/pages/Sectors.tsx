import { PanelsTopLeft, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useStore, UserStats } from '../store/useStore';

type Sector = {
  name: string;
  type: 'PUBLIC' | 'CLASSIFIED';
  requirement?: { stat: keyof UserStats; value: number };
  description: string;
};

const sectors: Sector[] = [
  { name: 'Free Board', type: 'PUBLIC', description: 'Low-noise chatter and daily logs.' },
  { name: 'Market (GroupBuy)', type: 'PUBLIC', description: 'Bulk-buy experiments and swaps.' },
  { name: 'Logic Lab', type: 'CLASSIFIED', requirement: { stat: 'logic', value: 50 }, description: 'Cold reasoning sandbox.' },
  { name: 'Chaos Lab', type: 'CLASSIFIED', requirement: { stat: 'aggression', value: 80 }, description: 'Unfiltered stress tests.' },
];

export default function Sectors() {
  const stats = useStore((s) => s.userStats);

  const handleAccess = (sector: Sector) => {
    if (sector.type === 'PUBLIC') return;
    if (!sector.requirement) return;
    const current = stats[sector.requirement.stat];
    if (current < sector.requirement.value) {
      window.alert(`ACCESS DENIED: Need ${sector.requirement.stat.toUpperCase()} > ${sector.requirement.value}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-pandora-text">
          <PanelsTopLeft size={18} className="text-pandora-neon" />
          <h2 className="text-lg font-semibold tracking-wide">SECTORS</h2>
        </div>
        <span className="text-xs text-pandora-muted font-mono uppercase">DIRECTORY</span>
      </div>
      <div className="space-y-3">
        {sectors.map((sector) => {
          const locked =
            sector.type === 'CLASSIFIED' && sector.requirement && stats[sector.requirement.stat] < sector.requirement.value;
          return (
            <button
              key={sector.name}
              onClick={() => handleAccess(sector)}
              className="w-full text-left border border-pandora-border px-4 py-3 bg-pandora-surface rounded-sm hover:border-pandora-neon transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sector.type === 'PUBLIC' ? (
                    <ShieldCheck size={16} className="text-pandora-neon" />
                  ) : locked ? (
                    <Lock size={16} className="text-pandora-pink" />
                  ) : (
                    <AlertTriangle size={16} className="text-pandora-neon" />
                  )}
                  <div className="font-semibold text-pandora-text">{sector.name}</div>
                </div>
                <span
                  className={`text-[11px] font-mono px-2 py-1 rounded-sm ${
                    sector.type === 'PUBLIC' ? 'border border-pandora-neon text-pandora-neon' : 'border border-pandora-pink text-pandora-pink'
                  }`}
                >
                  [{sector.type}]
                </span>
              </div>
              <div className="text-xs text-pandora-muted mt-1">{sector.description}</div>
              {sector.requirement && (
                <div className="text-[11px] font-mono text-pandora-muted mt-1">
                  Req: {sector.requirement.stat.toUpperCase()} &gt; {sector.requirement.value} (yours: {stats[sector.requirement.stat]})
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
