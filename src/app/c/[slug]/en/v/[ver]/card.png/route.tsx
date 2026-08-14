import { notFound } from "next/navigation";
import { cardImageResponse } from "@/lib/card-image";

/**
 * 명함 이미지 — 영문, 판 번호가 붙은 주소(/c/[slug]/en/v/<번호>/card.png).
 *
 * 국문판(/c/[slug]/v/[ver]/card.png)과 같은 이유로 있습니다. 렌더는 두 언어가
 * 같은 lib/card-image.tsx 를 씁니다.
 */
export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const response = await cardImageResponse(slug, "en");
  if (!response) notFound();
  return response;
}
