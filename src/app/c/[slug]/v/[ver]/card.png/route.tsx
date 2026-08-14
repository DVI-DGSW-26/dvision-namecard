import { notFound } from "next/navigation";
import { cardImageResponse } from "@/lib/card-image";

/**
 * 명함 이미지 — 국문, 판 번호가 붙은 주소(/c/[slug]/v/<번호>/card.png).
 *
 * 이메일 서명이 이 주소를 씁니다. 번호는 읽지 않습니다 — slug 와 언어만으로 굽고,
 * 번호는 프로필을 고쳤을 때 주소를 다르게 만드는 것 자체가 목적입니다(Gmail 이미지
 * 프록시가 담아 둔 옛 명함을 계속 내놓는 걸 피하려고). lib/signature.ts 의
 * cardVersion 주석에 이력이 있습니다.
 *
 * 번호 없는 /c/[slug]/card.png 도 그대로 살아 있습니다. 이미 나간 서명들이 그 주소를
 * 쓰고 있어서 지우면 그동안 보낸 메일의 명함이 전부 깨집니다.
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
