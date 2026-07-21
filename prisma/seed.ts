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
      // 시안 기준. 기존 시드는 "DVISION Inc." 였습니다. (아래 주석 참고)
      nameEn: "DVISION Co., Ltd.",
      address: "경기 화성시 팔탄면 서봉로 1013",
      tel: "031-355-1234",
      fax: "053-715-2096",
      logoUrl: "/brand/logo.png",
      brandColor: "#931B82",
      homepageUrl: "dvi-ind.com",
      // 시안에서는 industry 와 tagline 이 두 줄로 나뉘어 표시됩니다.
      industry: "알루미늄 압출 · 정밀가공",
      tagline: "자동차 경량 부품 전문",
      certifications: ["IATF 16949", "ISO 9001"],
      foundedYear: 1998,
      capacity: 12000,
      equipmentCount: 86,
      employeeCount: 142,
    },
  });

  const employees = [
    {
      // 슬러그 규칙이 "성만 짧게" 로 바뀌었습니다. (lib/slug.ts — 류 → ryu)
      slug: "ryu",
      // 시안 기준. 기존 시드는 yg.ryu@ / 053-710-1022 / 010-3131-6834 였습니다.
      email: "yk.ryu@dvi-ind.com",
      nameKo: "류영균",
      // vCard N 필드를 `류;영균;;;` 로 만들기 위해 분리 저장합니다. 합치지 말 것.
      familyName: "류",
      givenName: "영균",
      nameEn: "Yeong-gyun Ryu",
      rank: "대표이사",
      credential: "공학박사",
      telWork: "031-355-1234",
      telMobile: "010-4821-7739",
      mobilePublic: true,
      bio: "더 가볍고 강한 부품과 스마트한 제조로 미래를 만듭니다",
      status: "ACTIVE",
    },
    // 아래 2명은 "아직 정보를 입력하지 않은" 상태를 테스트하기 위한 데이터입니다.
    // 이름/이메일만 관리자가 등록해 둔 상황을 가정합니다.
    {
      slug: "kim",
      email: "pending1@dvi-ind.com",
      nameKo: "김철수",
      familyName: "김",
      givenName: "철수",
      rank: "과장",
      status: "PENDING",
    },
    {
      slug: "lee",
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
