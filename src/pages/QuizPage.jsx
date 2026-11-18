import { useEffect, useMemo, useState } from "react";
import {
  loadQuestions,
  loadAttempts,
  recordAttempt,
  checkSteps,
  checkTable,
  checkMatching,
  getCategories,
  loadQuizSession,
  saveQuizSession,
  clearQuizSession,
  deleteQuestion,
  loadFavoriteIds,
  toggleFavorite,
} from "../utils/storage.js";
import {
  computeLastSessionWrongQuestionIds,
  computeLowAccuracyQuestionIds,
  computeMasteredQuestionIds,
  computeQuestionHistory,
} from "../utils/stats.js";
import { importanceClassName } from "../utils/importance.js";
import { shuffle } from "../utils/shuffle.js";
import QuestionText from "../components/QuestionText.jsx";
import QuestionTable from "../components/QuestionTable.jsx";
import MatchingQuestion from "../components/MatchingQuestion.jsx";
import AnswerHistoryMarks from "../components/AnswerHistoryMarks.jsx";

// Keeps the sticky bar to a line or two; the stats page shows the full history.
const STATUS_BAR_HISTORY_LIMIT = 20;

const WEAK_MIN_ATTEMPTS = 5;
const WEAK_ACCURACY_THRESHOLD = 50;
const MASTERED_MIN_ATTEMPTS = 5;

