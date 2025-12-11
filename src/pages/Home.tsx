import { useMemo, useState } from 'react';
import { ArrowUpRight, ShoppingBag, TerminalSquare, Video } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PandoraAvatar } from '../components/ui/PandoraAvatar';
import { cn } from '../utils/cn';

type Sample = { id: string };

const maskName = (name: string, masked: boolean) => {
  if (!masked) return name;
  if (name.length <= 2) return '*'.repeat(name.length);
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(3, name.length - 2))}`;
};

export default function Home() {
  const isBlind = useStore((s) => s.isBlind());
  const isSilenced = useStore((s) => s.isSilenced());

  const [vote, setVote] = useState(50);

  return (
    <div className="space-y-8">
      <header className="sticky top-0 z-10 h-10 bg-pandora-surface border-b border-pandora-border overflow-hidden hidden lg:block">
        <div className="absolute inset-0 flex items-center whitespace-nowrap font-mono text-[11px] uppercase text-pandora-neon animate-marquee">
          <span className="mx-6">[User_992: SURVIVED]</span>
          <span className="mx-6 text-pandora-pink">[ALERT: Credit market volatile]</span>
          <span className="mx-6 text-pandora-neon">[SYSTEM: Blind trials queued]</span>
        </div>
      </header>

      {/* Live samples removed; handled in Samples tab */}

      {/* System Log */}
      <article className="border border-pandora-border bg-pandora-surface p-4 rounded-none font-mono text-sm text-pandora-pink">
        <div className="text-xs text-pandora-muted uppercase mb-2 flex items-center gap-2">
          <TerminalSquare size={14} />
          <span>System Log</span>
        </div>
        <p>&gt; SYSTEM ALERT: Anomaly detected in Sector 4.</p>
      </article>

      {/* Arena Vote */}
      <article className="space-y-4 border border-pandora-border p-4 bg-pandora-surface rounded-none">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-pandora-text">The Arena</div>
          <span className="text-[11px] font-mono uppercase text-pandora-neon">Voting</span>
        </div>
        <p className="text-sm text-pandora-text">Topic: Should we ban User_Error?</p>
        <div className="w-full h-3 border border-pandora-neon flex">
          <div className="bg-pandora-bg h-full" style={{ width: `${vote}%` }} />
          <div className="bg-pandora-text h-full" style={{ width: `${100 - vote}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs font-mono text-pandora-muted">
          <span>YES {vote}%</span>
          <span>NO {100 - vote}%</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVote((v) => Math.min(100, v + 5))}
            className="px-3 py-2 border border-pandora-neon text-pandora-neon text-xs font-semibold uppercase rounded-none hover:bg-pandora-neon hover:text-pandora-bg transition"
          >
            [ VOTE YES ]
          </button>
          <button
            onClick={() => setVote((v) => Math.max(0, v - 5))}
            className="px-3 py-2 border border-pandora-border text-pandora-text text-xs font-semibold uppercase rounded-none hover:border-pandora-neon transition"
          >
            [ VOTE NO ]
          </button>
        </div>
      </article>

      {/* Commerce Widget */}
      <article className="space-y-4 border border-pandora-border p-4 bg-pandora-surface rounded-none">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-pandora-text">Subject-7721</div>
          <span className="text-[11px] font-mono border border-pandora-neon px-2 py-1 rounded-none uppercase text-pandora-neon">
            #Order
          </span>
        </div>
        <p className="text-sm text-pandora-text flex items-center gap-2">
          <ShoppingBag size={14} className="text-pandora-neon" />
          <span>Item: Cyber Hoodie</span>
        </p>
        <div className="border border-pandora-border border-dashed p-4 bg-pandora-bg rounded-none space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs text-pandora-muted uppercase">Price</div>
              <div className="text-lg font-mono text-pandora-text">35,000 P</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-pandora-muted uppercase">Progress</div>
              <div className="text-sm font-mono text-pandora-text">60%</div>
            </div>
          </div>
          <div className="w-full h-2 bg-pandora-bg border border-pandora-border rounded-none">
            <div className="h-full bg-pandora-neon" style={{ width: '60%' }} />
          </div>
          <button className="w-full border border-pandora-neon text-pandora-neon bg-transparent font-semibold uppercase text-sm py-2 rounded-none hover:bg-pandora-neon hover:text-pandora-bg transition">
            [ PLEDGE ]
          </button>
        </div>
      </article>

      {/* Standard Post */}
      <article className="space-y-3 border border-pandora-border p-4 bg-pandora-surface rounded-none">
        <div className="flex items-center gap-3">
          <PandoraAvatar username="Subject-9281" size="sm" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-pandora-text">{maskName('Subject-9281', isBlind)}</div>
            <div className="text-[11px] text-pandora-muted">18m ago</div>
          </div>
        </div>
        <p className="text-sm text-pandora-text">
          The blind test is driving me crazy. <span className="text-pandora-pink font-semibold">#Feedback</span>
        </p>
        <div className="flex items-center gap-4 text-xs uppercase font-semibold tracking-wide">
          <button className="text-pandora-muted hover:text-pandora-text">[ AGREE 124 ]</button>
          <button className="text-pandora-muted hover:text-pandora-text">[ DATA 42 ]</button>
          <button className="text-pandora-muted hover:text-pandora-text">[ SHARE ]</button>
        </div>
        <div className="pt-2">
          <label className="text-[11px] uppercase text-pandora-muted font-mono flex items-center gap-2">
            <ArrowUpRight size={12} />
            <span>Quick note</span>
          </label>
          <textarea
            placeholder={isSilenced ? 'Silence mode active' : 'Type a response...'}
            disabled={isSilenced}
            className={cn(
              'mt-2 w-full h-24 bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-none font-mono focus:outline-none focus:border-pandora-neon',
              isSilenced && 'opacity-60 cursor-not-allowed',
            )}
          />
        </div>
      </article>
    </div>
  );
}
