import { Link } from "react-router-dom";
import { SANDBOX, SCENARIOS } from "../netlab/scenarios/index.js";
import { loadNetlabProgress } from "../utils/netlabStorage.js";

export default function NetLabPage() {
  const progress = loadNetlabProgress();
  const cleared = SCENARIOS.filter((s) => progress[s.id]).length;

  return (
    <div>
      <h1>ネットワーク構築演習</h1>
      <p className="muted">
        仮想ネットワーク上で機器を配置・接続・設定し、ホスト同士が通信できるまでを体験する課題集です。（{cleared}/{SCENARIOS.length} クリア）
      </p>

      {SCENARIOS.map((s) => (
        <div className="card" key={s.id}>
          <div className="nl-device-head">
            <h3 style={{ marginBottom: 6 }}>{s.title}</h3>
            <div>
              <span className="tag">{s.level}</span>{" "}
              {progress[s.id] && <span className="tag nl-cleared">クリア済み</span>}
            </div>
          </div>
          <p className="muted">{s.summary}</p>
          <Link to={`/netlab/${s.id}`} className="btn btn-primary">
            {progress[s.id] ? "もう一度挑戦" : "挑戦する"}
          </Link>
        </div>
      ))}

      <div className="card">
        <h3>{SANDBOX.title}</h3>
        <p className="muted">{SANDBOX.summary}</p>
        <Link to={`/netlab/${SANDBOX.id}`} className="btn">
          開く
        </Link>
      </div>
    </div>
  );
}
