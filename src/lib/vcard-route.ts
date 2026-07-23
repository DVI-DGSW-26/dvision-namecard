import type { Lang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";
import { buildVCard } from "@/lib/vcard";
import { companyOfficesInclude, employeeOrgInclude } from "@/types";

/**
 * .vcf 응답. 국문(/c/[slug]/vcard)과 영문(/c/[slug]/en/vcard)이 함께 씁니다.
 *
 * 페이지와 같은 조건으로 막습니다. RESIGNED 는 링크를 알아도 받을 수 없어야 하고,
 * 여기만 열려 있으면 프로필은 404 인데 연락처는 받아지는 구멍이 생깁니다.
 */
export async function vcardResponse(slug: string, lang: Lang): Promise<Response | null> {
  const employee = await prisma.employee.findUnique({
    where: { slug },
    include: { company: { include: companyOfficesInclude }, ...employeeOrgInclude },
  });

  if (!employee || employee.status === "RESIGNED") return null;

  const vcf = buildVCard(employee, employee.company, lang);

  return new Response(vcf, {
    headers: {
      // charset 을 빼면 일부 안드로이드 기종이 한글을 깨뜨립니다.
      "content-type": "text/vcard; charset=utf-8",
      // 파일명은 slug 기준입니다. 한글 파일명은 클라이언트마다 인코딩이 갈립니다.
      // 영문판은 뒤에 -en 을 붙여, 둘을 받아도 파일이 서로 덮어쓰지 않게 합니다.
      "content-disposition": `attachment; filename="${slug}${lang === "en" ? "-en" : ""}.vcf"`,
      // 연락처가 바뀌면 즉시 반영돼야 하므로 캐시하지 않습니다.
      "cache-control": "no-store",
    },
  });
}
