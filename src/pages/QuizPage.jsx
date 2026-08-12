import { useEffect, useMemo, useState } from "react";
import { loadQuestions, loadAttempts, recordAttempt, checkSteps, getCategories } from "../utils/storage.js";
import {
  computeLastSessionWrongQuestionIds,
  computeLowAccuracyQuestionIds,
} from "../utils/stats.js";
import { importanceClassName } from "../utils/importance.js";
import QuestionText from "../components/QuestionText.jsx";

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function QuizPage() {
  const [allQuestions, setAllQuestions] = useState(() => loadQuestions());
  const [categories, setCategories] = useState(() => getCategories());

  useEffect(() => {
    // Picks up edits made in another tab (e.g. via "この問題を編集") once you
    // switch back to this tab. The session already in progress is left alone;
    // this only affects the next "出題を開始".
    function refreshQuestions() {
      setAllQuestions(loadQuestions());
      setCategories(getCategories());
    }
    window.addEventListener("focus", refreshQuestions);
    return () => window.removeEventListener("focus", refreshQuestions);
  }, []);

  const [selectAllCategories, setSelectAllCategories] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState(() => new Set());
  const [wrongOnly, setWrongOnly] = useState(false);
  const [lowAccuracyOnly, setLowAccuracyOnly] = useState(false);
  const [lowAccuracyThreshold, setLowAccuracyThreshold] = useState(50);
  const [randomLimitOnly, setRandomLimitOnly] = useState(false);
  const [randomLimitCount, setRandomLimitCount] = useState(10);
  const [sessionQuestions, setSessionQuestions] = useState(null);
  const [quizSessionId, setQuizSessionId] = useState(null);
  // Bumped whenever we return to the setup screen, so wrongIds/lowAccuracyIds pick up
  // attempts recorded in the session that just ended even if the filters didn't change.
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const wrongIds = useMemo(
    () => new Set(computeLastSessionWrongQuestionIds(loadAttempts())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statsRefreshKey]
  );
  const lowAccuracyIds = useMemo(
    () => new Set(computeLowAccuracyQuestionIds(loadAttempts(), lowAccuracyThreshold)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lowAccuracyThreshold, statsRefreshKey]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [sessionMistakes, setSessionMistakes] = useState([]);

  // "すべて" and no-category-selected behave the same way, so unchecking "すべて"
  // to make room for "苦手問題のみ" doesn't silently narrow the pool to nothing.
  const categoryFilteredQuestions =
    selectAllCategories || selectedCategories.size === 0
      ? allQuestions
      : allQuestions.filter((q) => selectedCategories.has(q.category));

  function toggleSelectAllCategories(checked) {
    setSelectAllCategories(checked);
    if (checked) {
      setSelectedCategories(new Set());
      setWrongOnly(false);
    }
  }

  function toggleCategory(category) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setSelectAllCategories(false);
  }

  function toggleWrongOnly(checked) {
    setWrongOnly(checked);
    if (checked) setSelectAllCategories(false);
  }

  function startQuiz() {
    let pool = categoryFilteredQuestions;
    if (wrongOnly) {
      pool = pool.filter((q) => wrongIds.has(q.id));
    }
    if (lowAccuracyOnly) {
      const lowIds = new Set(computeLowAccuracyQuestionIds(loadAttempts(), lowAccuracyThreshold));
      pool = pool.filter((q) => lowIds.has(q.id));
    }
    let finalQuestions = shuffle(pool);
    if (randomLimitOnly) {
      finalQuestions = finalQuestions.slice(0, randomLimitCount);
    }
    setSessionQuestions(finalQuestions);
    setQuizSessionId(crypto.randomUUID());
    setCurrentIndex(0);
    setUserAnswer("");
    setSubmitted(false);
    setSessionCorrectCount(0);
    setSessionMistakes([]);
  }

  function submitAnswer() {
    if (submitted) return;
    const current = sessionQuestions[currentIndex];
    const result = checkSteps(userAnswer, current.steps);
    setLastResult(result);
    setSubmitted(true);
    if (result.correct) {
      setSessionCorrectCount((c) => c + 1);
    } else {
      setSessionMistakes((m) => [...m, current]);
    }
    recordAttempt({
      questionId: current.id,
      category: current.category,
      correct: result.correct,
      userAnswer,
      sessionId: quizSessionId,
    });
  }

  function handleSubmitAnswer(e) {
    e.preventDefault();
    submitAnswer();
  }

  function handleTextareaKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submitAnswer();
    }
  }

  function handleNext() {
    setCurrentIndex((i) => i + 1);
    setUserAnswer("");
    setSubmitted(false);
    setLastResult(null);
  }

  function handleRestart() {
    setSessionQuestions(null);
    setStatsRefreshKey((k) => k + 1);
  }

  if (allQuestions.length === 0) {
    return (
      <div>
        <h1>出題</h1>
        <div className="empty-state">
          まだ問題が登録されていません。「問題管理」から問題を追加してください。
        </div>
      </div>
    );
  }

  if (!sessionQuestions) {
    return (
      <div>
        <h1>出題</h1>
        <div className="card">
          <div className="field">
            <label>カテゴリを選択</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectAllCategories}
                  onChange={(e) => toggleSelectAllCategories(e.target.checked)}
                />
                すべて（{allQuestions.length}問）
              </label>
              {categories.map((c) => (
                <label className="checkbox-label" key={c}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(c)}
                    onChange={() => toggleCategory(c)}
                  />
                  {c}（{allQuestions.filter((q) => q.category === c).length}問）
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={wrongOnly}
                onChange={(e) => toggleWrongOnly(e.target.checked)}
              />
              苦手問題のみ（前回間違えた問題、
              {categoryFilteredQuestions.filter((q) => wrongIds.has(q.id)).length}
              問）
            </label>
          </div>
          <div className="field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={lowAccuracyOnly}
                onChange={(e) => setLowAccuracyOnly(e.target.checked)}
              />
              正解率が低い問題のみ（
              <input
                type="number"
                min={1}
                max={99}
                value={lowAccuracyThreshold}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setLowAccuracyThreshold(Number(e.target.value))}
                className="threshold-input"
              />
              %未満、
              {categoryFilteredQuestions.filter((q) => lowAccuracyIds.has(q.id)).length}
              問）
            </label>
          </div>
          <div className="field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={randomLimitOnly}
                onChange={(e) => setRandomLimitOnly(e.target.checked)}
              />
              ランダム
              <input
                type="number"
                min={1}
                max={999}
                value={randomLimitCount}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRandomLimitCount(Number(e.target.value))}
                className="threshold-input"
              />
              問だけ出題
            </label>
          </div>
          <button className="btn btn-primary" onClick={startQuiz}>
            出題を開始
          </button>
        </div>
      </div>
    );
  }

  if (sessionQuestions.length === 0) {
    return (
      <div>
        <h1>出題</h1>
        <div className="empty-state">
          対象の問題がありません。
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={handleRestart}>
              カテゴリ選択に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFinished = currentIndex >= sessionQuestions.length;

  if (isFinished) {
    const total = sessionQuestions.length;
    const accuracy = Math.round((sessionCorrectCount / total) * 100);
    return (
      <div>
        <h1>出題結果</h1>
        <div className="card">
          <div className="stat-grid">
            <div className="stat-tile">
              <div className="value">{sessionCorrectCount} / {total}</div>
              <div className="label">正解数</div>
            </div>
            <div className="stat-tile">
              <div className="value">{accuracy}%</div>
              <div className="label">正答率</div>
            </div>
          </div>
          <div className="question-actions">
            <button className="btn btn-primary" onClick={handleRestart}>
              もう一度出題する
            </button>
          </div>
        </div>

        {sessionMistakes.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>間違えた問題（{sessionMistakes.length}件）</h3>
            {sessionMistakes.map((q, i) => (
              <div className="question-list-item" key={`${q.id}-${i}`}>
                <span className="tag">{q.category}</span>
                <span className={`tag ${importanceClassName(q.importance)}`}>重要度: {q.importance}</span>
                <QuestionText text={q.question} className="question-preview" />
                <div className="muted mono" style={{ marginTop: 4 }}>
                  正解: {q.steps.map((s) => s.answers.join(" / ")).join(" → ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const current = sessionQuestions[currentIndex];
  const isMultiStep = current.steps.length > 1;

  return (
    <div>
      <h1>出題</h1>
      <div className="muted" style={{ marginBottom: 12 }}>
        問題 {currentIndex + 1} / {sessionQuestions.length}
      </div>
      <div className="progress-bar-track" style={{ marginBottom: 20 }}>
        <div
          className="progress-bar-fill"
          style={{ width: `${(currentIndex / sessionQuestions.length) * 100}%` }}
        />
      </div>

      <div className="card">
        <span className="tag">{current.category}</span>
        <span className={`tag ${importanceClassName(current.importance)}`}>
          重要度: {current.importance}
        </span>
        <QuestionText text={current.question} className="quiz-question" />

        <form onSubmit={handleSubmitAnswer}>
          <div className="field">
            <label htmlFor="answer">
              {isMultiStep
                ? "回答を入力（1行に1コマンドずつ、モード移動の順番どおりに入力）"
                : "回答を入力"}
            </label>
            <textarea
              id="answer"
              className="mono"
              rows={isMultiStep ? Math.min(current.steps.length, 8) : 1}
              autoFocus
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              disabled={submitted}
            />
          </div>
          {!submitted && (
            <button type="submit" className="btn btn-primary">
              回答する
            </button>
          )}
        </form>

        {submitted && (
          <>
            <div className={`feedback ${lastResult.correct ? "correct" : "wrong"}`}>
              {lastResult.correct ? "正解です！" : "不正解です。"}
            </div>

            <div className="step-feedback">
              {lastResult.stepResults.map((r) => (
                <div className="step-feedback-row" key={r.index}>
                  <span className={`history-mark ${r.correct ? "correct" : "wrong"}`}>
                    {r.correct ? "⚪︎" : "×"}
                  </span>
                  <span className="step-feedback-text">{r.userLine || "(未入力)"}</span>
                  <span className="muted">→ 正解: {r.expected.join(" / ")}</span>
                </div>
              ))}
              {lastResult.userLines.length > current.steps.length && (
                <div className="muted" style={{ marginTop: 4 }}>
                  ※ 想定より多い行数が入力されています
                </div>
              )}
            </div>

            {current.explanation && (
              <div className="muted" style={{ marginTop: 10 }}>
                {current.explanation}
              </div>
            )}

            <div className="question-actions">
              <button className="btn btn-primary" onClick={handleNext}>
                {currentIndex + 1 === sessionQuestions.length ? "結果を見る" : "次の問題へ"}
              </button>
              <button
                className="btn"
                onClick={() => window.open(`/admin?edit=${current.id}`, "_blank", "noopener")}
              >
                この問題を編集（別タブで開く）
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
