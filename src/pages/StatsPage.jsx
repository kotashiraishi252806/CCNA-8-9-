import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadQuestions, loadAttempts, clearAttempts, loadFavoriteIds, toggleFavorite } from "../utils/storage.js";
import {
  computeOverallStats,
  computeWrongQuestionIds,
  computeQuestionHistory,
  computeCategoryAccuracy,
} from "../utils/stats.js";
import { importanceClassName } from "../utils/importance.js";
import { toPlainSummary } from "../utils/questionText.js";
import QuestionText from "../components/QuestionText.jsx";
import QuestionTable from "../components/QuestionTable.jsx";
import AnswerHistoryMarks from "../components/AnswerHistoryMarks.jsx";

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
  const [questionHistoryLimit, setQuestionHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(loadFavoriteIds()));
  const [favoriteLimit, setFavoriteLimit] = useState(HISTORY_PAGE_SIZE);
  const questions = useMemo(() => loadQuestions(), []);
  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );

  const overall = useMemo(() => computeOverallStats(attempts), [attempts]);

  const categoryAccuracy = useMemo(
    () => computeCategoryAccuracy(attempts, questionById),
    [attempts, questionById]
  );

  const wrongQuestions = useMemo(() => {
    const wrongIds = computeWrongQuestionIds(attempts);
    return wrongIds.map((id) => questionById.get(id)).filter(Boolean);
  }, [attempts, questionById]);

  const sessionGroups = useMemo(() => groupBySession(attempts), [attempts]);

  const historyByQuestion = useMemo(() => computeQuestionHistory(attempts), [attempts]);

  // Most-missed first; favorites that have never been answered go last.
  const favoriteHistories = useMemo(
    () =>
      questions
        .filter((q) => favoriteIds.has(q.id))
        .map((question) => {
          const history = historyByQuestion.get(question.id) ?? [];
          return { question, history, wrongCount: history.filter((a) => !a.correct).length };
        })
        .sort((a, b) => b.wrongCount - a.wrongCount || b.history.length - a.history.length),
    [questions, favoriteIds, historyByQuestion]
  );

  const questionHistories = useMemo(() => {
    return [...historyByQuestion.entries()]
      .map(([questionId, history]) => ({ questionId, question: questionById.get(questionId), history }))
      .filter((h) => h.question)
      .sort(
        (a, b) =>
          new Date(b.history[b.history.length - 1].answeredAt) -
          new Date(a.history[a.history.length - 1].answeredAt)
      );
  }, [historyByQuestion, questionById]);

  function handleReset() {
    if (!confirm("学習履歴（正答率・間違えた問題）をすべてリセットしますか？")) return;
    clearAttempts();
    setAttempts([]);
    setHistoryLimit(HISTORY_PAGE_SIZE);
    setQuestionHistoryLimit(HISTORY_PAGE_SIZE);
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
        <h3>章別正答率</h3>
        {categoryAccuracy.length === 0 ? (
          <div className="empty-state">まだ回答履歴がありません。</div>
        ) : (
          <div className="session-table-wrap" style={{ marginTop: 0 }}>
            <table className="session-table">
              <thead>
                <tr>
                  <th>章</th>
                  <th>正解/回答</th>
                  <th>正答率</th>
                </tr>
              </thead>
              <tbody>
                {categoryAccuracy.map((c, i) => (
                  <tr key={c.category}>
                    <td>
                      {c.category}
                      {i === 0 && categoryAccuracy.length > 1 && (
                        <span className="tag" style={{ marginLeft: 8 }}>最低</span>
                      )}
                    </td>
                    <td>
                      {c.correct}/{c.total}
                    </td>
                    <td style={i === 0 && categoryAccuracy.length > 1 ? { color: "var(--danger)", fontWeight: 700 } : undefined}>
                      {c.accuracy}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>お気に入り問題の正誤推移（{favoriteHistories.length}件）</h3>
        {favoriteHistories.length === 0 ? (
          <div className="empty-state">お気に入りの問題はまだありません。回答後の画面から登録できます。</div>
        ) : (
          <>
            {favoriteHistories.slice(0, favoriteLimit).map(({ question, history }) => (
              <div className="question-list-item" key={question.id}>
                <span className="tag">{question.category}</span>
                <QuestionText text={question.question} className="question-preview" />
                <div style={{ marginTop: 8 }}>
                  <AnswerHistoryMarks history={history} />
                </div>
                <div className="question-actions">
                  <button
                    className="btn"
                    onClick={() => setFavoriteIds(new Set(toggleFavorite(question.id)))}
                  >
                    お気に入り解除
                  </button>
                </div>
              </div>
            ))}
            {favoriteLimit < favoriteHistories.length && (
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => setFavoriteLimit((n) => n + HISTORY_PAGE_SIZE)}
              >
                もっと見る
              </button>
            )}
          </>
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
              <span className={`tag ${importanceClassName(q.importance)}`}>重要度: {q.importance}</span>
              {q.type !== "table" && q.steps.length > 1 && (
                <span className="tag tag-steps">{q.steps.length}ステップ</span>
              )}
              <QuestionText text={q.question} className="question-preview" />
              {q.type === "table" ? (
                <QuestionTable table={q.table} mode="answers" />
              ) : (
                <div className="muted mono" style={{ marginTop: 4 }}>
                  正解: {q.steps.map((s) => s.answers.join(" / ")).join(" → ")}
                </div>
              )}
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
                      <span className="history-question">
                        {q ? toPlainSummary(q.question) : "（削除済みの問題）"}
                      </span>
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

      <div className="card" style={{ marginTop: 16 }}>
        <h3>問題ごとの学習履歴（{questionHistories.length}件）</h3>
        {questionHistories.length === 0 ? (
          <div className="empty-state">まだ回答履歴がありません。</div>
        ) : (
          <>
            {questionHistories.slice(0, questionHistoryLimit).map(({ questionId, question, history }) => (
              <div className="question-list-item" key={questionId}>
                <span className="tag">{question.category}</span>
                <QuestionText text={question.question} className="question-preview" />
                <div className="muted mono" style={{ marginTop: 4 }}>
                  {history
                    .map((a) => `${formatDateTime(a.answeredAt)}：${a.correct ? "⚪︎" : "×"}`)
                    .join(" → ")}
                </div>
              </div>
            ))}
            {questionHistoryLimit < questionHistories.length && (
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => setQuestionHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
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
