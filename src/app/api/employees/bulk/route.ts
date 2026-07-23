import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { cardTag } from "@/lib/card-cache";
import { prisma } from "@/lib/prisma";
import { employeeBulkSchema, fieldErrors } from "@/lib/validation";

/**
 * 선택한 직원 여러 명을 한꺼번에 처리합니다. (admin 전용)
 *
 * 상태 변경과 삭제 두 가지입니다. 라우트를 /api/employees/[id] 와 나란히 두면
 * "bulk" 가 id 로 잡힐 것 같지만, Next 는 고정 경로를 동적 경로보다 먼저 맞춥니다.
 *
 * 부분 성공을 허용합니다 — 20명 중 1명이 그 사이 지워졌다고 나머지 19명까지
 * 되돌리면 관리자는 무엇이 처리됐는지 알 수 없는 채로 다시 시도해야 합니다.
 * 대신 실제로 처리된 수를 돌려줍니다.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = employeeBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  // 본인은 대상에서 뺍니다. 삭제는 물론이고 자기 상태를 RESIGNED 로 바꿔도
  // 그 순간부터 자기 명함이 404 가 되는데, 그럴 의도로 전체 선택을 누르지는 않습니다.
  const ids = parsed.data.ids.filter((id) => id !== session.employeeId);
  const skippedSelf = ids.length !== parsed.data.ids.length;

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "본인 계정만 선택되어 처리할 대상이 없습니다." },
      { status: 409 },
    );
  }

  try {
    // 캐시를 지우려면 slug 가 필요한데, 삭제하고 나면 읽을 수 없으니 미리 받아 둡니다.
    const targets = await prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { slug: true },
    });

    const { count } =
      parsed.data.action === "delete"
        ? await prisma.employee.deleteMany({ where: { id: { in: ids } } })
        : await prisma.employee.updateMany({
            where: { id: { in: ids } },
            data: { status: parsed.data.status },
          });

    for (const target of targets) revalidateTag(cardTag(target.slug), { expire: 0 });

    return NextResponse.json({ ok: true, count, skippedSelf });
  } catch {
    return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
  }
}
