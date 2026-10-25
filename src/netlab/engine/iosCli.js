import { getDevice, portsOf } from "./topology.js";
import { isPortShutdown } from "./sim.js";

// Cisco IOS-style CLI (Phase 1: L2 switch). Commands are declared in COMMANDS with the
// modes they are valid in; resolve() does IOS-like prefix matching on each token.
//
// A command handler returns { lines?, session?, update?, invalidAt? }:
//   session   merged into the CLI session ({ mode, iface })
//   update    patch applied to the device (name / ports)
//   invalidAt token index to flag with the "% Invalid input" caret

export function createSession() {
  return { mode: "user", iface: null };
}

const SUFFIX = { user: ">", priv: "#", config: "(config)#", "config-if": "(config-if)#" };

export function promptOf(device, session) {
  return `${device.name}${SUFFIX[session.mode]}`;
}

const LONG = { Fa: "FastEthernet", Gi: "GigabitEthernet" };
const longName = (port) => port.replace(/^(Fa|Gi)/, (m) => LONG[m]);

function resolveIface(device, text) {
  const m = /^([a-z]+)(\d+\/\d+)$/i.exec(text.replace(/\s+/g, ""));
  if (!m) return null;
  const kind = m[1].toLowerCase();
  let prefix = null;
  if ("fastethernet".startsWith(kind)) prefix = "Fa";
  else if ("gigabitethernet".startsWith(kind)) prefix = "Gi";
  const port = prefix && prefix + m[2];
  return port && portsOf(device).includes(port) ? port : null;
}

function patchPort(device, port, patch) {
  const ports = { ...device.ports };
  const next = { ...ports[port], ...patch };
  for (const k of Object.keys(next)) if (!next[k]) delete next[k];
  if (Object.keys(next).length) ports[port] = next;
  else delete ports[port];
  return { ports };
}

function farEndUp(sim, device, port) {
  const link = sim.topology.links.find(
    (l) => (l.a.dev === device.id && l.a.port === port) || (l.b.dev === device.id && l.b.port === port),
  );
  if (!link) return false;
  const far = link.a.dev === device.id && link.a.port === port ? link.b : link.a;
  return !isPortShutdown(getDevice(sim.topology, far.dev), far.port);
}

function portStatus(sim, device, port) {
  if (isPortShutdown(device, port)) return "disabled";
  return sim.peer.has(`${device.id}|${port}`) ? "connected" : "notconnect";
}

// --- show output ---

function runningConfig(device) {
  const out = ["Building configuration...", "", "Current configuration : 1024 bytes", "!", "version 15.0", "!", `hostname ${device.name}`, "!"];
  for (const p of portsOf(device)) {
    const cfg = device.ports?.[p] || {};
    out.push(`interface ${longName(p)}`);
    if (cfg.description) out.push(` description ${cfg.description}`);
    if (cfg.shutdown) out.push(" shutdown");
    out.push("!");
  }
  out.push("end");
  return out;
}

function macTable(sim, device) {
  const rows = Object.entries(sim.state[device.id].macTable);
  return [
    "          Mac Address Table",
    "-------------------------------------------",
    "",
    "Vlan    Mac Address       Type        Ports",
    "----    -----------       --------    -----",
    ...rows.map(([mac, port]) => `   1    ${mac}    DYNAMIC     ${port}`),
    `Total Mac Addresses for this criterion: ${rows.length}`,
  ];
}

function interfacesStatus(sim, device) {
  return [
    "Port      Name               Status       Vlan       Duplex  Speed  Type",
    ...portsOf(device).map((p) => {
      const status = portStatus(sim, device, p);
      const name = (device.ports?.[p]?.description || "").slice(0, 18);
      const speed = p.startsWith("Gi") ? "a-1000" : "a-100";
      const type = p.startsWith("Gi") ? "10/100/1000BaseTX" : "10/100BaseTX";
      const duplex = status === "connected" ? "a-full" : "auto";
      return `${p.padEnd(10)}${name.padEnd(19)}${status.padEnd(13)}${"1".padEnd(11)}${duplex.padEnd(8)}${speed.padEnd(7)}${type}`;
    }),
  ];
}

function ipInterfaceBrief(sim, device) {
  return [
    "Interface              IP-Address      OK? Method Status                Protocol",
    ...portsOf(device).map((p) => {
      const status = portStatus(sim, device, p);
      const [st, proto] =
        status === "disabled" ? ["administratively down", "down"] : status === "connected" ? ["up", "up"] : ["down", "down"];
      return `${longName(p).padEnd(23)}${"unassigned".padEnd(16)}YES unset  ${st.padEnd(22)}${proto}`;
    }),
  ];
}

// --- Command table ---

const EXEC = ["user", "priv"];
const KEYWORD_HELP = {
  show: "Show running system information",
  mac: "MAC configuration",
  "address-table": "MAC forwarding table",
  interfaces: "Interface status and configuration",
  ip: "IP information",
  interface: "Select an interface to configure",
  clear: "Reset functions",
  configure: "Enter configuration mode",
  copy: "Copy from one file to another",
  "running-config": "Current operating configuration",
  write: "Write running configuration to memory",
  no: "Negate a command or set its defaults",
};

