import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * 개발용 시드. `pnpm db:seed` 로 실행합니다.
 *
 * 여러 번 실행해도 같은 결과가 되도록 전부 upsert 를 씁니다.
 * Company 는 1행만 존재하는 모델이라 고정 id 를 박아 upsert 대상을 특정합니다.
 */

const COMPANY_ID = "dvision";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      nameKo: "(주)디비전",
      nameEn: "DVISION Inc.",
      address: "대구광역시 달성군 구지면 국가산단대로33길 237",
      tel: "053-710-1022",
      fax: "053-715-2096",
      logoUrl: "/brand/logo.png",
      brandColor: "#6B4EE6",
      tagline: "알루미늄 압출 · 정밀가공 | 자동차 경량 부품 전문",
      certifications: ["IATF 16949", "ISO 9001"],
      // 회사 소개 페이지에 노출할 지표. 형태는 아직 확정 전이라 비워둡니다.
      stats: [],
    },
  });

  const employees = [
    {
      slug: "yg-ryu",
      email: "yg.ryu@dvi-ind.com",
      nameKo: "류영균",
      // vCard N 필드를 `류;영균;;;` 로 만들기 위해 분리 저장합니다. 합치지 말 것.
      familyName: "류",
      givenName: "영균",
      rank: "대표이사",
      credential: "공학박사",
      telWork: "053-710-1022",
      telMobile: "010-3131-6834",
      bio: "더 가볍고 강한 부품과 스마트한 제조로 미래를 만듭니다",
      status: "ACTIVE",
    },
    // 아래 2명은 "아직 정보를 입력하지 않은" 상태를 테스트하기 위한 데이터입니다.
    // 이름/이메일만 관리자가 등록해 둔 상황을 가정합니다.
    {
      slug: "pending-1",
      email: "pending1@dvi-ind.com",
      nameKo: "김철수",
      familyName: "김",
      givenName: "철수",
      rank: "과장",
      status: "PENDING",
    },
    {
      slug: "pending-2",
      email: "pending2@dvi-ind.com",
      nameKo: "이영희",
      familyName: "이",
      givenName: "영희",
      rank: "대리",
      status: "PENDING",
    },
  ] as const;

  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { slug: employee.slug },
      update: {},
      create: { ...employee, companyId: company.id },
    });
  }

  console.log(`시드 완료 — 회사 1곳, 직원 ${employees.length}명`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
