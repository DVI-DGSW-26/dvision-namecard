import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

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

/*
 * 조직 목록 초기값 — 회사가 준 표 그대로입니다.
 *
 * 직원 데이터와 달리 이건 가짜가 아닙니다. 배포 후 관리자가 /admin/org 에서
 * 고칠 수 있으므로, 여기 값은 "처음 한 번 채워 주는" 용도입니다.
 * upsert 라 이미 있는 항목의 이름·순서는 건드리지 않습니다.
 *
 * sortOrder 는 10 단위입니다. 나중에 사이에 끼워 넣을 때 뒤를 전부 밀지 않아도 됩니다.
 */

/** 직위 — 매니저 · 연구원 · 엔지니어 트랙 각 4단계. (ML/RL/EL 코드는 넣지 않습니다) */
const RANKS = [
  ["매니저", "Manager"],
  ["선임매니저", "Senior Manager"],
  ["책임매니저", "Principal Manager"],
  ["수석매니저", "Chief Manager"],
  ["연구원", "Researcher"],
  ["선임연구원", "Senior Researcher"],
  // 원본 표에서 이 칸의 영문이 가려져 있어 같은 단계(Principal)를 따랐습니다.
  ["책임연구원", "Principal Researcher"],
  ["수석연구원", "Chief Researcher"],
  ["엔지니어", "Engineer"],
  ["선임엔지니어", "Senior Engineer"],
  ["책임엔지니어", "Principal Engineer"],
  ["수석엔지니어", "Chief Engineer"],
] as const;

/** 임원 직책 — 약어와 정식 명칭을 함께 둡니다. 명함 레이아웃에 맞춰 골라 쓰면 됩니다. */
const EXECUTIVE_TITLES = [
  ["대표이사", "CEO", "Chief Executive Officer"],
  ["생산운영총괄", "COO", "Chief Operating Officer"],
  ["기술총괄", "CTO", "Chief Technology Officer"],
  ["전략기획총괄", "CSO", "Chief Strategy Officer"],
  ["재무총괄", "CFO", "Chief Financial Officer"],
] as const;

/**
 * 직책.
 *
 * 고문은 분야를 나누지 않습니다. 원본 표에 "Technical, Strategic, Manufacturing 등"
 * 이라고 적혀 있지만 명함에는 그냥 "고문" 으로 나갑니다. 분야까지 찍을 일이 생기면
 * 관리자가 /admin/org 에서 항목을 늘리면 됩니다.
 */
const POSITIONS = [
  ["팀원", "Team Member"],
  ["팀장", "Team Leader"],
  ["공장총괄", "Plant Manager"],
  ["연구소장", "Director, Corporate R&D"],
  ["고문", "Advisor"],
] as const;

/**
 * 부서 — 팀과 그 아래 파트.
 *
 * 영문 표기는 아직 받지 못해 비워 뒀습니다. 관리자가 /admin/org 에서 채우면 됩니다.
 */
const TEAMS = [
  { name: "경영관리", parts: ["회계/재무", "인사/총무"] },
  { name: "사업운영", parts: ["구매", "사업관리", "영업운영", "제조/생산관리"] },
  { name: "기술영업", parts: ["개발영업", "품질관리"] },
  { name: "기업부설연구소", parts: ["기술개발", "기술지원"] },
] as const;

/**
 * 사업장 — 회사가 준 실제 주소입니다.
 *
 * 명함에는 여기 등록된 곳이 전부 `(43011) 대구시 …` 형태로 찍힙니다.
 * 시안에 있던 "경기 화성시 팔탄면 서봉로 1013" 은 실제 주소가 아닙니다 — 되돌리지 마세요.
 */
const OFFICES = [
  { name: "본사", postalCode: "43011", address: "대구시 달성군 구지면 국가산단대로33길 237" },
  { name: "R&D센터", postalCode: "41585", address: "대구 북구 홈암로 51" },
] as const;

