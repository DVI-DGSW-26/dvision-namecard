import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildVCard } from "@/lib/vcard";

type Context = {
  params: Promise<{ slug: string }>;
};

/**
 * .vcf 다운로드. (인증 불필요 — 공개 프로필의 "연락처 저장" 버튼이 호출)
 *
 * 페이지와 같은 조건으로 막습니다. RESIGNED 는 링크를 알아도 받을 수 없어야 하고,
 * 여기만 열려 있으면 프로필은 404 인데 연락처는 받아지는 구멍이 생깁니다.
 */
export async function GET(_request: NextRequest, { params }: Context) {
  const { slug } = await params;

  const employee = await prisma.employee.findUnique({
    where: { slug },
    include: { company: true },
  });

  if (!employee || employee.status === "RESIGNED") {
    return new Response("Not Found", { status: 404 });
  }

  const vcf = buildVCard(employee, employee.company);

  return new Response(vcf, {
    headers: {
      // charset 을 빼면 일부 안드로이드 기종이 한글을 깨뜨립니다.
      "content-type": "text/vcard; charset=utf-8",
      // 파일명은 slug 기준입니다. 한글 파일명은 클라이언트마다 인코딩이 갈립니다.
      "content-disposition": `attachment; filename="${slug}.vcf"`,
      // 연락처가 바뀌면 즉시 반영돼야 하므로 캐시하지 않습니다.
      "cache-control": "no-store",
    },
  });
}
