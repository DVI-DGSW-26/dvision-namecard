import { notFound } from "next/navigation";
import { cardImageResponse } from "@/lib/card-image";

/**
 * 명함 이미지 — 영문. 렌더는 국문과 같은 lib/card-image.tsx 를 씁니다.
 */
export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const response = await cardImageResponse(slug, "en");
  if (!response) notFound();
  return response;
}
