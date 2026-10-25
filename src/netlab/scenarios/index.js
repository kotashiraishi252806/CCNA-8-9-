// Scenario shape:
//   { id, title, level, summary, description: string[], hints: string[], topology, checks }
// checks: { from: deviceId, toIp, label } — passes when `from` can ping `toIp`.

const host = (id, type, name, x, y, config = { ip: "", mask: "", gateway: "" }) => ({ id, type, name, x, y, config });
const sw = (id, name, x, y) => ({ id, type: "switch", name, x, y });
const link = (id, a, aPort, b, bPort) => ({ id, a: { dev: a, port: aPort }, b: { dev: b, port: bPort } });

// Setting a PC's IP is not CCNA material (the exam uses a GUI), so every scenario that needs it
// spells out the procedure in the problem text.
const HOWTO_PC_IP = [
  "【PCのIP設定のやり方】※CCNA試験範囲外の操作です",
  "PC/サーバを選択 →「ターミナル」タブで次のコマンドを入力します。",
  '  netsh interface ip set address "FastEthernet0" static <IPアドレス> <サブネットマスク>',
  "  例: netsh interface ip set address \"FastEthernet0\" static 192.168.1.1 255.255.255.0",
  "設定の確認は ipconfig、疎通確認は ping <IPアドレス> を使います。（IPとマスクだけなら ipconfig /ip <IP> <マスク> でも設定できます）",
];

export const SANDBOX = {
  id: "sandbox",
  title: "自由構築",
  level: "自由",
  summary: "課題なしで自由に機器を配置して試せます。",
  description: ["機器を追加し、ケーブルでつないで、IPアドレスを設定してpingを試してみましょう。", ...HOWTO_PC_IP],
  hints: [],
  topology: { devices: [], links: [] },
  checks: [],
};

