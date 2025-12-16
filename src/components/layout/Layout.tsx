import { Home, PanelsTopLeft, MessageSquare, Settings, Sparkles, User, Plus, Play, Hexagon, CheckCircle2, Loader2, Search, Shield } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuth';
import { useProfileStore } from '../../store/useProfile';
import { PandoraAvatar } from '../ui/PandoraAvatar';
import { HexagonChart } from '../ui/HexagonChart';
import { cn } from '../../utils/cn';
import { UploadZone } from '../features/UploadZone';
import { uploadFile } from '../../lib/storage';
import { saveTransmission } from '../../lib/firestore';
import { AuthForm } from '../features/AuthForm';
import { getOrCreateProfile } from '../../lib/profile';
import { subscribeUiConfig } from '../../lib/experiments';
import { useLocaleStore } from '../../store/useLocale';
import { useT } from '../../lib/i18n';

const modes = ['NORMAL', 'BLIND', 'SILENCE'] as const;

export function Layout() {
  const location = useLocation();
  const experimentMode = useStore((s) => s.experimentMode);
  const setMode = useStore((s) => s.setExperimentMode);
  const stats = useStore((s) => s.userStats);
  const setUserStats = useStore((s) => s.setUserStats);
  const { user, loading: authLoading, initialized: authReady } = useAuthStore();
  const { profile, setProfile } = useProfileStore();
  const { locale, setLocale } = useLocaleStore();
  const t = useT();

  const [writeOpen, setWriteOpen] = useState(false);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [draft, setDraft] = useState('');
  const [activeTab, setActiveTab] = useState<'TEXT' | 'SAMPLES'>('TEXT');
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    Array<{ url: string; name: string; contentType?: string }>
  >([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [pendingSample, setPendingSample] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uiConfig, setUiConfig] = useState<{ primaryButtonLabel?: string; tickerMessage?: string } | null>(null);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchTarget = useRef<'left' | 'right' | null>(null);
  const mouseStartX = useRef<number | null>(null);
  const [draggingNav, setDraggingNav] = useState(false);
  const [dragOffset, setDragOffset] = useState(0); // 0 = closed, 1 = fully open
  const [draggingProfile, setDraggingProfile] = useState(false);
  const [profileDragOffset, setProfileDragOffset] = useState(0); // 0 = closed, 1 = open

  useEffect(() => {
    const trigger = draft.toLowerCase().includes('#order');
    setShowOrderPanel(trigger);
  }, [draft]);

  useEffect(() => {
    const syncProfile = async () => {
      if (!user) {
        setProfile(null);
        return;
      }
      const profile = await getOrCreateProfile({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
      setUserStats(profile.stats);
      setProfile({ ...profile, role: profile.role || 'user' });
    };
    syncProfile().catch(() => {
      // silently ignore; UI will still render with defaults
    });
  }, [user, setUserStats, setProfile]);

  useEffect(() => {
    const unsub = subscribeUiConfig((config) => setUiConfig(config));
    return () => unsub();
  }, []);

  const localeOptions = [
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'zh', label: '中文' },
    { code: 'ru', label: 'Русский' },
    { code: 'es', label: 'Español' },
  ];

  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/search', label: t('nav.search'), icon: Search },
    { to: '/sectors', label: t('nav.sectors'), icon: PanelsTopLeft },
    { to: '/samples', label: t('nav.samples'), icon: Play },
    { to: '/messages', label: t('nav.messages'), icon: MessageSquare },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
    ...(profile?.role === 'admin' ? [{ to: '/admin', label: t('nav.admin'), icon: Shield }] : []),
  ];

  const isSamples = location.pathname.startsWith('/samples');
  const isDetail = location.pathname.startsWith('/t/');
  const isMessages = location.pathname.startsWith('/messages');
  const showRightPanel = !isMessages && showProfilePanel;
  const showFloatingNew = location.pathname === '/' || location.pathname.startsWith('/sectors');

  const resetWriteState = () => {
    setDraft('');
    setSampleUrl(null);
    setAttachments([]);
    setPendingAttachments([]);
    setPendingSample(null);
    setActiveTab('TEXT');
    setShowOrderPanel(false);
    setSubmitting(false);
    setSubmitError(null);
  };

  const handleCloseWrite = () => {
    setWriteOpen(false);
    resetWriteState();
  };

  const handleSampleUpload = async (file: File) => {
    const url = await uploadFile(file, 'samples');
    setSampleUrl(url);
    setPendingSample(null);
    return url;
  };

  const handleAttachmentUpload = async (file: File) => {
    const url = await uploadFile(file, 'attachments');
    setAttachments((prev) => [...prev, { url, name: file.name, contentType: file.type }]);
    return url;
  };

  const handleSubmit = async () => {
    const contentText = draft.trim();
    const canSubmitNow =
      activeTab === 'TEXT'
        ? contentText.length > 0 || attachments.length > 0 || pendingAttachments.length > 0
        : Boolean(sampleUrl || pendingSample);
    if (!canSubmitNow || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      // Upload any pending files first so post + files go together
      let attachmentsForPost = [...attachments];
      if (activeTab === 'TEXT' && pendingAttachments.length) {
        for (const file of pendingAttachments) {
          const url = await uploadFile(file, 'attachments');
          attachmentsForPost.push({ url, name: file.name, contentType: file.type });
        }
        setAttachments(attachmentsForPost);
        setPendingAttachments([]);
      }

      let sampleUrlForPost = sampleUrl;
      if (activeTab === 'SAMPLES' && !sampleUrl && pendingSample) {
        sampleUrlForPost = await handleSampleUpload(pendingSample);
      }

      await saveTransmission({
        type: activeTab === 'TEXT' ? 'text' : 'sample',
        content: activeTab === 'TEXT' ? contentText || undefined : undefined,
        attachments: activeTab === 'TEXT' ? attachmentsForPost : undefined,
        sampleUrl: activeTab === 'SAMPLES' ? sampleUrlForPost ?? undefined : undefined,
      });
      handleCloseWrite();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    activeTab === 'TEXT'
      ? draft.trim().length > 0 || attachments.length > 0 || pendingAttachments.length > 0
      : Boolean(sampleUrl || pendingSample);

  if (!authReady || authLoading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-pandora-bg text-pandora-text">
        <div className="flex items-center gap-3 text-sm uppercase font-semibold">
          <Loader2 className="animate-spin text-pandora-text" size={18} />
          Initializing...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-pandora-bg text-pandora-text flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm uppercase text-pandora-muted font-semibold">{t('auth.accessRequired')}</p>
            <p className="text-lg font-semibold text-pandora-text">{t('auth.enter')}</p>
          </div>
          <AuthForm />
        </div>
      </div>
    );
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0]?.clientX ?? 0;
    if (window.innerWidth > 1024) return;

    const RIGHT_WIDTH = 320;
    const LEFT_WIDTH = 280;

    // If nav is open, allow drag-close from inside the drawer region
    if (mobileNavOpen && x <= LEFT_WIDTH + 20) {
      touchStartX.current = x;
      touchTarget.current = 'left';
      setDraggingNav(true);
      setDragOffset(1);
      return;
    }

    // If profile is open, allow drag-close from its region
    if (mobileProfileOpen && x >= window.innerWidth - (RIGHT_WIDTH + 20)) {
      touchStartX.current = x;
      touchTarget.current = 'right';
      setDraggingProfile(true);
      setProfileDragOffset(1);
      return;
    }

    // If nav is closed, allow drag-open from the far left edge
    if (!mobileNavOpen && x < 40) {
      touchStartX.current = x;
      touchTarget.current = 'left';
      setDraggingNav(true);
      setDragOffset(0);
      return;
    }

    // If profile is closed, allow drag-open from the far right edge
    if (!mobileProfileOpen && x > window.innerWidth - 40) {
      touchStartX.current = x;
      touchTarget.current = 'right';
      setDraggingProfile(true);
      setProfileDragOffset(0);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const delta = endX - touchStartX.current;

    if (touchTarget.current === 'left') {
      const shouldOpen = mobileNavOpen ? dragOffset > 0.35 : delta > 90 || dragOffset > 0.55;
      setMobileNavOpen(shouldOpen);
      setDraggingNav(false);
      setDragOffset(0);
    } else if (touchTarget.current === 'right') {
      const deltaOpen = touchStartX.current - endX; // positive when swiping left to open
      const shouldOpen = mobileProfileOpen ? profileDragOffset > 0.35 : deltaOpen > 80 || profileDragOffset > 0.55;
      setMobileProfileOpen(shouldOpen);
      setDraggingProfile(false);
      setProfileDragOffset(0);
    }

    touchStartX.current = null;
    touchTarget.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const x = e.touches[0]?.clientX ?? 0;
    const RIGHT_WIDTH = 320;
    const LEFT_WIDTH = 280;

    if (touchTarget.current === 'left' && draggingNav) {
      if (mobileNavOpen) {
        const deltaClose = Math.max(0, Math.min(LEFT_WIDTH, touchStartX.current - x));
        setDragOffset(Math.max(0, 1 - deltaClose / LEFT_WIDTH));
      } else {
        const deltaOpen = Math.max(0, Math.min(LEFT_WIDTH, x - touchStartX.current));
        setDragOffset(deltaOpen / LEFT_WIDTH);
      }
    }

    if (touchTarget.current === 'right' && draggingProfile) {
      if (mobileProfileOpen) {
        const deltaClose = Math.max(0, Math.min(RIGHT_WIDTH, x - touchStartX.current));
        setProfileDragOffset(Math.max(0, 1 - deltaClose / RIGHT_WIDTH));
      } else {
        const deltaOpen = Math.max(0, Math.min(RIGHT_WIDTH, touchStartX.current - x));
        setProfileDragOffset(deltaOpen / RIGHT_WIDTH);
      }
    }
  };

  const handleProfileMouseDown = (e: React.MouseEvent) => {
    if (window.innerWidth > 1024) return;
    const x = e.clientX;
    const RIGHT_WIDTH = 320;
    if (mobileProfileOpen && x >= window.innerWidth - (RIGHT_WIDTH + 20)) {
      mouseStartX.current = x;
      touchTarget.current = 'right';
      setDraggingProfile(true);
      setProfileDragOffset(1);
      return;
    }
    if (!mobileProfileOpen && x > window.innerWidth - 16) {
      mouseStartX.current = x;
      touchTarget.current = 'right';
      setDraggingProfile(true);
      setProfileDragOffset(0);
    }
  };

  const handleProfileMouseMove = (e: React.MouseEvent) => {
    if (mouseStartX.current === null || !draggingProfile) return;
    const x = e.clientX;
    const RIGHT_WIDTH = 320;
    if (mobileProfileOpen) {
      const deltaClose = Math.max(0, Math.min(RIGHT_WIDTH, x - mouseStartX.current));
      setProfileDragOffset(Math.max(0, 1 - deltaClose / RIGHT_WIDTH));
    } else {
      const deltaOpen = Math.max(0, Math.min(RIGHT_WIDTH, mouseStartX.current - x));
      setProfileDragOffset(deltaOpen / RIGHT_WIDTH);
    }
  };

  const handleProfileMouseUp = (e: React.MouseEvent) => {
    if (mouseStartX.current === null || !draggingProfile) return;
    const endX = e.clientX;
    const deltaOpen = mouseStartX.current - endX; // positive when dragging leftwards to open
    const shouldOpen = mobileProfileOpen ? profileDragOffset > 0.35 : deltaOpen > 80 || profileDragOffset > 0.55;
    setMobileProfileOpen(shouldOpen);
    setDraggingProfile(false);
    setProfileDragOffset(0);
    mouseStartX.current = null;
    touchTarget.current = null;
  };
  // Mouse-based drag (desktop narrow widths)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (window.innerWidth > 1024) return;
    const x = e.clientX;
    const LEFT_WIDTH = 280;
    // Close-open drag when already open
    if (mobileNavOpen && x <= LEFT_WIDTH + 20) {
      mouseStartX.current = x;
      touchTarget.current = 'left';
      setDraggingNav(true);
      setDragOffset(1);
      return;
    }
    // Open from edge
    if (!mobileNavOpen && x < 24) {
      mouseStartX.current = x;
      touchTarget.current = 'left';
      setDraggingNav(true);
      setDragOffset(0);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseStartX.current === null || !draggingNav) return;
    const x = e.clientX;
    const LEFT_WIDTH = 280;
    if (mobileNavOpen) {
      const deltaClose = Math.max(0, Math.min(LEFT_WIDTH, mouseStartX.current - x));
      setDragOffset(Math.max(0, 1 - deltaClose / LEFT_WIDTH));
    } else {
      const deltaOpen = Math.max(0, Math.min(LEFT_WIDTH, x - mouseStartX.current));
      setDragOffset(deltaOpen / LEFT_WIDTH);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (mouseStartX.current === null || !draggingNav) return;
    const endX = e.clientX;
    const delta = endX - mouseStartX.current;
    const shouldOpen = mobileNavOpen ? dragOffset > 0.35 : delta > 90 || dragOffset > 0.55;
    setMobileNavOpen(shouldOpen);
    setDraggingNav(false);
    setDragOffset(0);
    mouseStartX.current = null;
    touchTarget.current = null;
  };

  return (
    <div
      className="h-dvh overflow-hidden bg-pandora-bg text-pandora-text"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseDownCapture={handleProfileMouseDown}
      onMouseMoveCapture={handleProfileMouseMove}
      onMouseUpCapture={handleProfileMouseUp}
    >
      {/* Mobile swipe hint */}
      {!mobileNavOpen && (
        <div className="lg:hidden fixed left-1 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="w-1.5 h-12 rounded-full bg-white/20 shadow-[0_0_18px_rgba(255,255,255,0.15)] animate-pulse" />
        </div>
      )}
      {!mobileProfileOpen && (
        <div className="lg:hidden fixed right-1 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="w-1.5 h-12 rounded-full bg-white/20 shadow-[0_0_18px_rgba(255,255,255,0.15)] animate-pulse" />
        </div>
      )}
      {/* Left Sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 w-[260px] h-screen border-r border-pandora-border/60 bg-pandora-surface/80 backdrop-blur-md px-5 py-6 z-30 rounded-r-3xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-pandora-border/70 rounded-3xl bg-white/5 flex items-center justify-center">
                <Sparkles className="text-pandora-text" size={20} />
              </div>
              <div className="text-lg font-semibold tracking-wide text-pandora-text">PANDORA</div>
            </div>
            <div className="relative">
              <button
                onClick={() => setLocaleMenuOpen((v) => !v)}
                className="text-xs font-semibold uppercase px-2 py-1 border border-pandora-border/70 text-pandora-text rounded-full hover:border-pandora-text hover:bg-white/10"
                title="Select language"
              >
                {locale.toUpperCase()}
              </button>
              {localeMenuOpen && (
                <div className="absolute right-0 mt-2 w-36 border border-pandora-border/70 bg-pandora-bg/90 rounded-3xl shadow-xl backdrop-blur-md">
                  {localeOptions.map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => {
                        setLocale(opt.code as any);
                        setLocaleMenuOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs rounded-3xl hover:bg-white/5',
                        opt.code === locale ? 'text-pandora-text font-semibold' : 'text-pandora-text',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                      'w-full flex items-center gap-3 px-3 py-3 border border-pandora-border/70 text-left text-sm rounded-2xl transition bg-white/0',
                      isActive
                        ? 'text-pandora-text border-white/30 shadow-[0_12px_32px_-10px_rgba(165,180,252,0.75)]'
                        : 'text-pandora-muted',
                      !isActive && 'hover:bg-white/5 hover:text-pandora-text hover:border-white/20',
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
            className="w-full border border-transparent text-pandora-text bg-[#8D7BFF]/85 font-semibold py-3 rounded-2xl uppercase text-sm shadow-[0_10px_24px_-16px_rgba(141,123,255,0.35)] ring-1 ring-white/10 hover:shadow-xl transition backdrop-blur"
          >
            {uiConfig?.primaryButtonLabel ?? '[ NEW DATA + ]'}
          </button>
        </div>
      </aside>

      {/* Right Sidebar */}
      {showRightPanel && (
        <aside className="hidden lg:block fixed top-0 right-0 w-[320px] h-screen border-l border-pandora-border/60 bg-pandora-surface/80 backdrop-blur-md overflow-y-auto">
          <div className="p-5 space-y-6 sticky top-0 bg-pandora-surface/60 backdrop-blur">
            <div className="border border-pandora-border/70 bg-white/5 p-5 rounded-2xl space-y-4 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-pandora-text">My Passport</h3>
                  <p className="text-xs text-pandora-muted font-semibold">{profile?.displayName || 'Subject'}</p>
                </div>
                <span className="text-xs font-semibold uppercase text-pandora-neon bg-white/10 px-3 py-1 rounded-full">Online</span>
              </div>
              <PandoraAvatar username={profile?.displayName || profile?.email || 'Subject'} showName size="md" />
              <HexagonChart stats={[stats.logic, stats.altruism, stats.aggression, stats.credit, stats.logic, stats.credit]} />
              <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
                <div className="flex items-center justify-between border border-pandora-border/60 px-3 py-2 rounded-2xl text-pandora-text bg-white/5">
                  <span className="text-pandora-muted">Logic</span>
                  <span>{stats.logic}</span>
                </div>
                <div className="flex items-center justify-between border border-pandora-border/60 px-3 py-2 rounded-2xl text-pandora-text bg-white/5">
                  <span className="text-pandora-muted">Altruism</span>
                  <span>{stats.altruism}</span>
                </div>
                <div className="flex items-center justify-between border border-pandora-border/60 px-3 py-2 rounded-2xl text-pandora-text bg-white/5">
                  <span className="text-pandora-muted">Aggression</span>
                  <span>{stats.aggression}</span>
                </div>
                <div className="flex items-center justify-between border border-pandora-border/60 px-3 py-2 rounded-2xl text-pandora-text bg-white/5">
                  <span className="text-pandora-muted">Credit</span>
                  <span>{stats.credit}%</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main */}
      <div
        className={cn(
          'h-full lg:pl-[270px]',
          isMessages ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar',
          showRightPanel ? 'lg:pr-[340px]' : 'lg:pr-6',
          isSamples ? 'pt-0 pb-16' : isMessages ? 'pt-2 pb-4' : 'pt-12 pb-16 md:pb-10',
        )}
      >
        {/* Desktop profile handle */}
        {!isMessages && (
          <button
            onClick={() => setShowProfilePanel((v) => !v)}
            className={cn(
              'hidden lg:flex fixed top-1/2 -translate-y-1/2 z-40 h-12 w-8 items-center justify-center border border-pandora-border/70 bg-white/10 backdrop-blur-md text-xs font-semibold uppercase hover:border-pandora-text rounded-full',
              showRightPanel ? 'right-[320px]' : 'right-0',
            )}
            aria-label={showProfilePanel ? 'Hide profile panel' : 'Show profile panel'}
          >
            {showProfilePanel ? '⟨' : '⟩'}
          </button>
        )}
        <div
          className={cn(
            isSamples ? 'w-full h-full' : isMessages ? 'w-full max-w-[1200px] mx-auto px-2 lg:px-4' : 'max-w-[1200px] mx-auto px-4',
            isSamples && 'px-0',
          )}
        >
          {!isSamples && !location.pathname.startsWith('/messages') && (
            <header className="lg:hidden bg-pandora-surface/85 border-b border-pandora-border/70 backdrop-blur-md px-3 py-2 space-y-1">
              <div className="flex items-center gap-3 text-[11px] uppercase">
                <span className="text-[10px] font-bold text-pandora-neon">[FEED LIVE]</span>
                <span className="text-[10px] font-bold text-[#FF6B6B]">[AUTH REQUIRED]</span>
                <span className="text-pandora-text truncate">
                  {uiConfig?.tickerMessage || t('banner.default')}
                </span>
              </div>
            </header>
          )}
          <main className={cn('grid grid-cols-1', isSamples ? 'h-full mt-0 gap-8' : isMessages ? 'h-full mt-0 gap-3' : 'mt-4 gap-8')}>
            <div
              className={cn(
                'mx-auto w-full',
                isSamples ? 'max-w-none h-full' : isMessages ? 'max-w-none h-full' : isDetail ? 'max-w-[1100px]' : 'max-w-[640px]',
              )}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>


      {/* Mobile nav drawer */}
      {(mobileNavOpen || draggingNav) && (
        <div className="lg:hidden fixed top-0 left-0 bottom-0 z-50 pointer-events-none">
          <div
            className="w-64 h-full bg-pandora-surface/95 backdrop-blur-md border-r border-pandora-border/70 p-4 space-y-4 transform transition-transform duration-300 ease-out pointer-events-auto"
            style={{
              transform: `translateX(${(-1 + (draggingNav ? dragOffset : mobileNavOpen ? 1 : 0)) * 100}%)`,
              transition: draggingNav ? 'none' : 'transform 300ms ease',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl border border-pandora-border/70 bg-white/5 flex items-center justify-center">
                  <Sparkles className="text-pandora-text" size={18} />
                </div>
                <span className="text-sm font-semibold text-pandora-text">PANDORA</span>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="text-pandora-muted hover:text-pandora-text text-lg"
                aria-label="Close navigation"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive: active }) =>
                      cn(
                        'w-full flex items-center gap-3 px-3 py-3 border border-pandora-border/70 text-left text-sm rounded-full transition bg-white/0',
                        (active || isActive)
                          ? 'text-pandora-text border-white/30 shadow-[0_12px_32px_-10px_rgba(165,180,252,0.75)]'
                          : 'text-pandora-muted',
                      )
                    }
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="pt-4">
              <div className="text-[11px] uppercase text-pandora-muted mb-2">Language</div>
              <div className="relative">
                <button
                  onClick={() => setLocaleMenuOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-full border border-pandora-border/70 text-pandora-text hover:border-pandora-accent-to"
                >
                  <span className="font-semibold">{locale.toUpperCase()}</span>
                  <span className="text-xs text-pandora-muted">▼</span>
                </button>
                {localeMenuOpen && (
                  <div className="absolute mt-2 w-full border border-pandora-border/70 bg-pandora-bg/95 rounded-3xl shadow-lg z-10">
                    {localeOptions.map((opt) => (
                      <button
                        key={opt.code}
                        onClick={() => {
                          setLocale(opt.code as any);
                          setLocaleMenuOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs rounded-3xl hover:bg-white/5',
                          opt.code === locale ? 'text-pandora-text font-semibold' : 'text-pandora-text',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile profile drawer */}
      {(mobileProfileOpen || draggingProfile) && (
        <div className="lg:hidden fixed top-0 right-0 bottom-0 z-50 pointer-events-none">
          <div
            className="w-72 h-full bg-pandora-surface/95 backdrop-blur-md border-l border-pandora-border/70 p-4 space-y-4 transform transition-transform duration-300 ease-out pointer-events-auto"
            style={{
              transform: `translateX(${(1 - (draggingProfile ? profileDragOffset : mobileProfileOpen ? 1 : 0)) * 100}%)`,
              transition: draggingProfile ? 'none' : 'transform 300ms ease',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PandoraAvatar username={profile?.displayName || 'You'} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-pandora-text truncate">{profile?.displayName || 'You'}</span>
                  {profile?.email && <span className="text-xs text-pandora-muted truncate">{profile.email}</span>}
                </div>
              </div>
              <button
                onClick={() => setMobileProfileOpen(false)}
                className="text-pandora-muted hover:text-pandora-text text-lg"
                aria-label="Close profile"
              >
                ✕
              </button>
            </div>
            <div className="border border-pandora-border/70 bg-white/5 p-4 rounded-2xl space-y-3 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between text-xs text-pandora-text">
                <span className="font-semibold">My Passport</span>
                <span className="text-[10px] uppercase text-pandora-neon bg-white/10 px-2 py-0.5 rounded-full">Online</span>
              </div>
              <HexagonChart stats={[stats.logic, stats.altruism, stats.aggression, stats.credit, stats.logic, stats.credit]} />
              <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                <div className="flex items-center justify-between border border-pandora-border/60 px-3 py-2 rounded-2xl text-pandora-text bg-white/5">
                  <span className="text-pandora-muted text-xs">Logic</span>
                  <span>{stats.logic}</span>
                </div>
                <div className="flex items-center justify-between border border-pandora-border/60 px-3 py-2 rounded-2xl text-pandora-text bg-white/5">
                  <span className="text-pandora-muted text-xs">Altruism</span>
                  <span>{stats.altruism}</span>
                </div>
                <div className="flex items-center justify-between border border-pandora-border/60 px-3 py-2 rounded-2xl text-pandora-text bg-white/5">
                  <span className="text-pandora-muted text-xs">Aggression</span>
                  <span>{stats.aggression}</span>
                </div>
                <div className="flex items-center justify-between border border-pandora-border/60 px-3 py-2 rounded-2xl text-pandora-text bg-white/5">
                  <span className="text-pandora-muted text-xs">Credit</span>
                  <span>{stats.credit}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating New button (mobile) */}
      {showFloatingNew && !isMessages && (
        <button
          onClick={() => {
            if (location.pathname.startsWith('/sectors')) {
              window.dispatchEvent(new CustomEvent('open-sector-modal'));
            } else {
              setWriteOpen(true);
            }
          }}
          className="lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full text-white shadow-[0_12px_32px_-10px_rgba(165,180,252,0.75)] border border-white/30 flex items-center justify-center hover:scale-105 transition bg-transparent backdrop-blur-md"
          aria-label="New Data"
        >
          <Plus size={24} className="text-white" />
        </button>
      )}

      {/* Write Modal */}
      {writeOpen && (
        <section className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end lg:items-center lg:justify-center px-4">
          <div className="w-full lg:w-[640px] border border-white/15 bg-pandora-surface/95 shadow-2xl rounded-t-3xl lg:rounded-2xl max-h-[90vh] lg:max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-center py-3 lg:hidden">
              <div className="w-12 h-1.5 rounded-full bg-white/30" />
            </div>
            <div className="flex items-center justify-between border-b border-white/10 px-6 pb-3">
              <h3 className="text-base font-semibold text-pandora-text">Compose</h3>
              <button onClick={handleCloseWrite} className="text-pandora-muted hover:text-pandora-text text-lg">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="flex items-center gap-2">
                {(['TEXT', 'SAMPLES'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-3 py-2 text-xs rounded-full font-semibold tracking-wide border border-white/10',
                      activeTab === tab
                        ? 'text-pandora-text bg-gradient-to-r from-pandora-accent-from/40 to-pandora-accent-to/40 border-transparent'
                        : 'text-pandora-muted hover:border-white/30',
                    )}
                  >
                    {tab === 'TEXT' ? 'Notes' : 'Samples'}
                  </button>
                ))}
              </div>

              {activeTab === 'TEXT' ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type your field note... try #Order"
                    className="w-full h-40 bg-pandora-bg/60 border border-white/10 text-pandora-text text-sm p-3 rounded-2xl focus:outline-none focus:border-pandora-accent-to"
                  />
                  <div className="space-y-2">
                    <p className="text-xs text-pandora-muted">Attach photos, videos, or files (optional).</p>
                  <UploadZone
                    label="Attach files"
                    description="Images, videos, docs, pdf up to your limit"
                    accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                    onUpload={handleAttachmentUpload}
                    deferUpload
                    multiple
                    onFilesSelected={(files) => {
                      if (!files.length) return;
                      setPendingAttachments((prev) => [...prev, ...files]);
                    }}
                  />
                  {attachments.length > 0 && (
                    <div className="border border-white/10 bg-pandora-bg/70 p-3 rounded-2xl space-y-2">
                      <p className="text-xs text-pandora-muted">Attached</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                          {attachments.map((f) => (
                            <div key={f.url} className="flex items-center justify-between text-xs text-pandora-text border border-white/10 rounded-xl px-3 py-2">
                              <span className="truncate">{f.name}</span>
                              <button
                                className="text-pandora-muted hover:text-pandora-text text-[11px]"
                                onClick={() =>
                                  setAttachments((prev) => prev.filter((att) => att.url !== f.url))
                                }
                              >
                                ✕
                              </button>
                            </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pendingAttachments.length > 0 && (
                    <div className="border border-dashed border-white/15 bg-pandora-bg/60 p-3 rounded-2xl space-y-2">
                      <p className="text-xs text-pandora-muted">Pending upload</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {pendingAttachments.map((f, idx) => (
                          <div key={`${f.name}-${idx}`} className="flex items-center justify-between text-xs text-pandora-text border border-white/10 rounded-xl px-3 py-2">
                            <span className="truncate">{f.name}</span>
                            <span className="text-[11px] text-pandora-muted">will upload on post</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    'transform transition-all duration-200 origin-bottom',
                    showOrderPanel ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
                    )}
                  >
                    <div className="border border-dashed border-white/20 bg-pandora-bg/70 p-4 rounded-2xl space-y-3">
                      <div className="text-xs text-pandora-muted font-semibold">#Order Details</div>
                      <input
                        type="text"
                        placeholder="Price"
                        className="w-full bg-pandora-surface/70 border border-white/10 text-pandora-text text-sm p-3 rounded-2xl placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
                      />
                      <input
                        type="text"
                        placeholder="Qty"
                        className="w-full bg-pandora-surface/70 border border-white/10 text-pandora-text text-sm p-3 rounded-2xl placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
                      />
                      <input
                        type="text"
                        placeholder="Account"
                        className="w-full bg-pandora-surface/70 border border-white/10 text-pandora-text text-sm p-3 rounded-2xl placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-pandora-muted">Upload a sample video to share to SAMPLES.</p>
                  <UploadZone
                    label="Drop Sample Video Here"
                    description="MP4, MOV, WEBM — keep it concise"
                    accept="video/*"
                    onUpload={handleSampleUpload}
                    deferUpload
                    onFileSelected={(file) => {
                      setPendingSample(file ?? null);
                      setSampleUrl(null);
                    }}
                  />
                  {sampleUrl && (
                    <div className="border border-white/10 bg-pandora-bg/70 p-3 rounded-2xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-pandora-muted">Linked Sample</p>
                        <p className="text-sm text-pandora-text truncate">{sampleUrl}</p>
                      </div>
                      <span className="flex items-center gap-2 text-xs text-pandora-text">
                        <CheckCircle2 size={14} /> Ready to submit
                      </span>
                    </div>
                  )}
                </div>
              )}
              {submitError && <p className="text-xs text-pandora-pink">{submitError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10 bg-pandora-surface/95">
              <button
                onClick={handleCloseWrite}
                className="px-4 py-2 text-sm rounded-full border border-white/20 text-pandora-text hover:border-white/40"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="px-5 py-2 text-xs font-semibold rounded-full bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </span>
                ) : activeTab === 'SAMPLES' ? (
                  sampleUrl ? 'Submit Sample' : 'Upload Sample'
                ) : (
                  'Transmit'
                )}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
