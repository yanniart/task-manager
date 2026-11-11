// 브라우저 확인 실행기 (TRD 8장).
//
//   node tests/e2e/run.mjs              모든 단계 (02~08)
//   node tests/e2e/run.mjs 04 07        고른 단계만 (파일 이름 앞부분으로)
//   node tests/e2e/run.mjs perf         성능 측정 (PERF_N=100 처럼 개수 지정 가능)
//   BASE_URL=https://yanniart.github.io/task-manager/ node tests/e2e/run.mjs deployed   배포 주소 확인
//
// 하는 일
//   1) Chrome(또는 Edge)을 찾아요. 못 찾으면 CHROME_PATH 환경 변수로 알려 주세요.
//   2) 앱 서버(BASE_URL, 기본 http://localhost:8000/)가 없으면 `python -m http.server`로 잠깐 띄워요.
//   3) 단계마다 harness.js + audit.js + steps/<단계>.js 를 이어 붙여 실행하고, PASS/FAIL을 모아 보여줘요.
//   결과(스크린샷·로그)는 tests/e2e/.output/ 에 남아요(git에는 안 올라가요).
//
// 필요: Node 22 이상(내장 WebSocket), Chrome 또는 Edge, Python 3(서버를 직접 띄우지 않을 때는 불필요)

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = join(HERE, ".output");
const BASE = process.env.BASE_URL || "http://localhost:8000/";
const STEP_TIMEOUT_MS = 8 * 60 * 1000;

if (typeof WebSocket === "undefined") {
  console.error("Node 22 이상이 필요해요 (내장 WebSocket). 지금: " + process.version);
  process.exit(2);
}

// ---------- Chrome 찾기 ----------
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
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"],
  }[process.platform] ?? [];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

// ---------- Python 찾기 (서버용) ----------
function findPython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  for (const cmd of ["python", "python3", "py"]) {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (r.status === 0 && /Python 3/.test(r.stdout + r.stderr)) return cmd;
  }
  return null;
}

async function isUp(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

// ---------- 준비 ----------
const chromePath = findChrome();
if (!chromePath) {
  console.error("Chrome·Edge를 찾지 못했어요. 예: CHROME_PATH=\"/path/to/chrome\" node tests/e2e/run.mjs");
  process.exit(2);
}
const python = findPython();

let server = null;
if (!(await isUp(BASE))) {
  if (!python) {
    console.error(`앱 서버(${BASE})가 없고 Python도 없어요. 서버를 직접 띄운 뒤 다시 실행해 주세요.`);
    process.exit(2);
  }
  const port = new URL(BASE).port || "80";
  console.log(`앱 서버가 없어서 띄워요: ${python} -m http.server ${port}`);
  server = spawn(python, ["-m", "http.server", port, "--directory", ROOT], { stdio: "ignore" });
  for (let i = 0; i < 50 && !(await isUp(BASE)); i++) await new Promise((r) => setTimeout(r, 200));
  if (!(await isUp(BASE))) {
    console.error("앱 서버를 띄우지 못했어요.");
    server.kill();
    process.exit(2);
  }
}
const stopServer = () => {
  try {
    server?.kill();
  } catch {}
};
process.on("exit", stopServer);

// ---------- 단계 고르기 ----------
const stepsDir = join(HERE, "steps");
const all = readdirSync(stepsDir).filter((f) => f.endsWith(".js")).sort();
const wanted = process.argv.slice(2);
const steps = wanted.length
  ? all.filter((f) => wanted.some((w) => f.startsWith(w)))
  : all.filter((f) => f !== "perf.js" && f !== "deployed.js"); // 성능 측정·배포 확인은 따로 요청했을 때만
if (steps.length === 0) {
  console.error(`맞는 단계가 없어요: ${wanted.join(", ")}\n있는 단계: ${all.join(", ")}`);
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const prelude = readFileSync(join(HERE, "harness.js"), "utf8") + "\n" + readFileSync(join(HERE, "audit.js"), "utf8") + "\n";
console.log(`Chrome: ${chromePath}\n앱: ${BASE}\n결과: ${OUT}\n`);

// ---------- 실행 ----------
let totalPass = 0;
let totalFail = 0;
const failedSteps = [];
for (const step of steps) {
  const name = step.replace(/\.js$/, "");
  // 매번 새 브라우저 상태(서비스 워커·저장소)로. Windows에서는 Chrome이 끝난 뒤에도 잠깐 파일을 잡고 있어서
  // 지우고 다시 쓰지 않고 단계마다 새 폴더를 써요(끝에 한꺼번에 정리).
  const profile = join(OUT, `profile-${name}-${Date.now()}`);
  const script = join(OUT, `_${name}.mjs`);
  writeFileSync(script, prelude + readFileSync(join(stepsDir, step), "utf8"));

  const started = Date.now();
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    timeout: STEP_TIMEOUT_MS,
    env: {
      ...process.env,
      E2E_OUT: OUT,
      E2E_PROFILE: profile,
      CHROME_PATH: chromePath,
      BASE_URL: BASE,
      APP_ROOT: ROOT,
      ...(python ? { PYTHON: python } : {}),
    },
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  writeFileSync(join(OUT, `${name}.log`), output);

  const lines = output.split(/\r?\n/);
  const pass = lines.filter((l) => l.startsWith("PASS")).length;
  const fails = lines.filter((l) => l.startsWith("FAIL"));
  const crashed = result.status !== 0 && fails.length === 0;
  totalPass += pass;
  totalFail += fails.length + (crashed ? 1 : 0);
  const seconds = Math.round((Date.now() - started) / 1000);

  if (step === "perf.js") {
    console.log(`■ ${name} (${seconds}초)`);
    lines.filter((l) => l.startsWith("PERF")).forEach((l) => console.log("  " + l));
    if (result.status !== 0) console.log("  " + output.trim().split(/\r?\n/).slice(-5).join("\n  "));
    continue;
  }
  const mark = fails.length || crashed ? "✘" : "✔";
  console.log(`${mark} ${name}: PASS ${pass}, FAIL ${fails.length}${crashed ? " (도중에 멈춤)" : ""} · ${seconds}초`);
  fails.forEach((l) => console.log("    " + l.slice(0, 300)));
  if (crashed) console.log("    " + output.trim().split(/\r?\n/).slice(-6).join("\n    "));
  if (fails.length || crashed) failedSteps.push(name);
}

// 브라우저 프로필 정리 (아직 잡혀 있는 건 다음 실행 때 지워져요)
for (const dir of readdirSync(OUT).filter((d) => d.startsWith("profile"))) {
  try {
    rmSync(join(OUT, dir), { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  } catch {}
}

console.log(`\n합계: PASS ${totalPass}, FAIL ${totalFail}` + (failedSteps.length ? `  (실패한 단계: ${failedSteps.join(", ")}, 로그는 .output/<단계>.log)` : ""));
stopServer();
process.exit(totalFail > 0 ? 1 : 0);
