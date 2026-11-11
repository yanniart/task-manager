// core 테스트를 브라우저 없이 Node에서 빠르게 돌려요 (tests/core.test.html과 같은 테스트).
//
//   node tests/run-core.mjs
//   node tests/run-core.mjs --tz=America/Los_Angeles     다른 시간대에서도 (날짜 계산 확인)
//
// ※ 시간대는 꼭 --tz= 로 넘겨 주세요. Windows(Git Bash 등)에서는 `TZ=… node`처럼 환경 변수로 주면
//   Node가 무시해요(그래서 실행 중에 process.env.TZ를 바꿔요).
//
// core.test.html 안의 <script type="module">을 꺼내서, ../js/ 경로를 실제 파일 위치로 바꿔 실행해요.
// core/ 함수는 DOM을 모르니까 Node에서도 그대로 돌아요. (Node 18 이상)

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const tzArg = process.argv.find((a) => a.startsWith("--tz="));
if (tzArg) process.env.TZ = tzArg.slice("--tz=".length);

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "core.test.html"), "utf8");
const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!match) {
  console.error("core.test.html에서 테스트 스크립트를 찾지 못했어요.");
  process.exit(2);
}
const jsRoot = pathToFileURL(join(here, "..", "js")).href;
const code = match[1].replaceAll('"../js/', `"${jsRoot}/`);

const dir = mkdtempSync(join(tmpdir(), "task-manager-core-"));
const file = join(dir, "core.test.mjs");
writeFileSync(file, code);
try {
  await import(pathToFileURL(file).href);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const summary = globalThis.__testSummary;
console.log(`\n${summary.failed === 0 ? "✔ 모두 통과" : "✘ 실패 있음"}: 전체 ${summary.total}개, 실패 ${summary.failed}개 (시간대 ${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
process.exit(summary.failed === 0 ? 0 : 1);
