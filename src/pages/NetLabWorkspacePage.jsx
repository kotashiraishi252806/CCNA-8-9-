import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { evaluateChecks } from "../netlab/engine/check.js";
import { createSim } from "../netlab/engine/sim.js";
import { simKeyOf, updateDevice } from "../netlab/engine/topology.js";
import { getScenario } from "../netlab/scenarios/index.js";
import DevicePanel from "../netlab/components/DevicePanel.jsx";
import ScenarioPanel from "../netlab/components/ScenarioPanel.jsx";
import TopologyCanvas from "../netlab/components/TopologyCanvas.jsx";
import TraceView from "../netlab/components/TraceView.jsx";
import {
  clearNetlabTopology,
  loadNetlabProgress,
  loadNetlabTopology,
  markScenarioCleared,
  saveNetlabTopology,
} from "../utils/netlabStorage.js";

export default function NetLabWorkspacePage() {
  const { id } = useParams();
  const scenario = getScenario(id);
  if (!scenario) {
    return (
      <div className="card">
        <p>課題が見つかりません。</p>
        <Link to="/netlab" className="btn">
          課題一覧へ
        </Link>
      </div>
    );
  }
  return <Workspace key={id} scenario={scenario} />;
}

function Workspace({ scenario }) {
  const [topology, setTopology] = useState(() => loadNetlabTopology(scenario.id) || structuredClone(scenario.topology));
  const [selection, setSelection] = useState(null);
  const [termStates, setTermStates] = useState({});
  const [trace, setTrace] = useState([]);
  const [results, setResults] = useState(null);
  const [cleared, setCleared] = useState(() => Boolean(loadNetlabProgress()[scenario.id]));
  const [, setTick] = useState(0);

  // Simulation state (ARP cache, MAC tables) resets whenever the topology or a device config changes.
  const simKey = simKeyOf(topology);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sim = useMemo(() => createSim(topology), [simKey]);

  const saveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNetlabTopology(scenario.id, topology), 400);
    return () => clearTimeout(saveTimer.current);
  }, [scenario.id, topology]);

  function setTermState(deviceId, fn) {
    setTermStates((prev) => ({ ...prev, [deviceId]: fn(prev[deviceId] || { log: [] }) }));
  }

  function onUpdateDevice(deviceId, patch) {
    setTopology((t) => updateDevice(t, deviceId, patch));
  }

  function check() {
    const res = evaluateChecks(topology, scenario.checks);
    setResults(res);
    if (res.every((r) => r.pass)) {
      markScenarioCleared(scenario.id);
      setCleared(true);
    }
  }

  function reset() {
    clearNetlabTopology(scenario.id);
    setTopology(structuredClone(scenario.topology));
    setSelection(null);
    setTermStates({});
    setTrace([]);
    setResults(null);
  }

  return (
    <div>
      <Link to="/netlab" className="muted nl-back">
        ← 課題一覧
      </Link>
      <div className="nl-workspace">
        <TopologyCanvas topology={topology} onChange={setTopology} selection={selection} onSelect={setSelection} />
        <div className="nl-side">
          <ScenarioPanel scenario={scenario} results={results} cleared={cleared} onCheck={check} onReset={reset} />
          <DevicePanel
            topology={topology}
            onChange={setTopology}
            onUpdateDevice={onUpdateDevice}
            selection={selection}
            onSelect={setSelection}
            sim={sim}
            termStates={termStates}
            setTermState={setTermState}
            onTrace={setTrace}
            onAfterExec={() => setTick((t) => t + 1)}
          />
          <TraceView trace={trace} />
        </div>
      </div>
    </div>
  );
}
