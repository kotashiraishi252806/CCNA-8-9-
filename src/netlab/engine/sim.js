import { BROADCAST_MAC, makeMac, parseIp, sameSubnet, isValidMask } from "./addr.js";
import { DEVICE_TYPES, getDevice, isHost } from "./topology.js";

// Frame-level L2/L3 simulation (Phase 1: hosts + L2 switches).
//
// Frame shape:
//   { src, dst, type: "arp", arp: { op: "request" | "reply", senderIp, senderMac, targetIp } }
//   { src, dst, type: "ip",  ip:  { src, dst, ttl, icmp: { kind: "echo-request" | "echo-reply", id, seq } } }
//
// Devices are event-driven: transmit() queues a frame on the cable's far end and
// runQueue() drains the queue, so replies (ARP reply, echo reply) happen naturally.

const MAX_EVENTS = 400;

export function createSim(topology) {
  // A cable only carries traffic while neither end is administratively shut down.
  const peer = new Map();
  for (const l of topology.links) {
    if (isPortShutdown(getDevice(topology, l.a.dev), l.a.port) || isPortShutdown(getDevice(topology, l.b.dev), l.b.port)) continue;
    peer.set(`${l.a.dev}|${l.a.port}`, l.b);
    peer.set(`${l.b.dev}|${l.b.port}`, l.a);
  }
  const state = {};
  for (const d of topology.devices) {
    state[d.id] = isHost(d) ? { arp: {}, pending: [] } : { macTable: {} };
  }
  return { topology, peer, state };
}

export function isPortShutdown(device, port) {
  return Boolean(device?.ports?.[port]?.shutdown);
}

export function macOf(device) {
  return makeMac(device.id);
}

function hostPort(device) {
  return DEVICE_TYPES[device.type].ports[0];
}

function newCtx() {
  return { queue: [], trace: [], replies: [] };
}

function describeFrame(frame) {
  if (frame.type === "arp") {
    const a = frame.arp;
    return a.op === "request"
      ? `ARP要求 (${a.targetIp} のMACアドレスは？)`
      : `ARP応答 (${a.senderIp} のMACは ${a.senderMac})`;
  }
  const { icmp, src, dst } = frame.ip;
  return `ICMP ${icmp.kind === "echo-request" ? "エコー要求" : "エコー応答"} ${src} → ${dst}`;
}

function transmit(sim, ctx, device, port, frame) {
  const far = sim.peer.get(`${device.id}|${port}`);
  if (!far) return false;
  const farDev = getDevice(sim.topology, far.dev);
  ctx.trace.push({
    kind: "frame",
    text: `${device.name}(${port}) → ${farDev.name}(${far.port}) : ${describeFrame(frame)}`,
  });
  ctx.queue.push({ dev: far.dev, port: far.port, frame });
  return true;
}

function info(ctx, text, kind = "info") {
  ctx.trace.push({ kind, text });
}

function runQueue(sim, ctx) {
  let events = 0;
  while (ctx.queue.length) {
    if (++events > MAX_EVENTS) {
      info(ctx, "フレームが増え続けています。ループ構成によるブロードキャストストームの可能性があります（STPは未対応）。", "warn");
      ctx.queue.length = 0;
      break;
    }
    const ev = ctx.queue.shift();
    const device = getDevice(sim.topology, ev.dev);
    if (isHost(device)) hostReceive(sim, ctx, device, ev.frame);
    else switchReceive(sim, ctx, device, ev.port, ev.frame);
  }
  // Packets still waiting for ARP never got an answer; discard them.
  for (const id in sim.state) if (sim.state[id].pending) sim.state[id].pending = [];
}

// --- Switch ---

function switchReceive(sim, ctx, device, ingress, frame) {
  const st = sim.state[device.id];
  if (st.macTable[frame.src] !== ingress) {
    st.macTable[frame.src] = ingress;
    info(ctx, `${device.name}: MACアドレス ${frame.src} をポート ${ingress} に学習`);
  }
  const known = frame.dst !== BROADCAST_MAC && st.macTable[frame.dst];
  if (known) {
    const out = st.macTable[frame.dst];
    if (out === ingress) {
      info(ctx, `${device.name}: 宛先は受信ポートと同じセグメントのためフィルタ（破棄）`);
      return;
    }
    info(ctx, `${device.name}: MACアドレステーブルに ${frame.dst} あり → ポート ${out} から転送`);
    transmit(sim, ctx, device, out, frame);
    return;
  }
  const reason = frame.dst === BROADCAST_MAC ? "ブロードキャスト" : "宛先MAC未学習（unknown unicast）";
  const outs = DEVICE_TYPES[device.type].ports.filter((p) => p !== ingress && sim.peer.has(`${device.id}|${p}`));
  info(ctx, `${device.name}: ${reason}のため受信ポート以外へフラッディング`);
  for (const p of outs) transmit(sim, ctx, device, p, frame);
}

// --- Host ---

function hostConfig(device) {
  const c = device.config || {};
  const ip = parseIp(c.ip) !== null ? c.ip : "";
  const mask = isValidMask(c.mask) ? c.mask : "";
  const gateway = parseIp(c.gateway) !== null ? c.gateway : "";
  return { ip, mask, gateway };
}

