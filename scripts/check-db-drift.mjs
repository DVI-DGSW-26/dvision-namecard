import { spawnSync } from "node:child_process";

/**
 * DB 스키마가 prisma/schema.prisma 와 어긋났는지 검사합니다.
 *
 * db:push 를 자동 실행하지 않는 이유: push 는 컬럼을 지우는 파괴적 작업입니다.
 * dev 나 build 에 걸어 두면 DATABASE_URL 이 공용 DB 를 가리키는 순간 서버를
 * 띄우는 것만으로 남의 스키마가 밀립니다. 그래서 감지해서 알려주기만 합니다.
 *
 * 종료코드는 항상 0 입니다. 불일치가 개발을 막을 이유는 없고, 못 보고 지나치는
 * 것만 막으면 됩니다.
 */

const args = [
  "prisma",
  "migrate",
  "diff",
  "--from-config-datasource",
  "--to-schema",
  "prisma/schema.prisma",
  "--exit-code",
];

const probe = spawnSync("npx", args, { encoding: "utf8", shell: true });

// 0: 차이 없음 / 2: 차이 있음 / 1: 실행 실패(DB 미기동 등)
if (probe.status === 0) process.exit(0);

if (probe.status === 1) {
  // DB 가 안 떠 있거나 접속 정보가 틀린 경우. 여기서 막지는 않습니다 —
  // DB 없이 UI 만 만지는 경우도 있고, 실제 에러는 앱이 더 정확히 알려줍니다.
  console.warn("\n[db] 스키마 확인을 건너뜁니다 — 데이터베이스에 접속하지 못했습니다.\n");
  process.exit(0);
}

const summary = spawnSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma"],
  { encoding: "utf8", shell: true },
);

console.warn("\n" + "─".repeat(64));
console.warn("[db] 데이터베이스가 prisma/schema.prisma 와 다릅니다.");
console.warn("     이대로 두면 없는 컬럼을 조회하다 500 이 납니다.");
console.warn("");
console.warn((summary.stdout ?? "").trim().split("\n").map((l) => "     " + l).join("\n"));
console.warn("");
console.warn("     schema.prisma 를 고친 뒤라면 마이그레이션을 만드세요:");
console.warn("       pnpm db:migrate --name <이름>");
console.warn("");
console.warn("     남이 만든 마이그레이션을 아직 안 받은 것뿐이라면:");
console.warn("       git pull && pnpm db:migrate");
console.warn("     (README > 데이터베이스)");
console.warn("─".repeat(64) + "\n");

process.exit(0);
