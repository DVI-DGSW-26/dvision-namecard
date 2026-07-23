import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { CARDS_TAG } from "@/lib/card-cache";
import { prisma } from "@/lib/prisma";
import { companyProfileSchema, fieldErrors } from "@/lib/validation";

/**
 * 회사 정보 수정. 관리자 세션만 허용합니다.
 *
 * 화면에서 회원에게 disabled 로 보여주는 것과 별개로 여기서 다시 막아야 합니다.
 * disabled 는 UI 장치일 뿐 API 를 직접 호출하는 걸 막지 못합니다.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = companyProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  try {
    // Company 는 1행만 존재하는 모델입니다.
    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      return NextResponse.json({ error: "회사 정보가 없습니다." }, { status: 404 });
    }

    await prisma.company.update({ where: { id: company.id }, data: parsed.data });

    // 회사 값(주소·팩스·대표번호)은 전 직원의 명함 이미지에 찍힙니다. 한 명씩 지울
    // 수 없으니 카드 전체에 걸어 둔 태그를 지웁니다.
    revalidateTag(CARDS_TAG, { expire: 0 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
