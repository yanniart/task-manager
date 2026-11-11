// 앱 아이콘 PNG 만들기 (TRD 5.8, TL-018).
//
//   node tools/make-icons.mjs                 assets/icons/*.svg → assets/icons/*.png (덮어써요)
//   node tools/make-icons.mjs --out=폴더       다른 폴더에 만들기 (지금 PNG와 비교해 볼 때)
//
// SVG 원본을 헤드리스 Chrome으로 그대로 그려서 캡처해요. 이미지 라이브러리가 필요 없어요.
//   icon.svg          → icon-192.png, icon-512.png       (둥근 사각형, 모서리 투명)
//   icon-maskable.svg → icon-maskable-512.png           (바탕을 꽉 채움, Android가 모양대로 잘라 씀)
//                     → apple-touch-icon.png (180px)    (iPhone은 스스로 모서리를 깎아서 꽉 찬 걸 써요)
// 아이콘을 바꾸려면 SVG를 고친 뒤 이걸 돌리고, sw.js의 CACHE_VERSION을 올려요.
//
// 필요: Node 22 이상(내장 WebSocket), Chrome 또는 Edge (CHROME_PATH로 지정 가능)

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets", "icons");
const outArg = process.argv.find((a) => a.startsWith("--out="));
const OUT = outArg ? resolve(outArg.slice("--out=".length)) : SRC;
const PORT = Number(process.env.CDP_PORT || 9334);

const JOBS = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon-maskable.svg", "icon-maskable-512.png", 512],
  ["icon-maskable.svg", "apple-touch-icon.png", 180],
];

if (typeof WebSocket === "undefined") {
  console.error("Node 22 이상이 필요해요 (내장 WebSocket). 지금: " + process.version);
  process.exit(2);
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = {
    win32: [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
      `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  }[process.platform] ?? [];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

const chromePath = findChrome();
if (!chromePath) {
  console.error('Chrome·Edge를 찾지 못했어요. 예: CHROME_PATH="/path/to/chrome" node tools/make-icons.mjs');
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "mytask-icons-"));
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], {
  stdio: "ignore",
});
process.on("exit", () => {
  try {
    chrome.kill();
  } catch {}
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page = null;
for (let i = 0; i < 50 && !page; i++) {
  try {
    page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page");
  } catch {}
  if (!page) await sleep(200);
}
if (!page) {
  console.error(`Chrome에 연결하지 못했어요 (포트 ${PORT}).`);
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", ({ data }) => {
  const m = JSON.parse(data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }); // 투명 바탕
for (const [src, out, size] of JOBS) {
  const svg = readFileSync(join(SRC, src), "utf8");
  await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  const html = `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
  await send("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(html) });
  await sleep(400);
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  writeFileSync(join(OUT, out), Buffer.from(data, "base64"));
  console.log(`✔ ${out} (${size}×${size}) ← ${src}`);
}

ws.close();
chrome.kill();
await sleep(300);
try {
  rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
} catch {}
console.log(`\n저장한 곳: ${OUT}` + (OUT === SRC ? "\n앱에 반영하려면 sw.js의 CACHE_VERSION을 올려 주세요." : ""));
