import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, api, employeeById, json } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { cardTag } from "@/lib/card-cache";
import { employeeAdminSchema, fieldErrors } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

/**
 * 공개 주소(slug)와 권한(role) 변경. (admin 전용)
 *
 * 프로필 저장(PATCH /api/employees/[id])과 라우트를 나눈 이유: 저쪽은 본인도 부를 수
 * 있습니다. 같은 스키마에 role 을 넣으면 직원이 자기 권한을 스스로 올릴 수 있게 되고,
 * slug 를 넣으면 남의 주소를 선점할 수 있습니다.
 *
 * 재직 상태는 여기 없습니다 — 인사 시스템이 정합니다.
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

  const before = await employeeById(id);
  if (!before) {
    return NextResponse.json({ error: "없는 직원입니다." }, { status: 404 });
  }

  try {
    // 마지막 관리자의 권한을 내리는 건 서버가 막습니다(409 last_admin). 관리자가 0명이
    // 되면 권한을 되돌릴 화면에도 아무도 못 들어가기 때문입니다.
    await api(`/employees/${encodeURIComponent(id)}/admin`, json("PATCH", parsed.data));

    // 주소가 바뀌면 옛 주소의 이미지 캐시도 지웁니다. 안 그러면 지금은 404 여야 할
    // 주소가 최대 60 초 동안 예전 명함을 계속 내보냅니다.
    revalidateTag(cardTag(before.slug), { expire: 0 });
    if (parsed.data.slug !== before.slug) revalidateTag(cardTag(parsed.data.slug), { expire: 0 });

    return NextResponse.json({ ok: true });
  } catch (cause: unknown) {
    if (cause instanceof ApiError && cause.code === "last_admin") {
      return NextResponse.json(
        { error: "마지막 관리자입니다. 다른 사람을 관리자로 지정한 뒤에 바꿔 주세요." },
        { status: 409 },
      );
    }
    if (cause instanceof ApiError && cause.status === 409) {
      return NextResponse.json({ errors: { slug: "이미 사용 중인 주소입니다." } }, { status: 409 });
    }
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