export { hostConfig };

function hostReceive(sim, ctx, device, frame) {
  const mac = macOf(device);
  const cfg = hostConfig(device);
  const st = sim.state[device.id];
  if (frame.dst !== BROADCAST_MAC && frame.dst !== mac) {
    info(ctx, `${device.name}: 宛先MACが自分ではないためフレームを破棄`);
    return;
  }
  if (frame.type === "arp") {
    const a = frame.arp;
    if (!cfg.ip || a.targetIp !== cfg.ip) {
      info(ctx, `${device.name}: ARPの対象IPが自分ではないため無視`);
      return;
    }
    st.arp[a.senderIp] = a.senderMac;
    info(ctx, `${device.name}: ARPテーブルに ${a.senderIp} = ${a.senderMac} を登録`);
    if (a.op === "request") {
      transmit(sim, ctx, device, hostPort(device), {
        src: mac,
        dst: a.senderMac,
        type: "arp",
        arp: { op: "reply", senderIp: cfg.ip, senderMac: mac, targetIp: a.senderIp },
      });
    } else {
      const ready = st.pending.filter((p) => p.nextHop === a.senderIp);
      st.pending = st.pending.filter((p) => p.nextHop !== a.senderIp);
      for (const p of ready) {
        transmit(sim, ctx, device, hostPort(device), { src: mac, dst: a.senderMac, type: "ip", ip: p.ip });
      }
    }
    return;
  }
  // IP
  const ip = frame.ip;
  if (ip.dst !== cfg.ip) {
    info(ctx, `${device.name}: 宛先IPが自分ではないためパケットを破棄（ホストは転送しない）`);
    return;
  }
  if (ip.icmp.kind === "echo-request") {
    info(ctx, `${device.name}: エコー要求を受信 → 応答を返す`);
    sendIp(sim, ctx, device, ip.src, { kind: "echo-reply", id: ip.icmp.id, seq: ip.icmp.seq });
  } else {
    info(ctx, `${device.name}: エコー応答を受信`);
    ctx.replies.push({ from: ip.src, id: ip.icmp.id, seq: ip.icmp.seq, ttl: ip.ttl });
  }
}

// Send an IP packet from a host. Returns { ok: true } or { ok: false, reason }.
function sendIp(sim, ctx, device, dstIp, icmp) {
  const cfg = hostConfig(device);
  const st = sim.state[device.id];
  const port = hostPort(device);
  if (!cfg.ip || !cfg.mask) {
    info(ctx, `${device.name}: IPアドレス／サブネットマスクが未設定のため送信できない`, "drop");
    return { ok: false, reason: "noip" };
  }
  let nextHop;
  if (sameSubnet(cfg.ip, dstIp, cfg.mask)) {
    nextHop = dstIp;
    info(ctx, `${device.name}: ${dstIp} は同じネットワーク内 → 直接ARPで解決`);
  } else if (cfg.gateway && sameSubnet(cfg.ip, cfg.gateway, cfg.mask)) {
    nextHop = cfg.gateway;
    info(ctx, `${device.name}: ${dstIp} は別ネットワーク → デフォルトゲートウェイ ${cfg.gateway} 宛に送る`);
  } else {
    info(ctx, `${device.name}: ${dstIp} は別ネットワークで、使えるデフォルトゲートウェイがないため送信できない`, "drop");
    return { ok: false, reason: "noroute" };
  }
  if (!sim.peer.has(`${device.id}|${port}`)) {
    info(ctx, `${device.name}: ケーブルが接続されていないため送信できない`, "drop");
    return { ok: false, reason: "nolink" };
  }
  const mac = macOf(device);
  const ip = { src: cfg.ip, dst: dstIp, ttl: DEVICE_TYPES[device.type].ttl, icmp };
  if (st.arp[nextHop]) {
    info(ctx, `${device.name}: ARPテーブルに ${nextHop} あり`);
    transmit(sim, ctx, device, port, { src: mac, dst: st.arp[nextHop], type: "ip", ip });
  } else {
    info(ctx, `${device.name}: ARPテーブルに ${nextHop} がないためARP要求をブロードキャスト`);
    st.pending.push({ nextHop, ip });
    transmit(sim, ctx, device, port, {
      src: mac,
      dst: BROADCAST_MAC,
      type: "arp",
      arp: { op: "request", senderIp: cfg.ip, senderMac: mac, targetIp: nextHop },
    });
  }
  return { ok: true };
}

// One echo request. Returns { reply | null, reason, trace }.
export function pingOnce(sim, srcId, dstIp, seq) {
  const device = getDevice(sim.topology, srcId);
  const ctx = newCtx();
  const sent = sendIp(sim, ctx, device, dstIp, { kind: "echo-request", id: 1, seq });
  if (sent.ok) runQueue(sim, ctx);
  const reply = ctx.replies.find((r) => r.id === 1 && r.seq === seq && r.from === dstIp) || null;
  if (sent.ok && !reply) info(ctx, "応答が返ってこなかったためタイムアウト", "drop");
  return { reply, reason: sent.ok ? "timeout" : sent.reason, trace: ctx.trace };
}
