import { revalidateTag, unstable_cache } from "next/cache";
import { CARDS_TAG } from "@/lib/card-cache";
import { prisma } from "@/lib/prisma";
import { DEFAULT_POSITION_NAME, type OrgLists } from "@/lib/org";

/**
 * 조직 목록의 DB 접근. 서버 컴포넌트와 API 라우트가 함께 씁니다.
 *
 * lib/org.ts 와 나눠 둔 이유: org.ts 는 클라이언트 컴포넌트도 import 하는 타입·스키마
 * 모듈입니다. 거기에 prisma 를 끌어들이면 브라우저 번들에 서버 코드가 딸려 들어갑니다.
 */

const ORDER = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

/**
 * 조직 목록 캐시의 태그.
 *
 * 이 목록은 관리자가 가끔 바꾸는 설정값인데, 읽는 쪽(/edit)은 사람이 화면을
 * 기다리고 있는 자리입니다. DB 가 싱가포르에 있어 왕복 한 번이 약 80ms 라,
 * 매 요청마다 다섯 번을 왕복하면 그것만으로 150ms 가 넘습니다. 그래서 캐시하고,
 * 쓰기 라우트가 invalidateOrgCache() 로 지웁니다.
 */
export const ORG_TAG = "org";

async function queryOrgLists(): Promise<OrgLists> {
  const [ranks, executiveTitles, positions, teams, offices] = await Promise.all([
    prisma.rank.findMany({ orderBy: ORDER }),
    prisma.executiveTitle.findMany({ orderBy: ORDER }),
    prisma.position.findMany({ orderBy: ORDER }),
    prisma.team.findMany({
      orderBy: ORDER,
      include: { parts: { orderBy: ORDER } },
      // 팀과 파트를 따로 읽지 않고 한 번에 조인합니다. (schema.prisma 의 relationJoins)
      relationLoadStrategy: "join",
    }),
    prisma.office.findMany({
      orderBy: ORDER,
      select: {
        id: true,
        name: true,
        postalCode: true,
        address: true,
        addressEn: true,
        sortOrder: true,
      },
    }),
  ]);
  return { ranks, executiveTitles, positions, teams, offices };
}

/**
 * 목록 전부를 한 번에 읽습니다. 폼과 관리 화면이 항상 전부 필요합니다.
 *
 * 캐시에 담기는 값에 Date 가 없어야 합니다 — unstable_cache 는 JSON 으로 저장하므로
 * Date 를 넣으면 꺼낼 때 문자열이 되어 타입만 맞고 값이 다른 상태가 됩니다.
 * 다섯 모델 모두 createdAt/updatedAt 이 없어서 지금은 안전합니다. 타임스탬프를
 * 추가하게 되면 여기서 select 로 걸러내세요.
 */
export const readOrgLists = unstable_cache(queryOrgLists, ["org-lists"], {
  tags: [ORG_TAG],
  // 정상 경로는 아래 invalidateOrgCache() 입니다. 이 값은 어딘가에서 무효화를
  // 빠뜨렸을 때 스스로 낫기 위한 상한이지, 신선도를 책임지는 장치가 아닙니다.
  revalidate: 300,
});

/**
 * 조직 목록을 바꾼 뒤 캐시를 지웁니다. 쓰기 라우트가 저장 직후에 부릅니다.
 *
 * 명함 이미지까지 함께 지우는 이유: 직위·부서·사업장 주소는 카드 PNG 에 그대로
 * 찍힙니다. 목록만 지우면 편집 화면은 새 이름인데 이미지와 이메일 서명은 옛
 * 이름을 최대 60초 더 들고 있습니다.
 */
export function invalidateOrgCache(): void {
  revalidateTag(ORG_TAG, { expire: 0 });
  revalidateTag(CARDS_TAG, { expire: 0 });
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
