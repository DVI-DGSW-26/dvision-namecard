import { NextResponse, type NextRequest } from "next/server";
import { guardOrgWrite, orgDelegate, orgWriteError, parseOrgBody } from "@/lib/org-mutate";

type Context = { params: Promise<{ kind: string; id: string }> };

/** 조직 목록 항목 수정. (admin 전용) */
export async function PATCH(request: NextRequest, { params }: Context) {
  const { kind: rawKind, id } = await params;
  const guard = await guardOrgWrite(rawKind);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = parseOrgBody(guard.kind, body);
  if (!parsed.ok) return parsed.response;

  try {
    await (orgDelegate(guard.kind).update as (args: unknown) => Promise<unknown>)({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return orgWriteError(cause);
  }
}

/**
 * 조직 목록 항목 삭제. (admin 전용)
 *
 * 사용 중이어도 지웁니다 — 그 값을 쓰던 직원의 칸은 비워집니다(스키마의 SetNull).
 * 팀을 지우면 그 팀의 파트도 함께 사라지고, 파트를 쓰던 직원의 칸도 비워집니다.
 */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { kind: rawKind, id } = await params;
  const guard = await guardOrgWrite(rawKind);
  if (!guard.ok) return guard.response;

  try {
    await (orgDelegate(guard.kind).delete as (args: unknown) => Promise<unknown>)({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return orgWriteError(cause);
  }
}
