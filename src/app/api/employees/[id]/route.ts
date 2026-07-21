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
 * 신원은 게이트에서 사내 이메일로 확인해 세션에 employeeId 로 담깁니다. 회원은
 * 본인 것만, 관리자는 아무나 수정할 수 있습니다. 다만 공용 비밀번호를 아는 사람은
 * 남의 이메일로 로그인할 수 있어 사칭 자체는 막지 못합니다.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;

  // 회원은 본인 것만 고칠 수 있습니다. 관리자는 임직원 관리에서 남의 것도 고칩니다.
  // 화면에서 막는 것과 별개로 여기서 다시 확인해야 합니다 — API 는 직접 호출됩니다.
  if (session.role !== "admin" && session.employeeId !== id) {
    return NextResponse.json({ error: "본인의 명함만 수정할 수 있습니다." }, { status: 403 });
  }

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
