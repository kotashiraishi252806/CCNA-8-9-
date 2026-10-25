import { useState } from "react";
import { macOf } from "../engine/sim.js";
import { DEVICE_TYPES, getDevice, isHost, portsOf, removeDevice, removeLink, updateDevice } from "../engine/topology.js";
import Terminal from "./Terminal.jsx";

function TableView({ sim, device, topology }) {
  const st = sim.state[device.id];
  if (isHost(device)) {
    const rows = Object.entries(st.arp);
    return (
      <div>
        <h4>ARPテーブル</h4>
        {rows.length === 0 ? (
          <p className="muted">空です。pingなどで通信するとエントリが追加されます。</p>
        ) : (
          <table className="session-table">
            <thead>
              <tr>
                <th>IPアドレス</th>
                <th>MACアドレス</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([ip, mac]) => (
                <tr key={ip}>
                  <td className="mono">{ip}</td>
                  <td className="mono">{mac}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
  const rows = Object.entries(st.macTable);
  return (
    <div>
      <h4>MACアドレステーブル</h4>
      {rows.length === 0 ? (
        <p className="muted">空です。フレームが通過するとMACアドレスを学習します。</p>
      ) : (
        <table className="session-table">
          <thead>
            <tr>
              <th>MACアドレス</th>
              <th>ポート</th>
              <th>機器</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([mac, port]) => {
              const owner = topology.devices.find((d) => isHost(d) && macOf(d) === mac);
              return (
                <tr key={mac}>
                  <td className="mono">{mac}</td>
                  <td className="mono">{port}</td>
                  <td>{owner?.name || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PortList({ sim, device, topology }) {
  return (
    <table className="session-table">
      <thead>
        <tr>
          <th>ポート</th>
          <th>接続先</th>
        </tr>
      </thead>
      <tbody>
        {portsOf(device).map((p) => {
          const far = sim.peer.get(`${device.id}|${p}`);
          const farDev = far && getDevice(topology, far.dev);
          return (
            <tr key={p}>
              <td className="mono">{p}</td>
              <td>{farDev ? `${farDev.name} (${far.port})` : <span className="muted">未接続</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function DevicePanel({ topology, onChange, onUpdateDevice, selection, onSelect, sim, termStates, setTermState, onTrace, onAfterExec }) {
  const [tab, setTab] = useState("terminal");

  if (!selection) {
    return (
      <div className="card">
        <p className="muted">機器またはケーブルを選択すると、設定やターミナルが表示されます。</p>
      </div>
    );
  }

  if (selection.kind === "link") {
    const link = topology.links.find((l) => l.id === selection.id);
    if (!link) return null;
    const a = getDevice(topology, link.a.dev);
    const b = getDevice(topology, link.b.dev);
    return (
      <div className="card">
        <h3>ケーブル</h3>
        <p>
          {a.name} <span className="mono">{link.a.port}</span> ↔ {b.name} <span className="mono">{link.b.port}</span>
        </p>
        <button
          className="btn btn-danger"
          onClick={() => {
            onChange(removeLink(topology, link.id));
            onSelect(null);
          }}
        >
          ケーブルを削除
        </button>
      </div>
    );
  }

  const device = getDevice(topology, selection.id);
  if (!device) return null;
  const host = isHost(device);
  const activeTab = host && tab === "ports" ? "terminal" : tab;
  const tabs = host
    ? [["terminal", "ターミナル"], ["tables", "テーブル"]]
    : [["terminal", "CLI"], ["tables", "テーブル"], ["ports", "ポート"]];

  return (
    <div className="card">
      <div className="nl-device-head">
        <div>
          <h3 style={{ marginBottom: 4 }}>
            {DEVICE_TYPES[device.type].icon} {device.name}
          </h3>
          <div className="muted mono" style={{ fontSize: 12 }}>
            MAC {macOf(device)}
          </div>
        </div>
        <button
          className="btn btn-danger"
          onClick={() => {
            onChange(removeDevice(topology, device.id));
            onSelect(null);
          }}
        >
          削除
        </button>
      </div>

      <div className="field">
        <label>機器名</label>
        <input
          type="text"
          value={device.name}
          onChange={(e) => onChange(updateDevice(topology, device.id, { name: e.target.value }))}
        />
      </div>

      <div className="nl-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={`nl-tab ${activeTab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "terminal" && (
        <Terminal
          key={device.id}
          sim={sim}
          device={device}
          state={termStates[device.id] || { log: [] }}
          setState={(fn) => setTermState(device.id, fn)}
          onUpdateDevice={onUpdateDevice}
          onTrace={onTrace}
          onAfterExec={onAfterExec}
        />
      )}
      {activeTab === "tables" && <TableView sim={sim} device={device} topology={topology} />}
      {activeTab === "ports" && <PortList sim={sim} device={device} topology={topology} />}
    </div>
  );
}
