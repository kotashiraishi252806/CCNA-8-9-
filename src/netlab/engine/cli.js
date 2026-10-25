import { isHost } from "./topology.js";
import * as pc from "./pcCli.js";
import * as ios from "./iosCli.js";

// Dispatches to the CLI that matches the device kind.
// exec() returns { lines, session?, update?, trace?, clear?, animate? }.

export function newSession(device) {
  return isHost(device) ? {} : ios.createSession();
}

export function promptOf(device, session) {
  return isHost(device) ? pc.prompt() : ios.promptOf(device, session);
}

export function exec(sim, device, session, line) {
  return isHost(device) ? pc.exec(sim, device.id, line) : ios.execIos(sim, device, session, line);
}

export function complete(device, session, line) {
  return isHost(device) ? line : ios.completeIos(device, session, line);
}
