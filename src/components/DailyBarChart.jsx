import { useState } from "react";

const BAR_WIDTH = 22;
const GAP = 14;
const COL_WIDTH = BAR_WIDTH + GAP;
const CHART_HEIGHT = 180;
const AXIS_LEFT = 34;
const RADIUS = 4;

function formatShortDate(dateKey) {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatFullDate(dateKey) {
  const [y, m, d] = dateKey.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function topRoundedRectPath(x, y, w, h, r) {
  const rr = Math.min(r, h, w / 2);
  if (rr <= 0) return `M${x},${y + h} L${x},${y} L${x + w},${y} L${x + w},${y + h} Z`;
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

// Bar chart: one bar per day, height = questions solved that day.
export default function DailyBarChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const maxTotal = Math.max(1, ...data.map((d) => d.count));
  const width = data.length * COL_WIDTH;

  function yFor(count) {
    return CHART_HEIGHT - (count / maxTotal) * CHART_HEIGHT;
  }

  const niceMax = Math.max(1, maxTotal);
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));

  return (
    <div>
      <div className="chart-scroll">
        <svg width={width + AXIS_LEFT + 8} height={CHART_HEIGHT + 40} role="img" aria-label="日別の解答数">
          <g transform={`translate(${AXIS_LEFT}, 8)`}>
            {gridValues.map((v) => (
              <g key={v}>
                <line x1={0} x2={width} y1={yFor(v)} y2={yFor(v)} className="chart-gridline" />
                <text x={-8} y={yFor(v)} className="chart-axis-label" textAnchor="end" dy="0.32em">
                  {v}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = i * COL_WIDTH;
              return (
                <g
                  key={d.date}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex((h) => (h === i ? null : h))}
                >
                  <rect
                    x={x}
                    y={0}
                    width={BAR_WIDTH}
                    height={CHART_HEIGHT}
                    fill={hoverIndex === i ? "var(--surface-hover)" : "transparent"}
                  />
                  {d.count > 0 && (
                    <path
                      d={topRoundedRectPath(x, yFor(d.count), BAR_WIDTH, Math.max(CHART_HEIGHT - yFor(d.count), 1), RADIUS)}
                      fill="var(--accent)"
                    />
                  )}
                  {d.count === 0 && (
                    <rect x={x} y={CHART_HEIGHT - 2} width={BAR_WIDTH} height={2} fill="var(--border)" />
                  )}
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={CHART_HEIGHT + 14}
                    className="chart-axis-label"
                    textAnchor="end"
                    transform={`rotate(-40 ${x + BAR_WIDTH / 2} ${CHART_HEIGHT + 14})`}
                  >
                    {formatShortDate(d.date)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="chart-tooltip-inline">
        {hoverIndex !== null ? (
          <>
            {formatFullDate(data[hoverIndex].date)}：{data[hoverIndex].count}問
          </>
        ) : (
          <span className="muted">バーにカーソルを合わせると解答数が表示されます</span>
        )}
      </div>
    </div>
  );
}
