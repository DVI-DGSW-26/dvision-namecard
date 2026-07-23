import { type NextRequest } from "next/server";
import { vcardResponse } from "@/lib/vcard-route";

type Context = {
  params: Promise<{ slug: string }>;
};

/**
 * .vcf 다운로드 — 국문. (인증 불필요)
 *
 * 공개 카드의 "연락처 저장" 버튼은 홈페이지 바로가기로 바뀌어 지금은 화면에서
 * 이 주소를 부르는 곳이 없습니다. 주소로 직접 받는 건 그대로 되고, 나중에 저장
 * 버튼을 다시 붙일 수도 있어 라우트는 남겨 둡니다.
 *
 * 내용 조립은 lib/vcard-route.ts 에 있습니다 — 영문판과 같은 코드를 씁니다.
 */
export async function GET(_request: NextRequest, { params }: Context) {
  const { slug } = await params;
  return (await vcardResponse(slug, "ko")) ?? new Response("Not Found", { status: 404 });
}
