// Topology data model. A topology is plain JSON:
//   devices: { id, type, name, x, y, config?, ports? }[]
//     config = { ip, mask, gateway } for hosts
//     ports  = { [port]: { shutdown?, description? } } for switches (only non-default ports)
//   links:   { id, a: { dev, port }, b: { dev, port } }[]
// Ports are derived from the device type, not stored.

export const DEVICE_TYPES = {
  pc: { label: "PC", prefix: "PC", icon: "🖥️", isHost: true, ports: ["Fa0"], ttl: 128 },
  server: { label: "サーバ", prefix: "Server", icon: "🗄️", isHost: true, ports: ["Fa0"], ttl: 64 },
  switch: {
    label: "スイッチ",
    prefix: "SW",
    icon: "🔀",
    isHost: false,
    ports: [...Array.from({ length: 8 }, (_, i) => `Fa0/${i + 1}`), "Gi0/1", "Gi0/2"],
  },
};

export function isHost(device) {
  return DEVICE_TYPES[device.type].isHost;
}

export function portsOf(device) {
  return DEVICE_TYPES[device.type].ports;
}

export function emptyTopology() {
  return { devices: [], links: [] };
}

export function nextName(topology, type) {
  const prefix = DEVICE_TYPES[type].prefix;
  const used = new Set(topology.devices.map((d) => d.name));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function createDevice(topology, type, x, y) {
  const device = {
    id: crypto.randomUUID(),
    type,
    name: nextName(topology, type),
    x,
    y,
  };
  if (DEVICE_TYPES[type].isHost) device.config = { ip: "", mask: "", gateway: "" };
  return device;
}

export function getDevice(topology, id) {
  return topology.devices.find((d) => d.id === id);
}

export function usedPorts(topology, deviceId) {
  const used = new Set();
  for (const l of topology.links) {
    if (l.a.dev === deviceId) used.add(l.a.port);
    if (l.b.dev === deviceId) used.add(l.b.port);
  }
  return used;
}

export function freePorts(topology, deviceId) {
  const device = getDevice(topology, deviceId);
  const used = usedPorts(topology, deviceId);
  return portsOf(device).filter((p) => !used.has(p));
}

// Returns { topology } on success or { error } when the cable cannot be made.
export function addLink(topology, a, b) {
  if (a.dev === b.dev) return { error: "同じ機器どうしは接続できません。" };
  if (!freePorts(topology, a.dev).includes(a.port) || !freePorts(topology, b.dev).includes(b.port)) {
    return { error: "選択したポートはすでに使用中です。" };
  }
  const link = { id: crypto.randomUUID(), a, b };
  return { topology: { ...topology, links: [...topology.links, link] } };
}

export function removeLink(topology, linkId) {
  return { ...topology, links: topology.links.filter((l) => l.id !== linkId) };
}

export function removeDevice(topology, deviceId) {
  return {
    devices: topology.devices.filter((d) => d.id !== deviceId),
    links: topology.links.filter((l) => l.a.dev !== deviceId && l.b.dev !== deviceId),
  };
}

export function updateDevice(topology, deviceId, patch) {
  return {
    ...topology,
    devices: topology.devices.map((d) => (d.id === deviceId ? { ...d, ...patch } : d)),
  };
}

// Key that changes whenever anything that affects simulation changes (positions excluded).
export function simKeyOf(topology) {
  return JSON.stringify([
    topology.devices.map(({ x: _x, y: _y, ...rest }) => rest),
    topology.links.map((l) => [l.a, l.b]),
  ]);
}