export default function QuizPage({ weakOnly = false }) {
  const [allQuestions, setAllQuestions] = useState(() => loadQuestions());
  const [categories, setCategories] = useState(() => getCategories());

  useEffect(() => {
    // Picks up edits made in another tab (e.g. via "この問題を編集") once you
    // switch back to this tab. The session already in progress is left alone;
    // this only affects the next "出題を開始".
    function refreshQuestions() {
      setAllQuestions(loadQuestions());
      setCategories(getCategories());
      setFavoriteIds(new Set(loadFavoriteIds()));
    }
    window.addEventListener("focus", refreshQuestions);
    return () => window.removeEventListener("focus", refreshQuestions);
  }, []);

  const [selectAllCategories, setSelectAllCategories] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState(() => new Set());
  const [wrongOnly, setWrongOnly] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(loadFavoriteIds()));
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
  const weakIds = useMemo(
    () => new Set(computeLowAccuracyQuestionIds(loadAttempts(), WEAK_ACCURACY_THRESHOLD, WEAK_MIN_ATTEMPTS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statsRefreshKey]
  );
  const masteredIds = useMemo(
    () => new Set(computeMasteredQuestionIds(loadAttempts(), MASTERED_MIN_ATTEMPTS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statsRefreshKey]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [tableAnswers, setTableAnswers] = useState({});
  const [matchingAnswers, setMatchingAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [sessionMistakes, setSessionMistakes] = useState([]);
  const [savedSession, setSavedSession] = useState(() => loadQuizSession());
  // submitted flips in the same update as recordAttempt, so the new mark shows right away.
  const questionHistory = useMemo(
    () => computeQuestionHistory(loadAttempts()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionQuestions, submitted]
  );

  useEffect(() => {
    if (!sessionQuestions) return;
    if (currentIndex >= sessionQuestions.length) {
      clearQuizSession();
      return;
    }
    saveQuizSession({
      sessionId: quizSessionId,
      questionIds: sessionQuestions.map((q) => q.id),
      currentIndex,
      correctCount: sessionCorrectCount,
      mistakeIds: sessionMistakes.map((q) => q.id),
      userAnswer,
      tableAnswers,
      matchingAnswers,
      submitted,
      lastResult,
    });
  }, [sessionQuestions, quizSessionId, currentIndex, sessionCorrectCount, sessionMistakes, userAnswer, tableAnswers, matchingAnswers, submitted, lastResult]);

  function resumeSession() {
    const s = savedSession;
    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    // Questions deleted since the session was saved are skipped.
    const questions = s.questionIds.map((id) => byId.get(id)).filter(Boolean);
    const index = s.questionIds.slice(0, s.currentIndex).filter((id) => byId.has(id)).length;
    const currentStillExists = byId.has(s.questionIds[s.currentIndex]);
    setSessionQuestions(questions);
    setQuizSessionId(s.sessionId);
    setCurrentIndex(index);
    setSessionCorrectCount(s.correctCount);
    setSessionMistakes(s.mistakeIds.map((id) => byId.get(id)).filter(Boolean));
    setUserAnswer(currentStillExists ? s.userAnswer : "");
    setTableAnswers(currentStillExists ? s.tableAnswers : {});
    setMatchingAnswers(currentStillExists ? (s.matchingAnswers ?? {}) : {});
    setSubmitted(currentStillExists && s.submitted);
    setLastResult(currentStillExists ? s.lastResult : null);
    setSavedSession(null);
  }

  function discardSavedSession() {
    clearQuizSession();
    setSavedSession(null);
  }

  // "すべて" and no-category-selected behave the same way, so unchecking "すべて"
  // to make room for "苦手問題のみ" doesn't silently narrow the pool to nothing.
  const allCategoriesSelected = selectAllCategories || selectedCategories.size === 0;
  const categoryFilteredQuestions = allCategoriesSelected
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

  function toggleLowAccuracyOnly(checked) {
    setLowAccuracyOnly(checked);
  }

  function startQuiz() {
    let pool = categoryFilteredQuestions;
    // Picking a chapter or favorites is a deliberate choice, so mastered questions stay in those.
    if (allCategoriesSelected && !favoriteOnly) {
      pool = pool.filter((q) => !masteredIds.has(q.id));
    }
    if (weakOnly) {
      pool = pool.filter((q) => weakIds.has(q.id));
    }
    if (wrongOnly) {
      pool = pool.filter((q) => wrongIds.has(q.id));
    }
    if (favoriteOnly) {
      pool = pool.filter((q) => favoriteIds.has(q.id));
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
    setTableAnswers({});
    setMatchingAnswers({});
    setSubmitted(false);
    setSessionCorrectCount(0);
    setSessionMistakes([]);
    setSavedSession(null);
  }

  function submitAnswer() {
    if (submitted) return;
    const current = sessionQuestions[currentIndex];
    const result =
      current.type === "matching"
        ? checkMatching(matchingAnswers, current.matching)
        : current.type === "table"
          ? checkTable(tableAnswers, current.table)
          : checkSteps(userAnswer, current.steps);
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
      userAnswer:
        current.type === "matching"
          ? JSON.stringify(matchingAnswers)
          : current.type === "table"
            ? JSON.stringify(tableAnswers)
            : userAnswer,
      sessionId: quizSessionId,
    });
  }

  function handleToggleFavorite(id) {
    setFavoriteIds(new Set(toggleFavorite(id)));
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
    setTableAnswers({});
    setMatchingAnswers({});
    setSubmitted(false);
    setLastResult(null);
  }

  // The next question slides into currentIndex, so the index stays put. The deleted
  // question also drops out of this session's score.
  function handleDeleteCurrent() {
    if (!confirm("この問題を削除しますか？")) return;
    const current = sessionQuestions[currentIndex];
    deleteQuestion(current.id);
    setAllQuestions(loadQuestions());
    setCategories(getCategories());
    setFavoriteIds(new Set(loadFavoriteIds()));
    setSessionQuestions((questions) => questions.filter((q) => q.id !== current.id));
    if (lastResult.correct) setSessionCorrectCount((c) => c - 1);
    else setSessionMistakes((m) => m.filter((q) => q.id !== current.id));
    setUserAnswer("");
    setTableAnswers({});
    setMatchingAnswers({});
    setSubmitted(false);
    setLastResult(null);
  }

  function handleRestart() {
    clearQuizSession();
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

  const savedSessionCard = savedSession && (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        途中で終了した出題があります（問題 {savedSession.currentIndex + 1} /{" "}
        {savedSession.questionIds.length}、正解 {savedSession.correctCount}問）
      </div>
      <div className="question-actions">
        <button className="btn btn-primary" onClick={resumeSession}>
          続きから再開
        </button>
        <button className="btn" onClick={discardSavedSession}>
          破棄する
        </button>
      </div>
    </div>
  );

  if (!sessionQuestions && weakOnly) {
    const weakCount = allQuestions.filter((q) => weakIds.has(q.id)).length;
    return (
      <div>
        <h1>弱点出題</h1>
        {savedSessionCard}
        <div className="card">
          <div className="field">
            {WEAK_MIN_ATTEMPTS}回以上回答して、正答率が{WEAK_ACCURACY_THRESHOLD}%未満の問題を出題します（
            {weakCount}問）
          </div>
          <button className="btn btn-primary" onClick={startQuiz} disabled={weakCount === 0}>
            出題を開始
          </button>
        </div>
      </div>
    );
  }

  if (!sessionQuestions) {
    const masteredCount = allQuestions.filter((q) => masteredIds.has(q.id)).length;
    return (
      <div>
        <h1>出題</h1>
        {savedSessionCard}
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
                すべて（{allQuestions.length - masteredCount}問
                {masteredCount > 0 && `、${MASTERED_MIN_ATTEMPTS}回以上全問正解の${masteredCount}問を除く`}）
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
                checked={favoriteOnly}
                onChange={(e) => setFavoriteOnly(e.target.checked)}
              />
              お気に入り問題のみ（
              {categoryFilteredQuestions.filter((q) => favoriteIds.has(q.id)).length}
              問）
            </label>
          </div>
          <div className="field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={lowAccuracyOnly}
                onChange={(e) => toggleLowAccuracyOnly(e.target.checked)}
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
                {q.type === "matching" ? (
                  <MatchingQuestion matching={q.matching} mode="answers" />
                ) : q.type === "table" ? (
                  <QuestionTable table={q.table} mode="answers" />
                ) : (
                  <div className="muted mono" style={{ marginTop: 4 }}>
                    正解: {q.steps.map((s) => s.answers.join(" / ")).join(" → ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const current = sessionQuestions[currentIndex];
  const isFavorite = favoriteIds.has(current.id);

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
        <div className="question-status-bar">
          {submitted ? (
            <button
              type="button"
              className={`btn favorite-toggle ${isFavorite ? "active" : ""}`}
              aria-pressed={isFavorite}
              onClick={() => handleToggleFavorite(current.id)}
            >
              {isFavorite ? "★ お気に入り登録済み" : "☆ お気に入りに登録"}
            </button>
          ) : (
            isFavorite && <span className="favorite-label">★ お気に入り</span>
          )}
          <AnswerHistoryMarks
            history={questionHistory.get(current.id) ?? []}
            limit={STATUS_BAR_HISTORY_LIMIT}
          />
        </div>
        <span className={`tag ${importanceClassName(current.importance)}`}>
          重要度: {current.importance}
        </span>
        <QuestionText text={current.question} className="quiz-question" />

        <form onSubmit={handleSubmitAnswer}>
          {current.type === "matching" ? (
            <div className="field">
              <label>それぞれの項目に対応するものを選択</label>
              <MatchingQuestion
                key={current.id}
                randomize
                matching={current.matching}
                mode={submitted ? (lastResult?.cellResults ? "result" : "answers") : "input"}
                values={matchingAnswers}
                results={
                  lastResult?.cellResults &&
                  Object.fromEntries(lastResult.cellResults.map((r) => [r.key, r]))
                }
                onChange={(key, value) => setMatchingAnswers((v) => ({ ...v, [key]: value }))}
              />
              {submitted && lastResult?.cellResults && (
                <div className="muted" style={{ marginTop: 6 }}>
                  {lastResult.cellResults.filter((r) => r.correct).length} / {lastResult.cellResults.length} 正解
                </div>
              )}
            </div>
          ) : current.type === "table" ? (
            <div className="field">
              <label>表の空欄に回答を入力</label>
              <QuestionTable
                key={current.id}
                randomize
                table={current.table}
                mode={submitted ? (lastResult?.cellResults ? "result" : "answers") : "input"}
                values={tableAnswers}
                results={
                  lastResult?.cellResults &&
                  Object.fromEntries(lastResult.cellResults.map((r) => [r.key, r]))
                }
                onChange={(key, value) => setTableAnswers((v) => ({ ...v, [key]: value }))}
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="answer">
                回答を入力（1行に1コマンドずつ、モード移動の順番どおりに入力）
              </label>
              {/* Fixed size for every question so the box doesn't hint at the number of lines. */}
              <textarea
                id="answer"
                className="mono"
                rows={8}
                autoFocus
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                disabled={submitted}
              />
            </div>
          )}
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

            {current.type === "command" && (
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
            )}

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
              <button className="btn btn-danger" onClick={handleDeleteCurrent}>
                この問題を削除
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
