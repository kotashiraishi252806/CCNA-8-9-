import { useState } from "react";

const COL_WIDTH = 40;
const CHART_HEIGHT = 180;
const AXIS_LEFT = 34;

function formatShortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Line + dot chart: one point per quiz session ("set"), in chronological order,
// plotting that session's accuracy.
export default function AccuracyTrendChart({ sessions }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const width = Math.max(sessions.length * COL_WIDTH, COL_WIDTH);

  function yFor(pct) {
    return CHART_HEIGHT - (pct / 100) * CHART_HEIGHT;
  }

  const points = sessions.map((s, i) => ({
    x: i * COL_WIDTH + COL_WIDTH / 2,
    y: yFor(s.accuracy),
    session: s,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  let lastLabel = null;

  return (
    <div>
      <div className="chart-scroll">
        <svg width={width + AXIS_LEFT + 8} height={CHART_HEIGHT + 34} role="img" aria-label="セットごとの正解率の推移">
          <g transform={`translate(${AXIS_LEFT}, 8)`}>
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line x1={0} x2={width} y1={yFor(v)} y2={yFor(v)} className="chart-gridline" />
                <text x={-8} y={yFor(v)} className="chart-axis-label" textAnchor="end" dy="0.32em">
                  {v}%
                </text>
              </g>
            ))}
            <path d={linePath} className="trend-line" fill="none" />
            {points.map((p, i) => {
              const dateLabel = formatShortDate(p.session.start);
              const showLabel = dateLabel !== lastLabel;
              if (showLabel) lastLabel = dateLabel;
              const isHover = hoverIndex === i;
              return (
                <g
                  key={p.session.key}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex((h) => (h === i ? null : h))}
                >
                  <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={isHover ? 7 : 5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
                  {showLabel && (
                    <text x={p.x} y={CHART_HEIGHT + 14} className="chart-axis-label" textAnchor="middle">
                      {dateLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="chart-tooltip-inline">
        {hoverIndex !== null ? (
          <>
            {formatDateTime(points[hoverIndex].session.start)}
            ：{points[hoverIndex].session.correct}/{points[hoverIndex].session.total} 正解（
            {points[hoverIndex].session.accuracy}%）
          </>
        ) : (
          <span className="muted">点にカーソルを合わせるとそのセットの詳細が表示されます</span>
        )}
      </div>
    </div>
  );
}
