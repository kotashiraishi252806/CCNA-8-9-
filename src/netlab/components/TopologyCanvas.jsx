import { useEffect, useMemo, useState } from "react";
import { Background, Controls, Handle, Position, ReactFlow, applyNodeChanges } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DEVICE_TYPES, addLink, createDevice, freePorts, getDevice, isHost } from "../engine/topology.js";

function DeviceNode({ data }) {
  const { device, selected, cableSource } = data;
  const cls = ["nl-node", selected && "selected", cableSource && "cable-source"].filter(Boolean).join(" ");
  const ip = isHost(device) ? device.config?.ip : null;
  return (
    <div className={cls}>
      <Handle type="target" position={Position.Top} className="nl-handle" isConnectable={false} />
      <Handle type="source" position={Position.Top} className="nl-handle" isConnectable={false} />
      <div className="nl-node-icon">{DEVICE_TYPES[device.type].icon}</div>
      <div className="nl-node-name">{device.name}</div>
      {isHost(device) && <div className="nl-node-ip">{ip || "IP未設定"}</div>}
    </div>
  );
}

const nodeTypes = { device: DeviceNode };

export default function TopologyCanvas({ topology, onChange, selection, onSelect }) {
  const [tool, setTool] = useState("select");
  const [cableFrom, setCableFrom] = useState(null);
  const [pending, setPending] = useState(null); // { a, b, portA, portB }
  const [message, setMessage] = useState("");
  const [nodes, setNodes] = useState([]);

  const selectedDeviceId = selection?.kind === "device" ? selection.id : null;

  // Keep React Flow's internal node state (it stores measured sizes) in sync with the topology.
  useEffect(() => {
    setNodes((prev) =>
      topology.devices.map((d) => {
        const old = prev.find((n) => n.id === d.id);
        return {
          ...old,
          id: d.id,
          type: "device",
          position: { x: d.x, y: d.y },
          data: { device: d, selected: d.id === selectedDeviceId, cableSource: d.id === cableFrom },
        };
      }),
    );
  }, [topology.devices, selectedDeviceId, cableFrom]);

  const edges = useMemo(
    () =>
      topology.links.map((l) => ({
        id: l.id,
        source: l.a.dev,
        target: l.b.dev,
        type: "straight",
        label: `${l.a.port}  ─  ${l.b.port}`,
        labelStyle: { fontSize: 11, fill: "var(--text-muted)" },
        labelBgStyle: { fill: "var(--surface)" },
        style: {
          stroke: selection?.kind === "link" && selection.id === l.id ? "var(--accent)" : "var(--text-muted)",
          strokeWidth: 2,
        },
      })),
    [topology.links, selection],
  );

  function onNodesChange(changes) {
    setNodes((ns) => applyNodeChanges(changes, ns));
    const moves = changes.filter((c) => c.type === "position" && c.position);
    if (moves.length) {
      onChange({
        ...topology,
        devices: topology.devices.map((d) => {
          const m = moves.find((c) => c.id === d.id);
          return m ? { ...d, x: m.position.x, y: m.position.y } : d;
        }),
      });
    }
  }

  function addDevice(type) {
    const n = topology.devices.length;
    const device = createDevice(topology, type, 40 + (n % 5) * 130, 40 + Math.floor(n / 5) * 120);
    onChange({ ...topology, devices: [...topology.devices, device] });
    onSelect({ kind: "device", id: device.id });
  }

  function startPending(aId, bId) {
    const freeA = freePorts(topology, aId);
    const freeB = freePorts(topology, bId);
    if (!freeA.length || !freeB.length) {
      const full = getDevice(topology, freeA.length ? bId : aId);
      setMessage(`${full.name} に空きポートがありません。`);
      return;
    }
    setMessage("");
    setPending({ a: aId, b: bId, portA: freeA[0], portB: freeB[0] });
  }

  function onNodeClick(_, node) {
    if (tool !== "cable") {
      onSelect({ kind: "device", id: node.id });
      return;
    }
    if (!cableFrom) {
      setCableFrom(node.id);
      setMessage("接続先の機器をタップしてください。");
    } else if (cableFrom !== node.id) {
      startPending(cableFrom, node.id);
      setCableFrom(null);
    }
  }

  function confirmPending() {
    const result = addLink(topology, { dev: pending.a, port: pending.portA }, { dev: pending.b, port: pending.portB });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    onChange(result.topology);
    setPending(null);
    setMessage("");
  }

  function chooseTool(next) {
    setTool(next);
    setCableFrom(null);
    setPending(null);
    setMessage(next === "cable" ? "接続元の機器をタップしてください。" : "");
  }

  return (
    <div className="nl-canvas-wrap">
      <div className="nl-toolbar">
        <button className={`btn ${tool === "select" ? "btn-primary" : ""}`} onClick={() => chooseTool("select")}>
          選択・移動
        </button>
        <button className={`btn ${tool === "cable" ? "btn-primary" : ""}`} onClick={() => chooseTool("cable")}>
          ケーブル
        </button>
        <span className="nl-toolbar-sep" />
        {Object.entries(DEVICE_TYPES).map(([type, t]) => (
          <button key={type} className="btn" onClick={() => addDevice(type)}>
            ＋{t.icon} {t.label}
          </button>
        ))}
      </div>

      {(message || pending) && (
        <div className="nl-cable-bar">
          {pending ? (
            <>
              <span>
                {getDevice(topology, pending.a).name}
                <select value={pending.portA} onChange={(e) => setPending({ ...pending, portA: e.target.value })}>
                  {freePorts(topology, pending.a).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </span>
              <span>↔</span>
              <span>
                {getDevice(topology, pending.b).name}
                <select value={pending.portB} onChange={(e) => setPending({ ...pending, portB: e.target.value })}>
                  {freePorts(topology, pending.b).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </span>
              <button className="btn btn-primary" onClick={confirmPending}>
                接続
              </button>
              <button className="btn" onClick={() => setPending(null)}>
                キャンセル
              </button>
            </>
          ) : (
            <span>{message}</span>
          )}
        </div>
      )}

      <div className="nl-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={(_, edge) => onSelect({ kind: "link", id: edge.id })}
          onPaneClick={() => onSelect(null)}
          nodesDraggable={tool === "select"}
          deleteKeyCode={null}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          colorMode="system"
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