export const SCENARIOS = [
  {
    id: "direct",
    title: "PC 2台を直接つなぐ",
    level: "初級",
    summary: "ケーブル接続とIPアドレス設定の基本。",
    description: [
      "PC1とPC2をLANケーブルで直接接続し、お互いに通信できるようにしてください。",
      "アドレス: PC1 = 192.168.1.1 / PC2 = 192.168.1.2、サブネットマスクはどちらも 255.255.255.0",
      ...HOWTO_PC_IP,
    ],
    hints: [
      "上のツールバーの「ケーブル」を選び、PC1、PC2の順にタップするとポートを選んで接続できます。",
      "設定後は ipconfig で確認し、ping 192.168.1.2 で疎通を確認します。",
    ],
    topology: {
      devices: [host("pc1", "pc", "PC1", 80, 140), host("pc2", "pc", "PC2", 380, 140)],
      links: [],
    },
    checks: [
      { from: "pc1", toIp: "192.168.1.2", label: "PC1 から 192.168.1.2 へ ping が通る" },
      { from: "pc2", toIp: "192.168.1.1", label: "PC2 から 192.168.1.1 へ ping が通る" },
    ],
  },
  {
    id: "switch",
    title: "スイッチでPCをつなぐ",
    level: "初級",
    summary: "スイッチ経由の通信と、ARP・MACアドレス学習の観察。",
    description: [
      "PC1とPC2をスイッチSW1に接続し、通信できるようにしてください。",
      "アドレス: PC1 = 192.168.1.10 / PC2 = 192.168.1.20、サブネットマスクは 255.255.255.0",
      "pingが通ったら、パケット追跡とSW1の「MACアドレステーブル」を見て、ARPとMAC学習の流れを確認しましょう。",
      ...HOWTO_PC_IP,
    ],
    hints: [
      "PC1—SW1、PC2—SW1 の2本のケーブルが必要です。スイッチ側のポートは空いていればどれでも構いません。",
      "最初のpingではARP要求がブロードキャストされ、スイッチが送信元MACを学習します。",
    ],
    topology: {
      devices: [host("pc1", "pc", "PC1", 60, 80), host("pc2", "pc", "PC2", 400, 80), sw("sw1", "SW1", 230, 240)],
      links: [],
    },
    checks: [
      { from: "pc1", toIp: "192.168.1.20", label: "PC1 から 192.168.1.20 へ ping が通る" },
      { from: "pc2", toIp: "192.168.1.10", label: "PC2 から 192.168.1.10 へ ping が通る" },
    ],
  },
  {
    id: "mask-trouble",
    title: "片方向だけ通らない？（トラブルシュート）",
    level: "中級",
    summary: "サブネットマスクの設定ミスを見つけて直す。",
    description: [
      "PC1とPC2はスイッチ経由で接続済みですが、通信できません。原因を調べて修正してください。",
      "PC1 = 192.168.1.10/24、PC2 = 192.168.1.70 です。PC2のサブネットマスクだけを見直しましょう（IPアドレスは変更しない）。",
      ...HOWTO_PC_IP,
    ],
    hints: [
      "両方のPCで ipconfig を実行して設定を見比べます。",
      "PC2のマスクが 255.255.255.192 になっています。この場合PC2から見ると 192.168.1.10 は別ネットワークです。",
      "PC1→PC2のエコー要求は届くのに、PC2が応答を返せない点をパケット追跡で確認してみましょう。",
    ],
    topology: {
      devices: [
        host("pc1", "pc", "PC1", 60, 80, { ip: "192.168.1.10", mask: "255.255.255.0", gateway: "" }),
        host("pc2", "pc", "PC2", 400, 80, { ip: "192.168.1.70", mask: "255.255.255.192", gateway: "" }),
        sw("sw1", "SW1", 230, 240),
      ],
      links: [link("l1", "pc1", "Fa0", "sw1", "Fa0/1"), link("l2", "pc2", "Fa0", "sw1", "Fa0/2")],
    },
    checks: [
      { from: "pc1", toIp: "192.168.1.70", label: "PC1 から 192.168.1.70 へ ping が通る" },
      { from: "pc2", toIp: "192.168.1.10", label: "PC2 から 192.168.1.10 へ ping が通る" },
    ],
  },
  {
    id: "server",
    title: "サーバにアクセスする",
    level: "初級",
    summary: "PC2台とサーバを1つのネットワークにまとめる。",
    description: [
      "PC1、PC2、Server1をSW1に接続し、すべての機器が互いに通信できるようにしてください。",
      "ネットワーク: 192.168.10.0/24（255.255.255.0）",
      "アドレス: PC1 = 192.168.10.11 / PC2 = 192.168.10.12 / Server1 = 192.168.10.100",
      ...HOWTO_PC_IP,
    ],
    hints: ["Server1もPCと同じ「ターミナル」タブで、設定とpingができます。"],
    topology: {
      devices: [
        host("pc1", "pc", "PC1", 40, 60),
        host("pc2", "pc", "PC2", 40, 260),
        host("server1", "server", "Server1", 440, 160),
        sw("sw1", "SW1", 240, 160),
      ],
      links: [],
    },
    checks: [
      { from: "pc1", toIp: "192.168.10.100", label: "PC1 から Server1 (192.168.10.100) へ ping が通る" },
      { from: "pc2", toIp: "192.168.10.100", label: "PC2 から Server1 (192.168.10.100) へ ping が通る" },
      { from: "pc1", toIp: "192.168.10.12", label: "PC1 から PC2 (192.168.10.12) へ ping が通る" },
    ],
  },
  {
    id: "two-switches",
    title: "スイッチを2台つなぐ",
    level: "中級",
    summary: "スイッチ間接続（カスケード）でのMAC学習。",
    description: [
      "PC1—SW1—SW2—PC2 の構成を作り、PC1とPC2が通信できるようにしてください。",
      "アドレス: PC1 = 172.16.0.1 / PC2 = 172.16.0.2、サブネットマスクは 255.255.0.0",
      "通信後、SW1とSW2のMACアドレステーブルを見て、PC2のMACがどのポートに学習されているか確認しましょう。",
      ...HOWTO_PC_IP,
    ],
    hints: [
      "SW1とSW2の間もケーブルで接続します（ポートはFa0/1など空いているもので構いません）。",
      "SW1ではPC2のMACは「SW2につながるポート」に、SW2ではPC2のMACは「PC2につながるポート」に学習されます。",
    ],
    topology: {
      devices: [host("pc1", "pc", "PC1", 20, 140), sw("sw1", "SW1", 170, 140), sw("sw2", "SW2", 320, 140), host("pc2", "pc", "PC2", 470, 140)],
      links: [],
    },
    checks: [
      { from: "pc1", toIp: "172.16.0.2", label: "PC1 から 172.16.0.2 へ ping が通る" },
      { from: "pc2", toIp: "172.16.0.1", label: "PC2 から 172.16.0.1 へ ping が通る" },
    ],
  },
  {
    id: "port-shutdown",
    title: "スイッチのポートが落ちている",
    level: "中級",
    summary: "スイッチのCLIで原因を調べて直す。",
    description: [
      "PC1とPC2はSW1に接続済みでIPも正しく設定されていますが、PC2と通信できません。",
      "SW1のCLIで原因を調べ、設定を修正してください。（PC1 = 192.168.1.10 / PC2 = 192.168.1.20、/24）",
    ],
    hints: [
      "SW1を選択し「CLI」タブを開きます。まず enable で特権モードに入ります。",
      "show interfaces status や show ip interface brief でポートの状態を確認します。",
      "原因のポートで: configure terminal → interface fa0/2 → no shutdown。確認後 end で戻ります。",
    ],
    topology: {
      devices: [
        host("pc1", "pc", "PC1", 60, 80, { ip: "192.168.1.10", mask: "255.255.255.0", gateway: "" }),
        host("pc2", "pc", "PC2", 400, 80, { ip: "192.168.1.20", mask: "255.255.255.0", gateway: "" }),
        { ...sw("sw1", "SW1", 230, 240), ports: { "Fa0/2": { shutdown: true } } },
      ],
      links: [link("l1", "pc1", "Fa0", "sw1", "Fa0/1"), link("l2", "pc2", "Fa0", "sw1", "Fa0/2")],
    },
    checks: [
      { from: "pc1", toIp: "192.168.1.20", label: "PC1 から 192.168.1.20 へ ping が通る" },
      { from: "pc2", toIp: "192.168.1.10", label: "PC2 から 192.168.1.10 へ ping が通る" },
    ],
  },
];

export function getScenario(id) {
  return id === SANDBOX.id ? SANDBOX : SCENARIOS.find((s) => s.id === id) || null;
}
