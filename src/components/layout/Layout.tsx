import { Home, PanelsTopLeft, MessageSquare, Settings, Sparkles, User, Plus, Play, Hexagon } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { PandoraAvatar } from '../ui/PandoraAvatar';
import { HexagonChart } from '../ui/HexagonChart';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/sectors', label: 'Sectors', icon: PanelsTopLeft },
  { to: '/samples', label: 'Samples', icon: Play },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const modes = ['NORMAL', 'BLIND', 'SILENCE'] as const;

export function Layout() {
  const location = useLocation();
  const experimentMode = useStore((s) => s.experimentMode);
  const setMode = useStore((s) => s.setExperimentMode);
  const stats = useStore((s) => s.userStats);

  const [writeOpen, setWriteOpen] = useState(false);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const trigger = draft.toLowerCase().includes('#order');
    setShowOrderPanel(trigger);
  }, [draft]);

  const isSamples = location.pathname.startsWith('/samples');

  return (
    <div className="h-dvh overflow-hidden bg-pandora-bg text-pandora-text">
      {/* Left Sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 w-[250px] h-screen border-r border-pandora-border bg-pandora-surface px-5 py-6 z-30">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-pandora-neon flex items-center justify-center">
              <Sparkles className="text-pandora-neon" size={20} />
            </div>
            <div className="text-lg font-semibold tracking-wide">PANDORA</div>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'w-full flex items-center gap-3 px-3 py-2 border border-pandora-border text-left text-sm rounded-none',
                      isActive ? 'border-pandora-neon text-pandora-neon' : 'hover:border-pandora-neon',
                    )
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <button
            onClick={() => setWriteOpen(true)}
            className="w-full border border-pandora-neon text-pandora-neon bg-transparent font-semibold py-3 rounded-none uppercase text-sm hover:bg-pandora-neon hover:text-pandora-bg transition"
          >
            [ NEW DATA + ]
          </button>
          <div className="space-y-2">
            <div className="text-xs uppercase text-pandora-muted font-semibold">Experiment Mode</div>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode(mode)}
                  className={cn(
                    'text-xs border border-pandora-border py-2 rounded-none font-mono',
                    experimentMode === mode ? 'border-pandora-neon text-pandora-neon' : 'text-pandora-muted hover:border-pandora-neon',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Right Sidebar */}
      <aside className="hidden lg:block fixed top-0 right-0 w-[320px] h-screen border-l border-pandora-border bg-pandora-surface overflow-y-auto">
        <div className="p-5 space-y-6 sticky top-0 bg-pandora-surface">
          <div className="border border-pandora-border bg-pandora-bg p-4 rounded-none space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide">MY PASSPORT</h3>
                <p className="text-xs text-pandora-muted font-mono">Subject-9218</p>
              </div>
              <span className="text-xs font-mono uppercase text-pandora-neon">ONLINE</span>
            </div>
            <PandoraAvatar username="Subject-9218" showName size="md" />
            <HexagonChart stats={[stats.logic, stats.altruism, stats.aggression, stats.credit, 54, 32]} />
            <div className="grid grid-cols-2 gap-3 text-sm font-mono uppercase">
              <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-none text-pandora-text">
                <span className="text-pandora-muted">LOGIC</span>
                <span>{stats.logic}</span>
              </div>
              <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-none text-pandora-text">
                <span className="text-pandora-muted">ALTRUISM</span>
                <span>{stats.altruism}</span>
              </div>
              <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-none text-pandora-text">
                <span className="text-pandora-muted">AGGRESSION</span>
                <span>{stats.aggression}</span>
              </div>
              <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-none text-pandora-text">
                <span className="text-pandora-muted">CREDIT</span>
                <span>{stats.credit}%</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div
        className={cn(
          'h-full overflow-y-auto no-scrollbar lg:pl-[270px] lg:pr-[340px]',
          isSamples ? 'pt-0 pb-0' : 'pt-12 pb-16 md:pb-10',
        )}
      >
        <div className={cn(isSamples ? 'w-full h-full' : 'max-w-[1200px] mx-auto px-4', isSamples && 'px-0')}>
          {!isSamples && (
            <header className="lg:hidden sticky top-0 z-20 h-10 bg-pandora-surface border-b border-pandora-border overflow-hidden">
              <div className="absolute inset-0 flex items-center whitespace-nowrap font-mono text-[11px] uppercase text-pandora-neon animate-marquee">
                <span className="mx-6">[User_992: SURVIVED]</span>
                <span className="mx-6 text-pandora-pink">[ALERT: New GroupBuy Closing]</span>
                <span className="mx-6 text-pandora-neon">[SYSTEM: Surveillance Locked]</span>
              </div>
            </header>
          )}
          <main className={cn('grid grid-cols-1 gap-8', isSamples ? 'h-full mt-0' : 'mt-4')}>
            <div className={cn('max-w-[640px] mx-auto w-full', isSamples && 'max-w-none h-full')}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Bottom nav mobile */}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 h-14 border-t border-pandora-border flex items-center justify-around lg:hidden z-40',
          isSamples
            ? 'bg-gradient-to-t from-pandora-surface/80 via-pandora-surface/50 to-transparent backdrop-blur-sm'
            : 'bg-pandora-surface',
        )}
      >
        {[
          { to: '/', label: 'Home', icon: Home },
          { to: '/sectors', label: 'Sectors', icon: PanelsTopLeft },
        ].map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="flex flex-col items-center justify-center gap-1">
              <Icon size={20} className={cn(active ? 'text-pandora-neon' : 'text-pandora-muted')} />
              <span className={cn('text-[11px]', active ? 'text-pandora-neon' : 'text-pandora-muted')}>{item.label}</span>
            </NavLink>
          );
        })}
        <button
          onClick={() => setWriteOpen(true)}
          className="flex flex-col items-center justify-center gap-1 text-pandora-neon"
          aria-label="New Data"
        >
          <Plus size={22} />
          <span className="text-[11px]">New</span>
        </button>
        {[
          { to: '/samples', label: 'Samples', icon: Play },
          { to: '/profile', label: 'Profile', icon: Hexagon },
        ].map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="flex flex-col items-center justify-center gap-1">
              <Icon size={20} className={cn(active ? 'text-pandora-neon' : 'text-pandora-muted')} />
              <span className={cn('text-[11px]', active ? 'text-pandora-neon' : 'text-pandora-muted')}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Write Modal */}
      {writeOpen && (
        <section className="fixed inset-0 z-40 bg-black/70 flex items-end lg:items-center lg:justify-center">
          <div className="w-full lg:w-[520px] border border-pandora-neon bg-pandora-surface p-5 rounded-sm space-y-4">
            <div className="flex items-center justify-between border-b border-pandora-border pb-3">
              <h3 className="text-sm font-semibold uppercase text-pandora-text">Compose Transmission</h3>
              <button onClick={() => setWriteOpen(false)} className="text-pandora-muted hover:text-pandora-text text-lg">
                ✕
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your field note... try #Order"
              className="w-full h-32 bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono focus:outline-none focus:border-pandora-neon"
            />
            <div
              className={cn(
                'transform transition-all duration-200 origin-bottom',
                showOrderPanel ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
              )}
            >
              <div className="border border-dashed border-pandora-neon bg-pandora-bg p-4 rounded-sm space-y-3">
                <div className="text-xs uppercase text-pandora-muted font-semibold">#Order Details</div>
                <input
                  type="text"
                  placeholder="Price"
                  className="w-full bg-pandora-surface border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
                />
                <input
                  type="text"
                  placeholder="Qty"
                  className="w-full bg-pandora-surface border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
                />
                <input
                  type="text"
                  placeholder="Account"
                  className="w-full bg-pandora-surface border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="px-4 py-2 border border-pandora-neon text-pandora-neon bg-transparent font-semibold uppercase text-xs rounded-sm hover:bg-pandora-neon hover:text-pandora-bg transition">
                Transmit
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
