import { HexagonChart } from '../components/ui/HexagonChart';
import { PandoraAvatar } from '../components/ui/PandoraAvatar';
import { useStore } from '../store/useStore';

export default function Profile() {
  const stats = useStore((s) => s.userStats);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-pandora-text">Subject-9218</div>
          <div className="text-xs text-pandora-neon font-mono uppercase">ONLINE</div>
        </div>
        <PandoraAvatar username="Subject-9218" size="md" />
      </div>
      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-sm space-y-3">
        <HexagonChart stats={[stats.logic, stats.altruism, stats.aggression, stats.credit, 54, 32]} />
        <div className="grid grid-cols-2 gap-3 text-sm font-mono uppercase">
          <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm text-pandora-text">
            <span className="text-pandora-muted">LOGIC</span>
            <span>{stats.logic}</span>
          </div>
          <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm text-pandora-text">
            <span className="text-pandora-muted">ALTRUISM</span>
            <span>{stats.altruism}</span>
          </div>
          <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm text-pandora-text">
            <span className="text-pandora-muted">AGGRESSION</span>
            <span>{stats.aggression}</span>
          </div>
          <div className="flex items-center justify-between border border-pandora-border px-3 py-2 rounded-sm text-pandora-text">
            <span className="text-pandora-muted">CREDIT</span>
            <span>{stats.credit}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
