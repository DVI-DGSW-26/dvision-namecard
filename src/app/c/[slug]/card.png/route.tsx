import { notFound } from "next/navigation";
import { cardImageResponse } from "@/lib/card-image";

/**
 * 명함 이미지 — 국문. 이메일 서명이 이 주소를 그대로 씁니다.
 *
 * 렌더는 lib/card-image.tsx 한 곳에 있습니다. 영문판(/c/[slug]/en/card.png)과
 * 같은 코드를 쓰므로 레이아웃을 한쪽만 고치는 사고가 나지 않습니다.
 *
 * prisma·폰트 fetch 때문에 Node 런타임이어야 합니다.
 */
export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const response = await cardImageResponse(slug, "ko");
  if (!response) notFound();
  return response;
}
