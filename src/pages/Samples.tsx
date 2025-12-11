import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Share2, MessageSquare, Activity, Hexagon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';

type Sample = {
  id: string;
  mbti: string;
  color: string;
};

export default function Samples() {
  const isBlind = useStore((s) => s.isBlind());
  const samples = useMemo<Sample[]>(() => {
    const colors = [
      'from-[#1f1f1f] to-[#121212]',
      'from-[#0f2b2b] to-[#121212]',
      'from-[#2b0f21] to-[#121212]',
      'from-[#1b1f2b] to-[#121212]',
      'from-[#2b1b0f] to-[#121212]',
    ];
    const mbtiPool = ['INTJ', 'ENTP', 'INFJ', 'ISTP', 'ENFP'];
    return Array.from({ length: 5 }).map((_, i) => ({
      id: `Subject-${Math.floor(1000 + Math.random() * 8999)}`,
      mbti: mbtiPool[i % mbtiPool.length],
      color: colors[i % colors.length],
    }));
  }, []);

  const [active, setActive] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  return (
    <div className="h-dvh overflow-y-scroll snap-y snap-mandatory no-scrollbar">
      {samples.map((sample, idx) => {
        const playing = idx === active;
        return (
          <div key={sample.id} data-idx={idx} ref={(el) => (cardRefs.current[idx] = el)} className="snap-start h-dvh flex justify-center">
            <div className="relative h-full w-full max-w-[520px] aspect-[9/16] border border-pandora-border rounded-sm overflow-hidden bg-pandora-bg">
              <div className="absolute inset-0 overflow-hidden">
                <video
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
                />
                <div className={cn('absolute inset-0 bg-gradient-to-br mix-blend-screen', sample.color)} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,0,85,0.08),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(57,255,20,0.08),transparent_35%)]" />
              </div>

              {/* HUD */}
              <div className="absolute top-4 right-4 flex items-center gap-3 text-xs font-mono uppercase">
                <div className="flex items-center gap-1 text-pandora-pink">
                  <span className="w-2 h-2 bg-pandora-pink animate-pulseDot inline-block" />
                  REC
                </div>
                <div className="px-2 py-1 border border-pandora-border rounded-sm bg-pandora-surface text-pandora-text">00:05</div>
              </div>

              <div className="absolute bottom-4 left-4 text-pandora-text space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span>{isBlind ? 'Subject-****' : sample.id}</span>
                  <Hexagon size={16} className="text-pandora-neon" />
                </div>
                <div className="text-xs font-mono text-pandora-muted uppercase">{sample.mbti}</div>
              </div>

              <div className="absolute bottom-10 right-4 flex flex-col items-center gap-4 text-pandora-text">
                <button
                  className={cn(
                    'w-11 h-11 border border-pandora-border rounded-sm flex items-center justify-center hover:border-pandora-neon transition',
                    playing && 'border-pandora-neon',
                  )}
                >
                  <Activity size={18} />
                </button>
                <button className="w-11 h-11 border border-pandora-border rounded-sm flex items-center justify-center hover:border-pandora-neon transition">
                  <MessageSquare size={18} />
                </button>
                <button className="w-11 h-11 border border-pandora-border rounded-sm flex items-center justify-center hover:border-pandora-neon transition">
                  <Share2 size={18} />
                </button>
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={cn(
                    'w-16 h-16 border-2 border-pandora-border rounded-full flex items-center justify-center text-pandora-muted',
                    playing && 'border-pandora-neon text-pandora-neon',
                  )}
                >
                  <Play size={22} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
