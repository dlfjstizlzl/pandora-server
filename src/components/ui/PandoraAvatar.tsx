import { cn } from '../../utils/cn';
import { useStore } from '../../store/useStore';

type Props = {
  username: string;
  src?: string;
  size?: 'sm' | 'md';
  className?: string;
  showName?: boolean;
};

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
};

function maskUsername(name: string) {
  if (name.length <= 2) return '*'.repeat(name.length);
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(3, name.length - 2))}`;
}

export function PandoraAvatar({ username, src, size = 'md', className, showName = false }: Props) {
  const isBlind = useStore((s) => s.isBlind());
  const masked = isBlind ? maskUsername(username) : username;
  const dimension = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'overflow-hidden border border-pandora-border rounded-none bg-pandora-surface flex items-center justify-center',
          dimension,
        )}
      >
        {isBlind ? (
          <div className="w-full h-full bg-gradient-to-br from-pandora-surface via-pandora-bg to-pandora-surface animate-pulse" />
        ) : src ? (
          <img src={src} alt={username} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center text-[10px] text-pandora-muted font-mono">
            <span>{username[0] ?? '?'}</span>
          </div>
        )}
      </div>
      {showName && <span className="text-sm font-medium text-pandora-text font-sans">{masked}</span>}
    </div>
  );
}
