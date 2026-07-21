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
      // 회사 정보는 공개된 값이라 그대로 둡니다. 아래 3개는 시안 기준이고,
      // 기존 시드에는 "DVISION Inc." / 대구광역시 달성군 구지면 국가산단대로33길 237 /
      // 053-710-1022 로 되어 있었습니다. 실제 값이 어느 쪽인지 확인되면 여기만 고치세요.
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
    },
  });

  /*
   * 직원 데이터는 전부 가짜입니다.
   *
   * 이 파일은 git 에 커밋되므로 실존 인물의 개인 연락처를 넣지 마세요. 한 번 커밋되면
   * 나중에 지워도 히스토리에 남습니다. 실제 임직원 정보는 배포 후 /admin 에서 입력합니다.
   *
   * 휴대번호는 010-1234-5678 처럼 한눈에 가짜인 걸 알 수 있는 값만 씁니다.
   * 슬러그는 성만 짧게 — lib/slug.ts 규칙과 같습니다. (홍 → hong)
   */
  const employees = [
    {
      slug: "hong",
      email: "hong@dvi-ind.com",
      nameKo: "홍길동",
      // vCard N 필드를 `홍;길동;;;` 로 만들기 위해 분리 저장합니다. 합치지 말 것.
      familyName: "홍",
      givenName: "길동",
      nameEn: "Gil-dong Hong",
      rank: "대표이사",
      credential: "공학박사",
      telWork: "031-355-1234",
      telMobile: "010-1234-5678",
      mobilePublic: true,
      bio: "더 가볍고 강한 부품과 스마트한 제조로 미래를 만듭니다",
      status: "ACTIVE",
    },
    {
      // 같은 성이 겹쳤을 때 slug 가 hong2 로 붙는 걸 확인하기 위한 데이터입니다.
      slug: "hong2",
      email: "hong.mj@dvi-ind.com",
      nameKo: "홍민지",
      familyName: "홍",
      givenName: "민지",
      rank: "부장",
      // 직급(부장)과 직책(팀장)이 다른 케이스 — 카드에서 둘 다 나오는지 확인용입니다.
      position: "기술영업팀장",
      department: "기술영업팀",
      telWork: "031-355-1235",
      telMobile: "010-2345-6789",
      // 휴대번호 비공개 상태 — 서명과 카드에서 M 항목이 빠지는지 확인용입니다.
      mobilePublic: false,
      status: "ACTIVE",
    },
    // 아래 2명은 "아직 정보를 입력하지 않은" 상태를 테스트하기 위한 데이터입니다.
    // 이름/이메일만 관리자가 등록해 둔 상황을 가정합니다.
    {
      slug: "kim",
      email: "kim@dvi-ind.com",
      nameKo: "김철수",
      familyName: "김",
      givenName: "철수",
      rank: "과장",
      status: "PENDING",
    },
    {
      slug: "lee",
      email: "lee@dvi-ind.com",
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

  console.log(`시드 완료 — 회사 1곳, 직원 ${employees.length}명 (전부 테스트용 가짜 데이터)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
