import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildSlug } from "../src/lib/slug";

/**
 * 개발 화면 확인용 더미 직원 40명. `corepack pnpm tsx scripts/seed-dummy.ts` 로 실행합니다.
 *
 * prisma/seed.ts 와 분리해 둔 이유: 저건 실제로 필요한 최소 데이터고, 이건 목록 화면의
 * 페이지네이션·필터를 눈으로 보려고 부풀린 데이터입니다. 섞이면 지우기 곤란해집니다.
 *
 * 되돌리기: `corepack pnpm tsx scripts/seed-dummy.ts --clean`
 * (이메일이 @dummy.dvi-ind.com 인 직원만 지웁니다. 실제 시드 데이터는 건드리지 않습니다.)
 */

/** 실제 데이터와 섞이지 않도록 더미는 이 도메인만 씁니다. 삭제 기준이기도 합니다. */
const DUMMY_DOMAIN = "dummy.dvi-ind.com";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const FAMILY = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황"];
const GIVEN = [
  "도현", "서준", "지원", "한별", "유진", "민서", "예린", "수아", "지호", "하윤",
  "건우", "서연", "나연", "채원", "은우", "다은", "시우", "지안", "주호", "가율",
];
const DEPARTMENTS = ["경영지원", "영업", "생산기술", "품질보증", "구매", "R&D", "생산관리"];
const RANKS = ["사원", "주임", "대리", "과장", "차장", "부장", "이사"] as const;
const STATUSES = ["ACTIVE", "ACTIVE", "ACTIVE", "PENDING", "RESIGNED"] as const;

/**
 * 목록에서 값을 하나 고릅니다. 항목마다 다른 offset 을 줘서 조합이 겹치지 않게 합니다.
 *
 * Math.random 을 쓰지 않는 이유: 실행할 때마다 데이터가 달라지면 "아까 3페이지에 있던
 * 사람"을 다시 찾을 수 없습니다. 화면을 눈으로 비교하려면 매번 같은 결과여야 합니다.
 */
function pick<T>(list: readonly T[], seed: number): T {
  return list[(seed * 2654435761) % list.length];
}

async function main() {
  const clean = process.argv.includes("--clean");

  if (clean) {
    const { count } = await prisma.employee.deleteMany({
      where: { email: { endsWith: `@${DUMMY_DOMAIN}` } },
    });
    console.log(`더미 직원 ${count}명 삭제`);
    return;
  }

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error("회사 정보가 없습니다. 먼저 `pnpm db:seed` 를 실행하세요.");
  }

  // slug 는 unique 라 이미 쓰이는 값을 피해야 합니다. buildSlug 에 넘길 목록을 모아 둡니다.
  const taken = new Set((await prisma.employee.findMany({ select: { slug: true } })).map((r) => r.slug));

  let created = 0;
  for (let i = 0; i < 40; i++) {
    const familyName = pick(FAMILY, i + 1);
    const givenName = pick(GIVEN, i + 7);
    const slug = buildSlug({ familyName, givenName }, taken);
    if (!slug) continue;
    taken.add(slug);

    // 수정일을 하루씩 벌려 목록 정렬(updatedAt desc)과 페이지네이션을 눈으로 확인합니다.
    const updatedAt = new Date(Date.UTC(2026, 6, 20) - i * 86_400_000);

    await prisma.employee.create({
      data: {
        slug,
        email: `${slug}@${DUMMY_DOMAIN}`,
        nameKo: `${familyName}${givenName}`,
        familyName,
        givenName,
        rank: pick(RANKS, i + 3),
        department: pick(DEPARTMENTS, i + 5),
        status: pick(STATUSES, i + 11),
        companyId: company.id,
        createdAt: updatedAt,
        updatedAt,
      },
    });
    created++;
  }

  const total = await prisma.employee.count();
  console.log(`더미 직원 ${created}명 생성 — 전체 ${total}명`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
