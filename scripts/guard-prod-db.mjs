import "dotenv/config";

/**
 * db push / db seed 가 운영 DB 를 향하고 있으면 막습니다.
 *
 * push 는 컬럼을 지우는 파괴적 작업입니다. 운영 DB 에 한 번 들어가면 배포된 앱이
 * 즉시 깨지고, 되돌릴 방법도 없습니다. 실수로 운영 연결 문자열을 .env 에 붙여넣는
 * 것만으로 그렇게 되므로 여기서 한 번 걸러냅니다.
 *
 * 보호할 호스트는 .env 의 PROTECTED_DB_HOSTS 에 적습니다. 값이 없으면 경고만 하고
 * 통과시킵니다 — 이 스크립트는 마지막 안전망이지, 권한 분리를 대신하지 못합니다.
 * 진짜 차단은 운영 연결 문자열을 각자 .env 에서 없애고 배포 환경변수에만 두는 것입니다.
 */

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

const protectedHosts = (process.env.PROTECTED_DB_HOSTS ?? "")
  .split(",")
  .map(normalize)
  .filter(Boolean);

if (protectedHosts.length === 0) {
  console.warn("\n[db] PROTECTED_DB_HOSTS 가 비어 있어 운영 DB 보호가 꺼져 있습니다. (.env.example 참고)\n");
  process.exit(0);
}

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
