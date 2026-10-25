import { useState } from "react";

export default function ScenarioPanel({ scenario, results, cleared, onCheck, onReset }) {
  const [hintCount, setHintCount] = useState(0);
  const allPass = results && results.every((r) => r.pass);

  return (
    <div className="card">
      <div className="nl-device-head">
        <h3 style={{ marginBottom: 8 }}>{scenario.title}</h3>
        {cleared && <span className="tag nl-cleared">クリア済み</span>}
      </div>
      {scenario.description.map((p, i) => (
        <p key={i} className="nl-desc">
          {p}
        </p>
      ))}

      {scenario.checks.length > 0 && (
        <>
          <h4>達成条件</h4>
          <ul className="nl-checks">
            {scenario.checks.map((c, i) => {
              const r = results?.[i];
              return (
                <li key={i} className={r ? (r.pass ? "pass" : "fail") : ""}>
                  <span>{r ? (r.pass ? "✔" : "✕") : "○"}</span> {c.label}
                </li>
              );
            })}
          </ul>
          {allPass && <div className="feedback correct">すべての条件を達成しました！</div>}
          {results && !allPass && <div className="feedback wrong">まだ通信できない箇所があります。</div>}
        </>
      )}

      <div className="question-actions" style={{ marginTop: 12 }}>
        {scenario.checks.length > 0 && (
          <button className="btn btn-primary" onClick={onCheck}>
            判定する
          </button>
        )}
        {scenario.hints.length > 0 && (
          <button className="btn" disabled={hintCount >= scenario.hints.length} onClick={() => setHintCount(hintCount + 1)}>
            ヒント ({hintCount}/{scenario.hints.length})
          </button>
        )}
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm("構成を初期状態に戻します。よろしいですか？")) {
              setHintCount(0);
              onReset();
            }
          }}
        >
          リセット
        </button>
      </div>

      {hintCount > 0 && (
        <ol className="nl-hints">
          {scenario.hints.slice(0, hintCount).map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