const COMMANDS = [];
function cmd(t, modes, help, run) {
  COMMANDS.push({ t, modes, help, run });
}

cmd(["enable"], ["user"], "Turn on privileged commands", () => ({ session: { mode: "priv" } }));
cmd(["disable"], ["priv"], "Turn off privileged commands", () => ({ session: { mode: "user" } }));
cmd(["exit"], EXEC, "Exit from the EXEC", () => ({ session: { mode: "user" } }));
cmd(["exit"], ["config"], "Exit from configure mode", () => ({ session: { mode: "priv" } }));
cmd(["exit"], ["config-if"], "Exit from interface configuration mode", () => ({ session: { mode: "config", iface: null } }));
cmd(["end"], ["config", "config-if"], "Exit from configure mode", () => ({ session: { mode: "priv", iface: null } }));
cmd(["configure", "terminal"], ["priv"], "Configure from the terminal", () => ({
  lines: ["Enter configuration commands, one per line.  End with CNTL/Z."],
  session: { mode: "config" },
}));

cmd(["show", "running-config"], ["priv"], "Current operating configuration", ({ device }) => ({ lines: runningConfig(device) }));
cmd(["show", "mac", "address-table"], EXEC, "MAC forwarding table", ({ sim, device }) => ({ lines: macTable(sim, device) }));
cmd(["show", "mac", "address-table", "dynamic"], EXEC, "dynamic entries only", ({ sim, device }) => ({ lines: macTable(sim, device) }));
cmd(["show", "mac-address-table"], EXEC, "MAC forwarding table", ({ sim, device }) => ({ lines: macTable(sim, device) }));
cmd(["show", "interfaces", "status"], EXEC, "Display interface status", ({ sim, device }) => ({ lines: interfacesStatus(sim, device) }));
cmd(["show", "ip", "interface", "brief"], EXEC, "Brief summary of IP status and configuration", ({ sim, device }) => ({
  lines: ipInterfaceBrief(sim, device),
}));
cmd(["clear", "mac", "address-table", "dynamic"], ["priv"], "Clear dynamic MAC entries", ({ sim, device }) => {
  sim.state[device.id].macTable = {};
  return {};
});
cmd(["write", "memory"], ["priv"], "Write to NV memory", () => ({ lines: ["Building configuration...", "[OK]"] }));
cmd(["write"], ["priv"], "Write to NV memory", () => ({ lines: ["Building configuration...", "[OK]"] }));
cmd(["copy", "running-config", "startup-config"], ["priv"], "Copy to startup-config", () => ({
  lines: ["Destination filename [startup-config]?", "Building configuration...", "[OK]"],
}));

cmd(["hostname", "<name>"], ["config"], "Set system's network name", ({ args }) =>
  /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(args[0]) ? { update: { name: args[0] } } : { invalidAt: 1 },
);
function enterInterface({ device, args }) {
  const port = resolveIface(device, args.join(""));
  return port ? { session: { mode: "config-if", iface: port } } : { invalidAt: 1 };
}
cmd(["interface", "<name...>"], ["config", "config-if"], "Select an interface to configure", enterInterface);

