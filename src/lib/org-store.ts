import { prisma } from "@/lib/prisma";
import { DEFAULT_POSITION_NAME, type OrgLists } from "@/lib/org";

/**
 * 조직 목록의 DB 접근. 서버 컴포넌트와 API 라우트가 함께 씁니다.
 *
 * lib/org.ts 와 나눠 둔 이유: org.ts 는 클라이언트 컴포넌트도 import 하는 타입·스키마
 * 모듈입니다. 거기에 prisma 를 끌어들이면 브라우저 번들에 서버 코드가 딸려 들어갑니다.
 */

const ORDER = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

/** 목록 전부를 한 번에 읽습니다. 폼과 관리 화면이 항상 전부 필요합니다. */
export async function readOrgLists(): Promise<OrgLists> {
  const [ranks, executiveTitles, positions, teams, offices] = await Promise.all([
    prisma.rank.findMany({ orderBy: ORDER }),
    prisma.executiveTitle.findMany({ orderBy: ORDER }),
    prisma.position.findMany({ orderBy: ORDER }),
    prisma.team.findMany({ orderBy: ORDER, include: { parts: { orderBy: ORDER } } }),
    prisma.office.findMany({
      orderBy: ORDER,
      select: { id: true, name: true, postalCode: true, address: true, sortOrder: true },
    }),
  ]);
  return { ranks, executiveTitles, positions, teams, offices };
}

/** 명함·서명·vCard 가 쓰는 사업장 목록. 순서는 관리 화면의 순서 그대로입니다. */
export async function readOffices() {
  return prisma.office.findMany({
    orderBy: ORDER,
    select: { id: true, name: true, postalCode: true, address: true },
  });
}

/**
 * 새 직원에게 붙일 기본 직책 id. 목록에 '팀원' 이 없으면 null 입니다.
 *
 * id 를 상수로 박지 않는 이유: 목록이 테이블이라 관리자가 이 항목을 지우거나
 * 이름을 바꿀 수 있습니다. 없으면 직책 없이 만들고 나중에 고르게 둡니다.
 */
export async function defaultPositionId(): Promise<string | null> {
  const row = await prisma.position.findUnique({
    where: { name: DEFAULT_POSITION_NAME },
    select: { id: true },
  });
  return row?.id ?? null;
}
