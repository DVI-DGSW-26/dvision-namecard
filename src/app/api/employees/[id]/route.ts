import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { employeeProfileSchema, fieldErrors } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

/**
 * 직원 정보 저장.
 *
 * middleware 는 /api/* 를 지나가지 않으므로 여기서 직접 세션을 확인합니다.
 * slug 와 status 는 이 엔드포인트로 바꿀 수 없습니다 — 공개 URL 과 노출 여부에
 * 직결되는 값이라 관리자 화면에서만 다룹니다. 스키마에 아예 없으니 body 에
 * 끼워 넣어도 무시됩니다.
 *
 * 공용 비밀번호 구조라 세션만으로는 "본인"을 특정할 수 없습니다. 즉 세션이 있는
 * 사람은 누구나 아무 id 나 수정할 수 있습니다. 사내 도구라 지금은 허용하지만,
 * 감사 로그가 필요해지면 ProfileView.action 에 남기는 걸 검토하세요.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = employeeProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  try {
    await prisma.employee.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
