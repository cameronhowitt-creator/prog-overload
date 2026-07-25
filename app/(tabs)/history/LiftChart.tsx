// Pure inline SVG line chart for a lift's weight-over-time (PRD §6.4). Styled from
// the locked tokens (§9 gap: chart styling designed fresh). No external deps; works
// in light and dark via currentColor + CSS vars. Server-renderable.

export default function LiftChart({ weights }: { weights: number[] }) {
  const W = 320;
  const H = 48;
  const pad = 4;

  if (weights.length === 0) return null;

  if (weights.length === 1) {
    // Single data point — draw a dot.
    return (
      <svg className="chart" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="One logged session">
        <circle cx={W / 2} cy={H / 2} r={3} fill="var(--primary)" />
      </svg>
    );
  }

  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (weights.length - 1);

  const points = weights
    .map((w, i) => {
      const x = pad + i * stepX;
      // Invert Y (SVG origin top-left); keep a little headroom.
      const y = H - pad - ((w - min) / span) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="chart"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Weight trend across ${weights.length} sessions, ${min} to ${max} lb`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
