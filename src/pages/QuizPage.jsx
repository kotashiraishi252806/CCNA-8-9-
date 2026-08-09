import { useMemo, useState } from "react";
import { loadQuestions, loadAttempts, recordAttempt, checkSteps, getCategories } from "../utils/storage.js";
import { computeWrongQuestionIds } from "../utils/stats.js";

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function QuizPage() {
  const allQuestions = useMemo(() => loadQuestions(), []);
  const categories = useMemo(() => getCategories(), []);

  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [sessionQuestions, setSessionQuestions] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);

  function startQuiz() {
    let pool = allQuestions;
    if (selectedCategory === "苦手問題のみ") {
      const wrongIds = new Set(computeWrongQuestionIds(loadAttempts()));
      pool = allQuestions.filter((q) => wrongIds.has(q.id));
    } else if (selectedCategory !== "すべて") {
      pool = allQuestions.filter((q) => q.category === selectedCategory);
    }
    setSessionQuestions(shuffle(pool));
    setCurrentIndex(0);
    setUserAnswer("");
    setSubmitted(false);
    setSessionCorrectCount(0);
  }

  function submitAnswer() {
    if (submitted) return;
    const current = sessionQuestions[currentIndex];
    const result = checkSteps(userAnswer, current.steps);
    setLastResult(result);
    setSubmitted(true);
    if (result.correct) setSessionCorrectCount((c) => c + 1);
    recordAttempt({
      questionId: current.id,
      category: current.category,
      correct: result.correct,
      userAnswer,
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
            <label htmlFor="category-select">カテゴリを選択</label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="すべて">すべて（{allQuestions.length}問）</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}（{allQuestions.filter((q) => q.category === c).length}問）
                </option>
              ))}
              <option value="苦手問題のみ">苦手問題のみ（前回間違えた問題）</option>
            </select>
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
        {isMultiStep && <span className="tag tag-steps">{current.steps.length}ステップ</span>}
        <h3 style={{ marginTop: 12 }}>{current.question}</h3>

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
              placeholder={
                isMultiStep
                  ? "例:\nconfigure terminal\ninterface gigabitEthernet 0/1\n..."
                  : "コマンドや用語を入力してください"
              }
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
