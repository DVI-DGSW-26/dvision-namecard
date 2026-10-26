import { revalidateTag, unstable_cache } from "next/cache";
import { CARDS_TAG } from "@/lib/card-cache";
import { api } from "@/lib/api";
import type { OrgLists } from "@/lib/org";

/**
 * 조직 목록의 DB 접근. 서버 컴포넌트와 API 라우트가 함께 씁니다.
 *
 * lib/org.ts 와 나눠 둔 이유: org.ts 는 클라이언트 컴포넌트도 import 하는 타입·스키마
 * 모듈입니다. 거기에 서버 호출(lib/api)을 끌어들이면 브라우저 번들에 서버 코드가 딸려 들어갑니다.
 */

/**
 * 조직 목록 캐시의 태그.
 *
 * 이 목록은 관리자가 가끔 바꾸는 설정값인데, 읽는 쪽(/edit)은 사람이 화면을
 * 기다리고 있는 자리입니다. 명함 서버를 한 번 거쳐 DB 까지 왕복해야 하므로,
 * 매 요청마다 읽으면 화면이 그만큼 늦게 뜹니다. 그래서 캐시하고,
 * 쓰기 라우트가 invalidateOrgCache() 로 지웁니다.
 */
export const ORG_TAG = "org";

/** 다섯 목록을 명함 서버에서 한 번에 받습니다. 팀에는 파트가 붙어 옵니다. */
async function queryOrgLists(): Promise<OrgLists> {
  return api<OrgLists>("/org");
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
