import { useMemo, useState } from "react";
import { loadAttempts } from "../utils/storage.js";
import { computeDailyStudyCounts, computeSessionSummaries, recentDateKeys, dateKeysSince } from "../utils/stats.js";
import DailyBarChart from "../components/DailyBarChart.jsx";
import AccuracyTrendChart from "../components/AccuracyTrendChart.jsx";

const RANGE_OPTIONS = [
  { value: 7, label: "過去7日" },
  { value: 30, label: "過去30日" },
  { value: 0, label: "全期間" },
];

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LearningRecordPage() {
  const attempts = useMemo(() => loadAttempts(), []);
  const [range, setRange] = useState(30);

  const allDailyCounts = useMemo(() => computeDailyStudyCounts(attempts), [attempts]);
  const sessions = useMemo(() => computeSessionSummaries(attempts), [attempts]);

  const dailyData = useMemo(() => {
    if (allDailyCounts.length === 0) return [];
    const byDate = new Map(allDailyCounts.map((d) => [d.date, d]));
    const days = range === 0 ? dateKeysSince(allDailyCounts[0].date) : recentDateKeys(range);
    return days.map((date) => byDate.get(date) || { date, count: 0 });
  }, [allDailyCounts, range]);

  const sessionsInRange = useMemo(() => {
    if (range === 0) return sessions;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range + 1);
    cutoff.setHours(0, 0, 0, 0);
    return sessions.filter((s) => new Date(s.start) >= cutoff);
  }, [sessions, range]);

  const totalSolvedInRange = dailyData.reduce((sum, d) => sum + d.count, 0);

  if (attempts.length === 0) {
    return (
      <div>
        <h1>学習記録</h1>
        <div className="empty-state">まだ学習記録がありません。「出題」で問題に回答すると記録されます。</div>
      </div>
    );
  }

  return (
    <div>
      <h1>学習記録</h1>

      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`tab-btn ${range === opt.value ? "active" : ""}`}
            onClick={() => setRange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="card">
        <h3>日別の解答数（計{totalSolvedInRange}問）</h3>
        {totalSolvedInRange === 0 ? (
          <div className="empty-state">この期間の学習記録はありません。</div>
        ) : (
          <DailyBarChart data={dailyData} />
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>セットごとの正解率の推移（{sessionsInRange.length}セット）</h3>
        <div className="muted" style={{ marginBottom: 12 }}>
          1回の出題（章丸ごと・間違えた問題のみ、いずれも）を1セットとして、セットごとの正解率を古い順に表示しています。
        </div>
        {sessionsInRange.length === 0 ? (
          <div className="empty-state">この期間の学習記録はありません。</div>
        ) : (
          <>
            <AccuracyTrendChart sessions={sessionsInRange} />
            <div className="session-table-wrap">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>正解数</th>
                    <th>正答率</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sessionsInRange].reverse().map((s) => (
                    <tr key={s.key}>
                      <td>{formatDateTime(s.start)}</td>
                      <td>
                        {s.correct}/{s.total}
                      </td>
                      <td>{s.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
