import { ipToStr, isValidMask, macWin, parseIp } from "./addr.js";
import { getDevice } from "./topology.js";
import { hostConfig, macOf, pingOnce } from "./sim.js";

// Windows-style command prompt for PC / Server.
// exec() returns { lines, trace?, clear?, animate? } and mutates sim state (ARP cache).

const HELP = [
  "使用できるコマンド:",
  "  ipconfig [/all]    IPアドレス設定を表示",
  "  ping <IPアドレス>  疎通確認",
  "  arp -a             ARPテーブルを表示",
  "  cls                画面をクリア",
  "",
  "IPアドレスの設定 (Windows):",
  '  netsh interface ip set address "FastEthernet0" static <IP> <マスク> [ゲートウェイ]',
  "  netsh interface ip show config",
  "簡易コマンド:",
  "  ipconfig /ip <IP> <マスク>    IPアドレスとマスクを設定",
  "  ipconfig /dg <ゲートウェイ>   デフォルトゲートウェイを設定",
];

export function prompt() {
  return "C:\\>";
}

export function exec(sim, deviceId, line) {
  const device = getDevice(sim.topology, deviceId);
  const [cmd, ...args] = line.trim().split(/\s+/);
  switch ((cmd || "").toLowerCase()) {
    case "":
      return { lines: [] };
    case "help":
    case "?":
      return { lines: HELP };
    case "cls":
    case "clear":
      return { lines: [], clear: true };
    case "ipconfig":
      return ipconfigCmd(device, args);
    case "netsh":
      return netsh(device, args);
    case "arp":
      return args[0]?.toLowerCase() === "-a"
        ? { lines: arpTable(sim, device) }
        : { lines: ["使い方: arp -a"] };
    case "ping":
      return ping(sim, device, args[0]);
    default:
      return {
        lines: [`'${cmd}' は、内部コマンドまたは外部コマンド、操作可能なプログラムまたはバッチ ファイルとして認識されていません。`, "（help で使えるコマンドを確認できます）"],
      };
  }
}

const usageError = (lines) => ({ lines });

function setConfig(device, patch, lines) {
  return { lines, update: { config: { ...device.config, ...patch } } };
}

function ipconfigCmd(device, args) {
  const sw = args[0]?.toLowerCase();
  if (sw === "/ip") {
    return setAddress(device, args[1], args[2], device.config?.gateway ?? "", ["OK"]);
  }
  if (sw === "/dg") {
    if (parseIp(args[1]) === null) return usageError(["使い方: ipconfig /dg <ゲートウェイ>", "ゲートウェイのIPアドレス形式が正しくありません。"]);
    return setConfig(device, { gateway: args[1] }, ["OK"]);
  }
  return { lines: ipconfig(device, sw === "/all") };
}

function setAddress(device, ip, mask, gateway, okLines) {
  if (parseIp(ip) === null) return usageError(["The parameter is incorrect.", "IPアドレスの形式が正しくありません。"]);
  if (!isValidMask(mask)) return usageError(["The parameter is incorrect.", "サブネットマスクが正しくありません（例: 255.255.255.0）。"]);
  if (gateway && parseIp(gateway) === null) return usageError(["The parameter is incorrect.", "ゲートウェイのIPアドレス形式が正しくありません。"]);
  return setConfig(device, { ip, mask, gateway }, okLines);
}

// netsh interface ip set address "FastEthernet0" static <ip> <mask> [<gateway>]
function netsh(device, args) {
  const a = args.join(" ").replace(/"/g, "").split(/\s+/).filter(Boolean);
  const lower = a.map((x) => x.toLowerCase());
  if (lower[0] !== "interface" || !["ip", "ipv4"].includes(lower[1])) {
    return usageError(["使い方: netsh interface ip set address \"FastEthernet0\" static <IP> <マスク> [ゲートウェイ]"]);
  }
  if (lower[2] === "show") return { lines: ipconfig(device, true) };
  if (lower[2] !== "set" || lower[3] !== "address") {
    return usageError(["使い方: netsh interface ip set address \"FastEthernet0\" static <IP> <マスク> [ゲートウェイ]"]);
  }
  if (lower.includes("dhcp")) return usageError(["DHCPによる自動取得はまだ対応していません。static で指定してください。"]);
  const at = lower.indexOf("static");
  if (at === -1 || a.length < at + 3) {
    return usageError(["使い方: netsh interface ip set address \"FastEthernet0\" static <IP> <マスク> [ゲートウェイ]"]);
  }
  const [ip, mask, gateway = ""] = a.slice(at + 1);
  return setAddress(device, ip, mask, gateway, ["Ok.", ""]);
}

function dots(label, value) {
  return `   ${label.padEnd(26, ".")}: ${value}`;
}

function ipconfig(device, all) {
  const cfg = hostConfig(device);
  const out = ["Ethernet adapter FastEthernet0:", ""];
  if (all) out.push(dots("Physical Address", macWin(macOf(device))));
  out.push(dots("IPv4 Address", cfg.ip || ""));
  out.push(dots("Subnet Mask", cfg.mask || ""));
  out.push(dots("Default Gateway", cfg.gateway || ""));
  return out;
}

function arpTable(sim, device) {
  const entries = Object.entries(sim.state[device.id].arp);
  if (!entries.length) return ["ARPエントリが見つかりません。"];
  return [
    "  Internet Address      Physical Address      Type",
    ...entries.map(([ip, mac]) => `  ${ip.padEnd(22)}${macWin(mac).padEnd(22)}dynamic`),
  ];
}

function ping(sim, device, target) {
  if (!target) return { lines: ["使い方: ping <IPアドレス>"] };
  const dst = parseIp(target);
  if (dst === null) {
    return { lines: [`Ping request could not find host ${target}. Please check the name and try again.`] };
  }
  const dstIp = ipToStr(dst);
  const lines = [`Pinging ${dstIp} with 32 bytes of data:`, ""];
  const trace = [];
  let received = 0;
  for (let seq = 1; seq <= 4; seq++) {
    const r = pingOnce(sim, device.id, dstIp, seq);
    if (seq === 1) trace.push(...r.trace);
    if (r.reply) {
      received++;
      lines.push(`Reply from ${dstIp}: bytes=32 time<1ms TTL=${r.reply.ttl}`);
    } else if (r.reason === "noroute") {
      lines.push(`Reply from ${hostConfig(device).ip}: Destination host unreachable.`);
    } else if (r.reason === "noip") {
      lines.push("PING: transmit failed. General failure.");
    } else {
      lines.push("Request timed out.");
    }
  }
  const lost = 4 - received;
  lines.push("", `Ping statistics for ${dstIp}:`, `    Packets: Sent = 4, Received = ${received}, Lost = ${lost} (${lost * 25}% loss),`);
  if (received) {
    lines.push("Approximate round trip times in milli-seconds:", "    Minimum = 0ms, Maximum = 0ms, Average = 0ms");
  }
  return { lines, trace, animate: true, success: received > 0 };
}
