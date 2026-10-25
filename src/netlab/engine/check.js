import { createSim, pingOnce } from "./sim.js";
import { getDevice } from "./topology.js";

// Scenario check: { from: deviceId, toIp: string }. Passes when a ping gets a reply.
export function evaluateChecks(topology, checks) {
  return checks.map((c) => {
    const from = getDevice(topology, c.from);
    if (!from) return { ...c, pass: false };
    const sim = createSim(topology);
    const pass = [1, 2, 3, 4].some((seq) => pingOnce(sim, c.from, c.toIp, seq).reply);
    return { ...c, pass };
  });
}
