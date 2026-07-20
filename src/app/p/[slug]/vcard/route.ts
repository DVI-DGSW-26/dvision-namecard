import { NextResponse, type NextRequest } from "next/server";

type Context = {
  params: Promise<{ slug: string }>;
};

/**
 * .vcf 다운로드. (스텁)
 * 구현 시: employee 조회 → buildVCard() → Content-Type: text/vcard; charset=utf-8,
 * Content-Disposition: attachment; filename="<slug>.vcf" 로 응답.
 */
export async function GET(_request: NextRequest, { params }: Context) {
  const { slug } = await params;
  return NextResponse.json({ todo: "vcard", slug }, { status: 501 });
}
