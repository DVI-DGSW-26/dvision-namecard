import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { cardTag } from "@/lib/card-cache";
import { prisma } from "@/lib/prisma";
import { employeeAdminSchema, fieldErrors } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

/**
 * 노출 여부(status)와 공개 주소(slug) 변경. (admin 전용)
 *
 * 프로필 저장(PATCH /api/employees/[id])과 라우트를 나눈 이유: 저쪽은 본인도 부를 수
 * 있습니다. 같은 스키마에 status 를 넣으면 직원이 자기 계정을 스스로 활성화할 수
 * 있게 되고, slug 를 넣으면 남의 주소를 선점할 수 있습니다.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = employeeAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const before = await prisma.employee.findUnique({
    where: { id },
    select: { slug: true, role: true },
  });
  if (!before) {
    return NextResponse.json({ error: "없는 직원입니다." }, { status: 404 });
  }

  /*
    마지막 관리자의 권한을 뺏지 않습니다.

    관리자가 0명이 되면 임직원 관리에 아무도 못 들어가고, 권한을 되돌릴 화면도
    관리자 전용이라 스스로 복구할 방법이 없어집니다. 그때는 서버에서 스크립트를
    돌려야 하는데 — 그게 바로 "개발자를 부르게 되는" 상황입니다.

    퇴사 처리도 같습니다. 마지막 관리자를 RESIGNED 로 바꾸면 로그인이 막힙니다.
  */
  const losesAdmin =
    before.role === "ADMIN" && (parsed.data.role !== "ADMIN" || parsed.data.status === "RESIGNED");
  if (losesAdmin) {
    const admins = await prisma.employee.count({
      where: { role: "ADMIN", status: { not: "RESIGNED" } },
    });
    if (admins <= 1) {
      return NextResponse.json(
        { error: "마지막 관리자입니다. 다른 사람을 관리자로 지정한 뒤에 바꿔 주세요." },
        { status: 409 },
      );
    }
  }

  try {
    const after = await prisma.employee.update({
      where: { id },
      data: parsed.data,
      select: { slug: true },
    });

    // 주소가 바뀌면 옛 주소의 이미지 캐시도 지웁니다. 안 그러면 지금은 404 여야 할
    // 주소가 최대 60 초 동안 예전 명함을 계속 내보냅니다.
    revalidateTag(cardTag(before.slug), { expire: 0 });
    if (after.slug !== before.slug) revalidateTag(cardTag(after.slug), { expire: 0 });

    return NextResponse.json({ ok: true });
  } catch (cause: unknown) {
    const code =
      typeof cause === "object" && cause !== null && "code" in cause ? cause.code : null;
    if (code === "P2002") {
      return NextResponse.json({ errors: { slug: "이미 사용 중인 주소입니다." } }, { status: 409 });
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "이미 삭제된 직원입니다." }, { status: 404 });
    }
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
