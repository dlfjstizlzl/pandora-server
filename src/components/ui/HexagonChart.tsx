type Props = {
  stats: number[]; // expects 6 values
};

export function HexagonChart({ stats }: Props) {
  const normalized = stats.map((v) => Math.max(0, Math.min(100, v)));
  const points = normalized
    .map((val, idx) => {
      const angle = ((Math.PI * 2) / 6) * idx - Math.PI / 2;
      const radius = 80 * (val / 100);
      const x = 100 + radius * Math.cos(angle);
      const y = 100 + radius * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="bg-[linear-gradient(#1a1a1a_1px,transparent_1px),linear-gradient(90deg,#1a1a1a_1px,transparent_1px)] bg-[length:18px_18px] p-4">
      <svg viewBox="0 0 200 200" className="w-full h-48">
        <polygon points="100,20 166,60 166,140 100,180 34,140 34,60" fill="none" stroke="#39FF14" strokeWidth="1.5" />
        <polygon points="100,40 150,70 150,130 100,160 50,130 50,70" fill="none" stroke="#00F0FF" strokeWidth="1" />
        <polygon points={points} fill="rgba(57,255,20,0.12)" stroke="#39FF14" strokeWidth="2" />
      </svg>
    </div>
  );
}
