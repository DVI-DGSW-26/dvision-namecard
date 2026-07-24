import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { cardTag } from "@/lib/card-cache";
import { prisma } from "@/lib/prisma";
import { employeeProfileSchema, fieldErrors, fullNameKo } from "@/lib/validation";

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
    // slug 는 캐시를 비우는 데 씁니다. 이 엔드포인트로는 못 바꾸는 값이라 저장 전후가 같습니다.
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...parsed.data,
        // 표시용 합본은 성·이름에서 다시 만듭니다. 여기서 안 만들면 이름을 고쳐도
        // vCard 의 N 필드가 등록 당시 이름으로 남습니다.
        nameKo: fullNameKo(parsed.data.familyName, parsed.data.givenName),
      },
      select: { slug: true },
    });

    // 이 사람 명함 이미지 캐시를 지웁니다. 없으면 저장은 됐는데 카드와 서명에는
    // 최대 60 초 동안 옛 번호가 나갑니다. 공개 페이지(/c/[slug])는 캐시가 없어 그냥 둡니다.
    // expire: 0 — 저장한 사람이 바로 확인하러 가므로 옛 이미지를 한 번도 더 내보내지 않습니다.
    revalidateTag(cardTag(employee.slug), { expire: 0 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}

/**
 * 직원 완전 삭제. (admin 전용)
 *
 * 행이 사라지므로 공개 명함 주소(/c/[slug])가 404 가 됩니다 — 이미 메일 서명으로
 * 나간 링크도 함께 깨집니다. 퇴사 처리라면 상태를 RESIGNED 로 바꾸는 쪽이 맞습니다.
 * (그쪽은 목록에 남고 주소도 그대로 점유합니다)
 *
 * 조회 기록(ProfileView)은 스키마의 Cascade 로 함께 지워집니다.
 */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;

  // 자기 자신을 지우면 세션의 employeeId 가 없는 사람을 가리키게 되어 /edit 이 열리지
  // 않습니다. 로그아웃 말고는 빠져나갈 길이 없어지므로 막습니다.
  if (session.employeeId === id) {
    return NextResponse.json({ error: "본인 계정은 삭제할 수 없습니다." }, { status: 409 });
  }

  try {
    const employee = await prisma.employee.delete({ where: { id }, select: { slug: true } });
    revalidateTag(cardTag(employee.slug), { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (cause: unknown) {
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "P2025") {
      return NextResponse.json({ error: "이미 삭제된 직원입니다." }, { status: 404 });
    }
    return NextResponse.json({ error: "삭제하지 못했습니다." }, { status: 500 });
  }
}
