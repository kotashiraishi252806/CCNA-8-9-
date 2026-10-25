import { NETLAB_KEY, writeItem } from "./storage.js";

// Stored shape: { progress: { [scenarioId]: { clearedAt } }, topologies: { [scenarioId]: topology } }

function load() {
  try {
    const raw = localStorage.getItem(NETLAB_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return { progress: data.progress || {}, topologies: data.topologies || {} };
  } catch {
    return { progress: {}, topologies: {} };
  }
}

function save(data) {
  writeItem(NETLAB_KEY, JSON.stringify(data));
}

export function loadNetlabProgress() {
  return load().progress;
}

export function markScenarioCleared(id) {
  const data = load();
  data.progress[id] = { clearedAt: new Date().toISOString() };
  save(data);
}

export function loadNetlabTopology(id) {
  return load().topologies[id] || null;
}

export function saveNetlabTopology(id, topology) {
  const data = load();
  data.topologies[id] = topology;
  save(data);
}

export function clearNetlabTopology(id) {
  const data = load();
  delete data.topologies[id];
  save(data);
}
