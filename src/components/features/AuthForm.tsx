import { useState } from 'react';
import { Loader2, LogIn, LogOut, Mail, UserRound } from 'lucide-react';
import { useAuthStore } from '../../store/useAuth';
import { cn } from '../../utils/cn';
import { useT } from '../../lib/i18n';

type Mode = 'login' | 'signup';

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const { user, loading, error, signInWithGoogle, loginWithEmail, registerWithEmail, logout, setError } = useAuthStore();
  const t = useT();

  const randomAnon = () => `익명${Math.floor(100 + Math.random() * 900)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'login') {
      await loginWithEmail(email, password);
    } else {
      const name = nickname.trim() || randomAnon();
      await registerWithEmail(email, password, name);
    }
  };

  if (user) {
    return (
      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-pandora-border rounded-full flex items-center justify-center">
            <UserRound size={18} className="text-pandora-neon" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-pandora-text truncate">{user.displayName || user.email || 'Authenticated'}</p>
            <p className="text-xs text-pandora-muted font-mono truncate">{user.email ?? 'Google Account'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs uppercase border border-pandora-border text-pandora-muted hover:border-pandora-neon hover:text-pandora-neon rounded-sm transition disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          {t('auth.signOut')}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-pandora-border bg-pandora-surface p-4 rounded-sm space-y-4">
      <div className="flex items-center gap-2">
        <LogIn size={16} className="text-pandora-neon" />
        <p className="text-sm font-semibold uppercase text-pandora-text">{t('auth.title')}</p>
      </div>
      <div className="flex gap-2 text-xs font-semibold uppercase">
        {(['login', 'signup'] as const).map((entry) => (
          <button
            key={entry}
            onClick={() => {
              setMode(entry);
              setError(null);
            }}
            className={cn(
              'flex-1 border border-pandora-border py-2 rounded-sm',
              mode === entry ? 'border-pandora-neon text-pandora-neon' : 'text-pandora-muted hover:border-pandora-neon',
            )}
          >
            {entry === 'login' ? t('auth.login') : t('auth.signup')}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs uppercase text-pandora-muted font-semibold">{t('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase text-pandora-muted font-semibold">{t('auth.password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        {mode === 'signup' && (
          <div className="space-y-2">
            <label className="text-xs uppercase text-pandora-muted font-semibold">{t('auth.nickname')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="flex-1 bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
                placeholder="예: NeonFox"
                maxLength={24}
              />
              <button
                type="button"
                onClick={() => setNickname(randomAnon())}
                className="px-3 py-2 text-xs uppercase border border-pandora-border text-pandora-text rounded-sm hover:border-pandora-neon"
              >
                {t('auth.nicknameSkip')}
              </button>
            </div>
            <p className="text-[11px] text-pandora-muted">{t('auth.nicknameHint')}</p>
          </div>
        )}
        {error && <p className="text-xs text-pandora-pink">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs uppercase border border-pandora-neon text-pandora-neon rounded-sm hover:bg-pandora-neon hover:text-pandora-bg transition disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          {mode === 'login' ? t('auth.loginEmail') : t('auth.createAccount')}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-pandora-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase text-pandora-muted">
          <span className="bg-pandora-surface px-2">{t('auth.or')}</span>
        </div>
      </div>

      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs uppercase border border-pandora-border text-pandora-text rounded-sm hover:border-pandora-neon hover:text-pandora-neon transition disabled:opacity-60"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <UserRound size={14} />}
        {t('auth.google')}
      </button>
    </div>
  );
}
