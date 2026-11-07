// A question's answer history as a row of marks, oldest to newest, with the
// mistake count. `limit` keeps only the most recent marks; the count still
// covers the whole history.
export default function AnswerHistoryMarks({ history, limit }) {
  if (history.length === 0) {
    return <span className="muted">未回答</span>;
  }
  const shown = limit ? history.slice(-limit) : history;
  const wrongCount = history.filter((a) => !a.correct).length;
  return (
    <div className="answer-history">
      <div className="answer-history-marks">
        {shown.length < history.length && <span className="muted">…</span>}
        {shown.map((a) => (
          <span
            className={`history-mark ${a.correct ? "correct" : "wrong"}`}
            key={a.id}
            title={new Date(a.answeredAt).toLocaleString("ja-JP")}
          >
            {a.correct ? "⚪︎" : "×"}
          </span>
        ))}
      </div>
      <span className="muted answer-history-count">
        誤答 {wrongCount} / {history.length}回
      </span>
    </div>
  );
}