cmd(["shutdown"], ["config-if"], "Shutdown the selected interface", ({ sim, device, session }) => {
  const port = session.iface;
  const wasUp = sim.peer.has(`${device.id}|${port}`);
  const lines = [`%LINK-5-CHANGED: Interface ${longName(port)}, changed state to administratively down`];
  if (wasUp) lines.push(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longName(port)}, changed state to down`);
  return { lines, update: patchPort(device, port, { shutdown: true }) };
});
cmd(["no", "shutdown"], ["config-if"], "Enable the selected interface", ({ sim, device, session }) => {
  const port = session.iface;
  const lines = [];
  if (isPortShutdown(device, port) && farEndUp(sim, device, port)) {
    lines.push(
      `%LINK-5-CHANGED: Interface ${longName(port)}, changed state to up`,
      `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longName(port)}, changed state to up`,
    );
  }
  return { lines, update: patchPort(device, port, { shutdown: false }) };
});
cmd(["description", "<text...>"], ["config-if"], "Interface specific description", ({ device, session, args }) => ({
  update: patchPort(device, session.iface, { description: args.join(" ") }),
}));
cmd(["no", "description"], ["config-if"], "Remove the interface description", ({ device, session }) => ({
  update: patchPort(device, session.iface, { description: "" }),
}));

cmd(["do", "<command...>"], ["config", "config-if"], "To run exec commands in config mode", (cx) => {
  const inner = execIos(cx.sim, cx.device, { ...cx.session, mode: "priv" }, cx.args.join(" "));
  return { lines: inner.lines };
});

// --- Resolver ---

const isParam = (t) => t.startsWith("<");
const isRest = (t) => t.endsWith("...>");
const tplAt = (c, i) => (i < c.t.length ? c.t[i] : isRest(c.t[c.t.length - 1]) ? c.t[c.t.length - 1] : undefined);

// Consume `tokens` against the commands. Returns { alive } or { error, at }.
function consume(cmds, tokens) {
  let alive = cmds;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i].toLowerCase();
    const cands = alive.filter((c) => tplAt(c, i) !== undefined);
    const exact = cands.filter((c) => tplAt(c, i) === tok);
    const matched = exact.length
      ? exact
      : cands.filter((c) => isParam(tplAt(c, i)) || tplAt(c, i).startsWith(tok));
    if (!matched.length) return { error: "invalid", at: i };
    const kws = new Set(matched.filter((c) => !isParam(tplAt(c, i))).map((c) => tplAt(c, i)));
    const hasParam = matched.some((c) => isParam(tplAt(c, i)));
    if (kws.size > 1 && !hasParam) return { error: "ambiguous", at: i };
    alive = matched;
  }
  return { alive };
}

const isComplete = (c, n) => c.t.length === n || (isRest(c.t[c.t.length - 1]) && n >= c.t.length);

function offsetsOf(line) {
  const offsets = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line))) offsets.push(m.index);
  return offsets;
}

function caret(promptLen, offset) {
  return [`${" ".repeat(promptLen + offset)}^`, "% Invalid input detected at '^' marker.", ""];
}

export function execIos(sim, device, session, line) {
  const body = line.trim();
  if (!body) return { lines: [] };
  const promptLen = promptOf(device, session).length;
  const cmds = COMMANDS.filter((c) => c.modes.includes(session.mode));

  if (body.endsWith("?")) return { lines: helpLines(cmds, line.trimStart().slice(0, -1)) };

  const tokens = body.split(/\s+/);
  const offsets = offsetsOf(line);
  const r = consume(cmds, tokens);
  if (r.error === "invalid") {
    if (r.at === 0 && EXEC.includes(session.mode)) {
      return { lines: [`Translating "${tokens[0]}"`, "", "% Unknown command or computer name, or unable to find computer address"] };
    }
    return { lines: caret(promptLen, offsets[r.at]) };
  }
  if (r.error === "ambiguous") {
    return { lines: [`% Ambiguous command:  "${tokens.slice(0, r.at + 1).join(" ")}"`] };
  }
  const found = r.alive.find((c) => isComplete(c, tokens.length));
  if (!found) return { lines: ["% Incomplete command."] };

  const args = [];
  found.t.forEach((t, i) => {
    if (!isParam(t)) return;
    if (isRest(t)) args.push(...tokens.slice(i));
    else args.push(tokens[i]);
  });
  const res = found.run({ sim, device, session, args });
  if (res.invalidAt !== undefined) return { lines: caret(promptLen, offsets[res.invalidAt]) };
  return { lines: res.lines || [], session: res.session && { ...session, ...res.session }, update: res.update };
}

// --- Help (?) ---

function helpLines(cmds, text) {
  const endsWithSpace = /\s$/.test(text) || text === "";
  const tokens = text.trim() ? text.trim().split(/\s+/) : [];
  const done = endsWithSpace ? tokens : tokens.slice(0, -1);
  const partial = endsWithSpace ? "" : tokens[tokens.length - 1].toLowerCase();
  const r = consume(cmds, done);
  if (r.error) return ["% Unrecognized command"];
  const i = done.length;
  const rows = new Map();
  let cr = false;
  for (const c of r.alive) {
    if (isComplete(c, i)) cr = true;
    const t = tplAt(c, i);
    if (t === undefined || (i >= c.t.length && isComplete(c, i))) continue;
    if (isParam(t)) {
      if (!partial) rows.set(t.replace(/\.\.\./, ""), c.help);
    } else if (t.startsWith(partial)) {
      rows.set(t, c.t.length === i + 1 ? c.help : KEYWORD_HELP[t] || c.help);
    }
  }
  if (!endsWithSpace) return [[...rows.keys()].join("  ") || "% Unrecognized command"];
  const out = [...rows].map(([k, v]) => `  ${k.padEnd(18)}${v}`);
  if (cr) out.push("  <cr>");
  return out;
}

// --- Tab completion ---

export function completeIos(device, session, line) {
  if (/\s$/.test(line) || !line.trim()) return line;
  const cmds = COMMANDS.filter((c) => c.modes.includes(session.mode));
  const tokens = line.trim().split(/\s+/);
  const r = consume(cmds, tokens.slice(0, -1));
  if (r.error) return line;
  const i = tokens.length - 1;
  const partial = tokens[i].toLowerCase();
  const kws = new Set(
    r.alive.map((c) => tplAt(c, i)).filter((t) => t && !isParam(t) && t.startsWith(partial)),
  );
  if (kws.size !== 1) return line;
  return `${tokens.slice(0, -1).concat([...kws][0]).join(" ")} `;
}