async function seedOffices(companyId: string) {
  for (const [index, office] of OFFICES.entries()) {
    // 사업장은 이름에 unique 가 없습니다(회사가 늘면 같은 이름이 생길 수 있음).
    // 시드는 회사+이름으로 이미 있는지 보고 없을 때만 만듭니다.
    const existing = await prisma.office.findFirst({
      where: { companyId, name: office.name },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.office.create({
      data: { ...office, sortOrder: (index + 1) * 10, companyId },
    });
  }
  console.log(`사업장 ${OFFICES.length}곳`);
}

async function seedOrg() {
  for (const [index, [name, nameEn]] of RANKS.entries()) {
    await prisma.rank.upsert({
      where: { name },
      update: {},
      create: { name, nameEn, sortOrder: (index + 1) * 10 },
    });
  }

  for (const [index, [name, nameEn, nameEnFull]] of EXECUTIVE_TITLES.entries()) {
    await prisma.executiveTitle.upsert({
      where: { name },
      update: {},
      create: { name, nameEn, nameEnFull, sortOrder: (index + 1) * 10 },
    });
  }

  for (const [index, [name, nameEn]] of POSITIONS.entries()) {
    await prisma.position.upsert({
      where: { name },
      update: {},
      create: { name, nameEn, sortOrder: (index + 1) * 10 },
    });
  }

  for (const [teamIndex, team] of TEAMS.entries()) {
    const row = await prisma.team.upsert({
      where: { name: team.name },
      update: {},
      create: { name: team.name, nameEn: "", sortOrder: (teamIndex + 1) * 10 },
    });
    for (const [partIndex, part] of team.parts.entries()) {
      await prisma.part.upsert({
        where: { teamId_name: { teamId: row.id, name: part } },
        update: {},
        create: { name: part, nameEn: "", sortOrder: (partIndex + 1) * 10, teamId: row.id },
      });
    }
  }

  console.log(
    `조직 목록 — 직위 ${RANKS.length} · 임원직책 ${EXECUTIVE_TITLES.length} · ` +
      `직책 ${POSITIONS.length} · 팀 ${TEAMS.length}`,
  );
}

/** 시드에서 파트를 연결할 때 필요한 팀 id. 이름은 unique 라 한 건만 나옵니다. */
async function teamIdOf(name: string): Promise<string> {
  const team = await prisma.team.findUniqueOrThrow({ where: { name }, select: { id: true } });
  return team.id;
}

async function main() {
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      nameKo: "(주)디비전",
      // 회사 정보는 공개된 값이라 그대로 둡니다.
      // 주소는 운영 DB 값에 맞췄습니다. 시안에 있던 "경기 화성시 팔탄면 서봉로 1013" 은
      // 실제 주소가 아닙니다 — 되돌리지 마세요.
      nameEn: "DVISION Co., Ltd.",
      // 주소는 Office 표에 있습니다 — 아래 seedOffices 를 보세요.
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

  await seedOrg();
  await seedOffices(company.id);

  /*
   * 직원 데이터는 전부 가짜입니다.
   *
   * 이 파일은 git 에 커밋되므로 실존 인물의 개인 연락처를 넣지 마세요. 한 번 커밋되면
   * 나중에 지워도 히스토리에 남습니다. 실제 임직원 정보는 배포 후 /admin 에서 입력합니다.
   *
   * 휴대번호는 010-1234-5678 처럼 한눈에 가짜인 걸 알 수 있는 값만 씁니다.
   * 슬러그는 성만 짧게 — lib/slug.ts 규칙과 같습니다. (홍 → hong)
   */
  /**
   * 조직 값은 id 가 아니라 이름으로 적습니다. 시드에 id 를 박으면 목록을 지웠다
   * 다시 만든 순간 어긋나고, 관리자가 이름을 바꿨을 때 어느 쪽이 맞는지 알 수 없습니다.
   */
  type SeedEmployee = {
    slug: string;
    email: string;
    nameKo: string;
    familyName: string;
    givenName: string;
    nameEn?: string;
    rank?: string;
    executiveTitle?: string;
    position?: string;
    team?: string;
    part?: string;
    credential?: string;
    telWork?: string;
    telMobile?: string;
    mobilePublic?: boolean;
    bio?: string;
    status: "PENDING" | "ACTIVE" | "RESIGNED";
  };

  const employees: SeedEmployee[] = [
    {
      slug: "hong",
      email: "hong@dvi-ind.com",
      nameKo: "홍길동",
      // vCard N 필드를 `홍;길동;;;` 로 만들기 위해 분리 저장합니다. 합치지 말 것.
      familyName: "홍",
      givenName: "길동",
      nameEn: "Gil-dong Hong",
      // 직위 · 임원 직책 · 직책을 한꺼번에 가진 케이스 — 카드에 셋 다 나오는지 확인용입니다.
      rank: "수석매니저",
      executiveTitle: "대표이사",
      position: "팀원",
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
      rank: "책임매니저",
      // 임원이 아닌 케이스 — 카드에서 임원 직책만 빠지는지 확인용입니다.
      position: "팀장",
      team: "기술영업",
      part: "개발영업",
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
      rank: "선임매니저",
      position: "팀원",
      team: "경영관리",
      part: "회계/재무",
      status: "PENDING",
    },
    {
      slug: "lee",
      email: "lee@dvi-ind.com",
      nameKo: "이영희",
      familyName: "이",
      givenName: "영희",
      // 직위만 있고 나머지는 비어 있는 케이스 — 카드가 한 조각만으로도 그려지는지 확인용입니다.
      rank: "매니저",
      status: "PENDING",
    },
  ];

  for (const { rank, executiveTitle, position, team, part, ...rest } of employees) {
    const create: Prisma.EmployeeCreateInput = {
      ...rest,
      // 관계를 connect 로 잇는 순간 companyId 같은 raw 외래키는 같이 못 씁니다.
      company: { connect: { id: company.id } },
    };
    if (rank) create.rank = { connect: { name: rank } };
    if (executiveTitle) create.executiveTitle = { connect: { name: executiveTitle } };
    if (position) create.position = { connect: { name: position } };
    if (team) create.team = { connect: { name: team } };
    // 파트 이름은 팀 안에서만 유일해서 팀 id 와 함께 찾아야 합니다.
    if (team && part) {
      create.part = { connect: { teamId_name: { teamId: await teamIdOf(team), name: part } } };
    }

    await prisma.employee.upsert({ where: { slug: rest.slug }, update: {}, create });
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
