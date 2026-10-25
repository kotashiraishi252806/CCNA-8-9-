import { useEffect, useRef, useState } from "react";
import { complete, exec, newSession, promptOf } from "../engine/cli.js";

const LINE_DELAY_MS = 220;

export default function Terminal({ sim, device, state, setState, onUpdateDevice, onTrace, onAfterExec }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useRef([]);
  const historyPos = useRef(0);
  const timers = useRef([]);
  const bodyRef = useRef(null);
  const log = state.log;
  const session = state.session || newSession(device);
  const prompt = promptOf(device, session);

  const setLog = (fn) => setState((prev) => ({ ...prev, log: fn(prev.log) }));

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [log]);

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    const line = input;
    setInput("");
    if (line.trim()) {
      history.current.push(line);
      historyPos.current = history.current.length;
    }
    const echo = `${prompt}${line}`;
    const result = exec(sim, device, session, line);
    if (result.clear) {
      setLog(() => []);
      return;
    }
    if (result.session) setState((prev) => ({ ...prev, session: result.session }));
    if (result.update) onUpdateDevice(device.id, result.update);
    if (result.trace) onTrace(result.trace);
    onAfterExec();
    if (!result.animate) {
      setLog((prev) => [...prev, echo, ...result.lines]);
      return;
    }
    setLog((prev) => [...prev, echo]);
    setBusy(true);
    result.lines.forEach((l, i) => {
      timers.current.push(
        setTimeout(() => {
          setLog((prev) => [...prev, l]);
          if (i === result.lines.length - 1) setBusy(false);
        }, (i + 1) * LINE_DELAY_MS),
      );
    });
  }

  function onKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      setInput((cur) => complete(device, session, cur));
    } else if (e.key === "ArrowUp" && history.current.length) {
      e.preventDefault();
      historyPos.current = Math.max(0, historyPos.current - 1);
      setInput(history.current[historyPos.current]);
    } else if (e.key === "ArrowDown" && history.current.length) {
      e.preventDefault();
      historyPos.current = Math.min(history.current.length, historyPos.current + 1);
      setInput(history.current[historyPos.current] ?? "");
    }
  }

  return (
    <div className="nl-terminal" onClick={() => document.getElementById("nl-term-input")?.focus()}>
      <div className="nl-terminal-body" ref={bodyRef}>
        {log.length === 0 && (
          <div className="nl-terminal-hint">
            {device.type === "switch"
              ? "enable → configure terminal で設定できます。? でヘルプ、Tab で補完。"
              : "help と入力すると使えるコマンドを表示します。"}
          </div>
        )}
        {log.map((l, i) => (
          <div key={i} className="nl-terminal-line">
            {l || " "}
          </div>
        ))}
      </div>
      <form className="nl-terminal-input" onSubmit={submit}>
        <span>{prompt}</span>
        <input
          id="nl-term-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
}
