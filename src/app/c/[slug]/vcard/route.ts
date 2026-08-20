import { type NextRequest } from "next/server";
import { vcardResponse } from "@/lib/vcard-route";

type Context = {
  params: Promise<{ slug: string }>;
};

/**
 * .vcf 다운로드 — 국문. (인증 불필요)
 *
 * 공개 카드의 "연락처 저장" 버튼이 이 주소로 옵니다. 받은 사람의 폰이 연락처 앱을
 * 열어 값이 채워진 화면을 보여 주고, 거기서 저장을 한 번 누르면 주소록에 들어갑니다.
 *
 * 내용 조립은 lib/vcard-route.ts 에 있습니다 — 영문판과 같은 코드를 씁니다.
 */
export async function GET(_request: NextRequest, { params }: Context) {
  const { slug } = await params;
  return (await vcardResponse(slug, "ko")) ?? new Response("Not Found", { status: 404 });
}
