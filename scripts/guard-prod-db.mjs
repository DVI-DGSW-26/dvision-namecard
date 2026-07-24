import "dotenv/config";

/**
 * db push / db seed 가 운영 DB 를 향하고 있으면 막습니다.
 *
 * push 는 컬럼을 지우는 파괴적 작업입니다. 운영 DB 에 한 번 들어가면 배포된 앱이
 * 즉시 깨지고, 되돌릴 방법도 없습니다. 실수로 운영 연결 문자열을 .env 에 붙여넣는
 * 것만으로 그렇게 되므로 여기서 한 번 걸러냅니다.
 *
 * 보호 대상은 두 곳에서 옵니다:
 *   1. 아래 BUILT_IN_PROTECTED_HOSTS — 운영 DB 는 설정과 무관하게 항상 막힙니다.
 *   2. .env 의 PROTECTED_DB_HOSTS — 각자 추가로 보호할 호스트가 있으면 여기 적습니다.
 *
 * 예전에는 (2)에만 의존했는데, .env 는 각자 관리라 아무도 채우지 않았고 — 값이 비면
 * 경고만 하고 통과했습니다. 그 틈으로 운영 DB 에 db push 가 실제로 들어갔습니다.
 * 그래서 운영 DB 하나는 코드에 박아 기본값으로 항상 막습니다.
 *
 * 한계: 이 가드는 package.json 의 db:push / db:seed 스크립트에서만 돕니다.
 * `prisma db push` 를 직접 치면 건너뜁니다 — 반드시 pnpm db:push 로 실행하세요.
 */

/**
 * 코드에 박아 두는 기본 보호 호스트 — 이 프로젝트의 운영 Neon DB.
 *
 * 호스트 이름은 비밀이 아닙니다. 접속에는 별도 자격증명이 필요하고, 이 값은 이미
 * 모두의 .env 와 배포 환경변수에 들어 있습니다. 여기 박아 두는 건 "누가 .env 를
 * 어떻게 두든 이 DB 로 가는 push 는 막는다" 를 보장하기 위해서입니다.
 * 개인 Neon 브랜치는 호스트가 달라 영향받지 않습니다.
 */
const BUILT_IN_PROTECTED_HOSTS = ["ep-holy-scene-azik95w5.c-3.ap-southeast-1.aws.neon.tech"];

// Neon 은 같은 엔드포인트에 -pooler 가 붙은 호스트를 하나 더 줍니다. 둘은 같은 DB 라
// 한쪽만 적어도 막히도록 접미사를 떼고 비교합니다.
function normalize(host) {
  return host.trim().toLowerCase().replace("-pooler.", ".");
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[db] DATABASE_URL 이 없습니다. .env 를 확인하세요.");
  process.exit(1);
}

let host;
try {
  host = normalize(new URL(url).hostname);
} catch {
  console.error("[db] DATABASE_URL 을 URL 로 읽지 못했습니다. .env 를 확인하세요.");
  process.exit(1);
}

// 코드에 박은 기본값 + .env 추가분. 기본값이 늘 있으므로 "보호가 꺼진" 상태는 없습니다.
const protectedHosts = [
  ...BUILT_IN_PROTECTED_HOSTS.map(normalize),
  ...(process.env.PROTECTED_DB_HOSTS ?? "").split(",").map(normalize).filter(Boolean),
];

if (!protectedHosts.includes(host)) process.exit(0);

// 운영 DB 에 손대야 하는 경우(최초 baseline 등)를 위한 탈출구입니다. 한 줄 더 치게
// 만드는 것 자체가 목적이라, 조용히 통과시키지 않고 무엇을 했는지 남깁니다.
if (process.env.ALLOW_PROD_DB_WRITE === "1") {
  console.warn(`\n[db] ALLOW_PROD_DB_WRITE=1 — 보호된 DB(${host}) 에 그대로 실행합니다.\n`);
  process.exit(0);
}

console.error("\n" + "─".repeat(64));
console.error("[db] 보호된 DB 라서 멈췄습니다 — " + host);
console.error("");
console.error("     지금 DATABASE_URL 이 운영 DB 를 가리키고 있습니다.");
console.error("     여기에 db push / db seed 를 하면 배포된 앱이 바로 깨집니다.");
console.error("");
console.error("     스키마를 바꾸려면 마이그레이션을 만드세요:");
console.error("       pnpm db:migrate --name <이름>");
console.error("     (배포 빌드가 prisma migrate deploy 로 알아서 적용합니다)");
console.error("");
console.error("     로컬 작업이라면 .env 의 DATABASE_URL 을 자기 Neon 브랜치로 바꾸세요.");
console.error("     (README > 데이터베이스)");
console.error("─".repeat(64) + "\n");

process.exit(1);
