// 브라우저 확인 공통 부분 (TRD 8장).
// 헤드리스 Chrome을 띄우고 DevTools 프로토콜(Node 내장 WebSocket)로 조작해요. Chrome 확장·라이브러리 없음.
// ※ 단독으로 실행하는 파일이 아니에요. run.mjs가 각 단계(steps/*.js) 앞에 이어 붙여요.
//   값은 run.mjs가 환경 변수로 넘겨줘요: E2E_OUT(결과 폴더), E2E_PROFILE(이 단계의 Chrome 프로필), CHROME_PATH, BASE_URL, CDP_PORT, APP_ROOT, PYTHON
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.E2E_OUT;
const CHROME = process.env.CHROME_PATH;
const PORT = Number(process.env.CDP_PORT || 9333);
const BASE = process.env.BASE_URL;
const PROFILE = process.env.E2E_PROFILE || join(OUT, "profile");
mkdirSync(PROFILE, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });
// 단계가 중간에 오류로 끝나도 Chrome이 남지 않게
process.on("exit", () => { try { chrome.kill(); } catch {} });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.some(t => t.type === "page")) break; } catch {}
  await sleep(200);
}
const page = targets?.find((t) => t.type === "page");
if (!page) throw new Error(`Chrome에 연결하지 못했어요 (CDP 포트 ${PORT}). CHROME_PATH를 확인해 주세요: ${CHROME}`);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let seq = 0;
const pending = new Map();
const problems = [];
const waiters = [];
ws.addEventListener("message", ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Runtime.exceptionThrown") problems.push("exception: " + msg.params.exceptionDetails.exception?.description);
  if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type))
    problems.push(`console.${msg.params.type}: ` + msg.params.args.map((a) => a.value ?? a.description).join(" "));
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") problems.push("log: " + msg.params.entry.text + " " + (msg.params.entry.url ?? ""));
  if (msg.method === "Page.javascriptDialogOpening") {
    dialogs.push(msg.params.message);
    send("Page.handleJavaScriptDialog", { accept: true });
  }
  for (const w of [...waiters]) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg); }
});
const dialogs = [];
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => pending.set(id, (m) => { if (m.error) throw new Error(method + ": " + m.error.message); r(m.result); }));
}
const waitFor = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
async function evaluate(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("eval: " + r.exceptionDetails.exception?.description);
  return r.result.value;
}
async function go(url) { const loaded = waitFor("Page.loadEventFired"); await send("Page.navigate", { url }); await loaded; await sleep(300); }
async function reload() { const loaded = waitFor("Page.loadEventFired"); await send("Page.reload", {}); await loaded; await sleep(300); }
async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
}

const checks = [];
const check = (name, cond, detail = "") => checks.push({ name, ok: !!cond, detail });

await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true });
