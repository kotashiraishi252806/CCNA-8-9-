import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getCategories,
  IMPORTANCE_LEVELS,
  checkSteps,
} from "../utils/storage.js";
import { importanceClassName } from "../utils/importance.js";
import QuestionText from "../components/QuestionText.jsx";

const emptyForm = {
  category: "",
  question: "",
  steps: [{ answers: [""] }],
  importance: "中",
  explanation: "",
};

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("すべて");
  const [practiceId, setPracticeId] = useState(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceResult, setPracticeResult] = useState(null);

  useEffect(() => {
    setQuestions(loadQuestions());
  }, []);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    const target = loadQuestions().find((q) => q.id === editId);
    if (target) handleEdit(target);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const categories = useMemo(() => getCategories(), [questions]);

  const visibleQuestions = useMemo(() => {
    if (filterCategory === "すべて") return questions;
    return questions.filter((q) => q.category === filterCategory);
  }, [questions, filterCategory]);

  function updateStepAnswer(stepIndex, answerIndex, value) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, si) =>
        si !== stepIndex
          ? s
          : { answers: s.answers.map((a, ai) => (ai === answerIndex ? value : a)) }
      ),
    }));
  }

  function addAnswerToStep(stepIndex) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, si) => (si !== stepIndex ? s : { answers: [...s.answers, ""] })),
    }));
  }

  function removeAnswerFromStep(stepIndex, answerIndex) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, si) =>
        si !== stepIndex ? s : { answers: s.answers.filter((_, ai) => ai !== answerIndex) }
      ),
    }));
  }

  function addStep() {
    setForm((f) => ({ ...f, steps: [...f.steps, { answers: [""] }] }));
  }

  function removeStep(stepIndex) {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, si) => si !== stepIndex) }));
  }

  function moveStep(stepIndex, direction) {
    setForm((f) => {
      const target = stepIndex + direction;
      if (target < 0 || target >= f.steps.length) return f;
      const steps = [...f.steps];
      [steps[stepIndex], steps[target]] = [steps[target], steps[stepIndex]];
      return { ...f, steps };
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const category = form.category.trim();
    const question = form.question.trim();
    const explanation = form.explanation.trim();
    const steps = form.steps
      .map((s) => ({ answers: s.answers.map((a) => a.trim()).filter(Boolean) }))
      .filter((s) => s.answers.length > 0);

    if (!category || !question || steps.length === 0) {
      alert("カテゴリ、問題文、各ステップの正解を少なくとも1つ入力してください。");
      return;
    }

    const payload = { category, question, steps, importance: form.importance, explanation };

    if (editingId) {
      updateQuestion(editingId, payload);
    } else {
      addQuestion(payload);
    }

    setQuestions(loadQuestions());
    resetForm();
  }

  function handleEdit(q) {
    // Keep the in-progress practice answer if we're editing the same question
    // the user was answering; only clear it when switching to a different one.
    if (practiceId !== q.id) closePractice();
    setEditingId(q.id);
    const steps = q.steps && q.steps.length ? q.steps : [{ answers: [""] }];
    setForm({
      category: q.category,
      question: q.question,
      steps: steps.map((s) => ({ answers: s.answers.length ? s.answers : [""] })),
      importance: q.importance || "中",
      explanation: q.explanation || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDelete(id) {
    if (!confirm("この問題を削除しますか？")) return;
    deleteQuestion(id);
    setQuestions(loadQuestions());
    if (editingId === id) resetForm();
    if (practiceId === id) closePractice();
  }

  function openPractice(q) {
    setPracticeId(q.id);
    setPracticeAnswer("");
    setPracticeResult(null);
  }

  function closePractice() {
    setPracticeId(null);
    setPracticeAnswer("");
    setPracticeResult(null);
  }

  function submitPractice(q) {
    if (!practiceAnswer.trim()) return;
    setPracticeResult(checkSteps(practiceAnswer, q.steps));
  }

  function retryPractice() {
    setPracticeAnswer("");
    setPracticeResult(null);
  }

  return (
    <div>
      <h1>問題管理</h1>
      <p className="muted">
        CCNAの問題をカテゴリ別に登録・編集・削除できます。モード移動をともなう複数コマンドの設定問題は「ステップ」を追加して順番どおりに登録してください。
      </p>

      <form className="card" onSubmit={handleSubmit}>
        <h3>{editingId ? "問題を編集" : "新しい問題を追加"}</h3>

        <div className="field">
          <label htmlFor="category">カテゴリ</label>
          <input
            id="category"
            type="text"
            list="category-options"
            placeholder="例: ルーティング"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor="question">
            問題文（行頭 <code>#</code> で見出し、<code>##</code> で要件・条件の見出し、
            <code>・</code> や <code>- </code> で箇条書きになります）
          </label>
          <textarea
            id="question"
            rows={6}
            placeholder={
              "例:\n# 拡張名前付きACL(EXTEST)の作成および適用\n## 要件\n・PC01(192.168.0.11)からWebサーバ(172.16.0.11)へのポート80を拒否する\n・それ以外の送信元から全ての宛先へのアクセスを許可する"
            }
            value={form.question}
            onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          />
        </div>

        <div className="field">
          <label htmlFor="importance">重要度</label>
          <select
            id="importance"
            value={form.importance}
            onChange={(e) => setForm((f) => ({ ...f, importance: e.target.value }))}
            style={{ maxWidth: 160 }}
          >
            {IMPORTANCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>
            正解コマンド（1ステップ=1コマンド。複数コマンドが必要な問題は「ステップを追加」で順番に登録）
          </label>
          {form.steps.map((step, si) => (
            <div className="step-block" key={si}>
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <span className="muted">ステップ {si + 1}</span>
                <div className="question-actions" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => moveStep(si, -1)}
                    disabled={si === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => moveStep(si, 1)}
                    disabled={si === form.steps.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => removeStep(si)}
                    disabled={form.steps.length === 1}
                  >
                    ステップ削除
                  </button>
                </div>
              </div>

              {step.answers.map((a, ai) => (
                <div className="row" key={ai} style={{ marginTop: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    className="mono"
                    placeholder={si === 0 ? "例: configure terminal" : "例: interface gigabitEthernet 0/1"}
                    value={a}
                    onChange={(e) => updateStepAnswer(si, ai, e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ flex: "0 0 auto" }}
                    onClick={() => removeAnswerFromStep(si, ai)}
                    disabled={step.answers.length === 1}
                  >
                    削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => addAnswerToStep(si)}
              >
                + このステップの別解を追加
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={addStep}>
            + ステップを追加（複数コマンドの問題にする）
          </button>
        </div>

        <div className="field">
          <label htmlFor="explanation">解説（任意）</label>
          <textarea
            id="explanation"
            rows={2}
            placeholder="正誤確認時に表示される補足説明"
            value={form.explanation}
            onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
          />
        </div>

        <div className="question-actions">
          <button type="submit" className="btn btn-primary">
            {editingId ? "更新する" : "追加する"}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={resetForm}>
              キャンセル
            </button>
          )}
        </div>
      </form>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>登録済み問題（{visibleQuestions.length}件）</h3>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="すべて">すべてのカテゴリ</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {visibleQuestions.length === 0 ? (
          <div className="empty-state">まだ問題が登録されていません。</div>
        ) : (
          visibleQuestions.map((q) => (
            <div className="question-list-item" key={q.id}>
              <span className="tag">{q.category}</span>
              <span className={`tag ${importanceClassName(q.importance)}`}>重要度: {q.importance}</span>
              {q.steps.length > 1 && <span className="tag tag-steps">{q.steps.length}ステップ</span>}
              <QuestionText text={q.question} className="question-preview" />
              {(practiceId !== q.id || practiceResult) && (
                <div className="muted mono" style={{ marginTop: 4 }}>
                  正解: {q.steps.map((s) => s.answers.join(" / ")).join(" → ")}
                </div>
              )}
              {q.explanation && (practiceId !== q.id || practiceResult) && (
                <div className="muted" style={{ marginTop: 4 }}>
                  解説: {q.explanation}
                </div>
              )}
              <div className="tab-bar">
                <button
                  type="button"
                  className={`tab-btn ${practiceId === q.id ? "active" : ""}`}
                  onClick={() => (practiceId === q.id ? closePractice() : openPractice(q))}
                >
                  回答
                </button>
                <button
                  type="button"
                  className={`tab-btn ${editingId === q.id ? "active" : ""}`}
                  onClick={() => handleEdit(q)}
                >
                  編集
                </button>
                <button
                  type="button"
                  className="tab-btn tab-btn-danger"
                  onClick={() => handleDelete(q.id)}
                >
                  削除
                </button>
              </div>

              {practiceId === q.id && (
                <div className="practice-panel">
                  <div className="field">
                    <label htmlFor={`practice-${q.id}`}>
                      {q.steps.length > 1 ? "回答を入力（1行に1コマンドずつ）" : "回答を入力"}
                    </label>
                    <textarea
                      id={`practice-${q.id}`}
                      className="mono"
                      rows={q.steps.length > 1 ? Math.min(q.steps.length, 6) : 1}
                      autoFocus
                      value={practiceAnswer}
                      onChange={(e) => setPracticeAnswer(e.target.value)}
                      disabled={!!practiceResult}
                    />
                  </div>
                  {!practiceResult ? (
                    <button type="button" className="btn btn-primary" onClick={() => submitPractice(q)}>
                      確認する
                    </button>
                  ) : (
                    <>
                      <div className={`feedback ${practiceResult.correct ? "correct" : "wrong"}`}>
                        {practiceResult.correct ? "正解です！" : "不正解です。"}
                      </div>
                      <div className="step-feedback">
                        {practiceResult.stepResults.map((r) => (
                          <div className="step-feedback-row" key={r.index}>
                            <span className={`history-mark ${r.correct ? "correct" : "wrong"}`}>
                              {r.correct ? "⚪︎" : "×"}
                            </span>
                            <span className="step-feedback-text">{r.userLine || "(未入力)"}</span>
                            <span className="muted">→ 正解: {r.expected.join(" / ")}</span>
                          </div>
                        ))}
                      </div>
                      <div className="question-actions">
                        <button type="button" className="btn" onClick={retryPractice}>
                          もう一度
                        </button>
                      </div>
                    </>
                  )}
                  <div className="muted" style={{ marginTop: 8 }}>
                    ※ この回答は記録されません（一時的な確認用です）
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
