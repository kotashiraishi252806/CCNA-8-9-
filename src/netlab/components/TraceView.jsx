const ICONS = { frame: "→", info: "•", drop: "✕", warn: "⚠" };

export default function TraceView({ trace }) {
  return (
    <div className="card">
      <h3>パケット追跡</h3>
      {trace.length === 0 ? (
        <p className="muted">ターミナルで ping を実行すると、最初の1回分のフレームの流れがここに表示されます。</p>
      ) : (
        <ol className="nl-trace">
          {trace.map((t, i) => (
            <li key={i} className={`nl-trace-${t.kind}`}>
              <span className="nl-trace-icon">{ICONS[t.kind]}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
