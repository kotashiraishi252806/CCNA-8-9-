import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadQuestions, loadAttempts, clearAttempts } from "../utils/storage.js";
import { computeOverallStats, computeWrongQuestionIds } from "../utils/stats.js";
import { importanceClassName } from "../utils/importance.js";

const HISTORY_PAGE_SIZE = 10;

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupBySession(attempts) {
  const bySession = new Map();
  for (const a of attempts) {
    // Attempts recorded before session tracking was added have no sessionId;
    // treat each as its own single-attempt session so nothing is lost.
    const key = a.sessionId || a.id;
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key).push(a);
  }
  return [...bySession.values()]
    .map((group) => {
      const sorted = [...group].sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));
      return {
        key: sorted[0].id,
        attempts: sorted,
        start: sorted[0].answeredAt,
        end: sorted[sorted.length - 1].answeredAt,
        correct: sorted.filter((a) => a.correct).length,
        total: sorted.length,
      };
    })
    .sort((a, b) => new Date(b.start) - new Date(a.start));
}

export default function StatsPage() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState(() => loadAttempts());
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const questions = useMemo(() => loadQuestions(), []);
  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );

  const overall = useMemo(() => computeOverallStats(attempts), [attempts]);

  const wrongQuestions = useMemo(() => {
    const wrongIds = new Set(computeWrongQuestionIds(attempts));
    return questions.filter((q) => wrongIds.has(q.id));
  }, [attempts, questions]);

  const sessionGroups = useMemo(() => groupBySession(attempts), [attempts]);

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
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>間違えている問題（{wrongQuestions.length}件）</h3>
        {wrongQuestions.length === 0 ? (
          <div className="empty-state">現在、間違えたままの問題はありません。</div>
        ) : (
          wrongQuestions.map((q) => (
            <div className="question-list-item" key={q.id}>
              <span className="tag">{q.category}</span>
              <span className={`tag ${importanceClassName(q.importance)}`}>重要度: {q.importance}</span>
              {q.steps.length > 1 && <span className="tag tag-steps">{q.steps.length}ステップ</span>}
              <div style={{ marginTop: 8 }}>{q.question}</div>
              <div className="muted mono" style={{ marginTop: 4 }}>
                正解: {q.steps.map((s) => s.answers.join(" / ")).join(" → ")}
              </div>
              <div className="question-actions">
                <button className="btn" onClick={() => navigate(`/admin?edit=${q.id}`)}>
                  編集
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>回答履歴（{sessionGroups.length}セッション）</h3>
        {sessionGroups.length === 0 ? (
          <div className="empty-state">まだ回答履歴がありません。</div>
        ) : (
          <>
            {sessionGroups.slice(0, historyLimit).map((session) => (
              <div className="session-group" key={session.key}>
                <div className="session-header">
                  <span>
                    {formatDateTime(session.start)}
                    {session.end !== session.start && ` 〜 ${formatTime(session.end)}`}
                  </span>
                  <span className="muted">
                    {session.correct}/{session.total} 正解
                  </span>
                </div>
                {session.attempts.map((a) => {
                  const q = questionById.get(a.questionId);
                  return (
                    <div className="history-row" key={a.id}>
                      <span className={`history-mark ${a.correct ? "correct" : "wrong"}`}>
                        {a.correct ? "⚪︎" : "×"}
                      </span>
                      {q && <span className="tag">{q.category}</span>}
                      <span className="history-question">{q ? q.question : "（削除済みの問題）"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {historyLimit < sessionGroups.length && (
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
