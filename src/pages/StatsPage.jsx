import { useMemo, useState } from "react";
import { loadQuestions, loadAttempts, clearAttempts, getCategories } from "../utils/storage.js";
import { computeCategoryStats, computeOverallStats, computeWrongQuestionIds } from "../utils/stats.js";

const HISTORY_PAGE_SIZE = 20;

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatsPage() {
  const [attempts, setAttempts] = useState(() => loadAttempts());
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const questions = useMemo(() => loadQuestions(), []);
  const categories = useMemo(() => getCategories(), []);
  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );

  const overall = useMemo(() => computeOverallStats(attempts), [attempts]);
  const categoryStats = useMemo(
    () => computeCategoryStats(attempts, categories),
    [attempts, categories]
  );

  const wrongQuestions = useMemo(() => {
    const wrongIds = new Set(computeWrongQuestionIds(attempts));
    return questions.filter((q) => wrongIds.has(q.id));
  }, [attempts, questions]);

  const history = useMemo(
    () => [...attempts].sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt)),
    [attempts]
  );

  function handleReset() {
    if (!confirm("学習履歴（正答率・間違えた問題）をすべてリセットしますか？")) return;
    clearAttempts();
    setAttempts([]);
    setHistoryLimit(HISTORY_PAGE_SIZE);
  }

  return (
    <div>
      <h1>成績</h1>

      <div className="card">
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="value">{overall.total}</div>
            <div className="label">総回答数</div>
          </div>
          <div className="stat-tile">
            <div className="value">{overall.correct}</div>
            <div className="label">正解数</div>
          </div>
          <div className="stat-tile">
            <div className="value">{overall.accuracy !== null ? `${overall.accuracy}%` : "-"}</div>
            <div className="label">全体正答率</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>カテゴリ別正答率</h3>
        {categoryStats.length === 0 ? (
          <div className="empty-state">まだデータがありません。</div>
        ) : (
          categoryStats.map((s) => (
            <div key={s.category} style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <span>{s.category}</span>
                <span className="muted">
                  {s.total > 0 ? `${s.correct}/${s.total}（${s.accuracy}%）` : "未回答"}
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${s.accuracy ?? 0}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>間違えている問題（{wrongQuestions.length}件）</h3>
        {wrongQuestions.length === 0 ? (
          <div className="empty-state">現在、間違えたままの問題はありません。</div>
        ) : (
          wrongQuestions.map((q) => (
            <div className="question-list-item" key={q.id}>
              <span className="tag">{q.category}</span>
              {q.steps.length > 1 && <span className="tag tag-steps">{q.steps.length}ステップ</span>}
              <div style={{ marginTop: 8 }}>{q.question}</div>
              <div className="muted mono" style={{ marginTop: 4 }}>
                正解: {q.steps.map((s) => s.answers.join(" / ")).join(" → ")}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>回答履歴（{history.length}件）</h3>
        {history.length === 0 ? (
          <div className="empty-state">まだ回答履歴がありません。</div>
        ) : (
          <>
            {history.slice(0, historyLimit).map((a) => {
              const q = questionById.get(a.questionId);
              return (
                <div className="history-row" key={a.id}>
                  <span className={`history-mark ${a.correct ? "correct" : "wrong"}`}>
                    {a.correct ? "⚪︎" : "×"}
                  </span>
                  <span className="muted history-time">{formatDateTime(a.answeredAt)}</span>
                  {q && <span className="tag">{q.category}</span>}
                  <span className="history-question">{q ? q.question : "（削除済みの問題）"}</span>
                </div>
              );
            })}
            {historyLimit < history.length && (
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
              >
                もっと見る
              </button>
            )}
          </>
        )}
      </div>

      <div className="question-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-danger" onClick={handleReset}>
          学習履歴をリセット
        </button>
      </div>
    </div>
  );
}
