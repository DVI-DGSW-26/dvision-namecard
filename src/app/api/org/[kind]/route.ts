import { NextResponse, type NextRequest } from "next/server";
import { guardOrgWrite, orgApi, orgWriteError, parseOrgBody } from "@/lib/org-mutate";
import { invalidateOrgCache } from "@/lib/org-store";

type Context = { params: Promise<{ kind: string }> };

/** 조직 목록에 항목 추가. (admin 전용) */
export async function POST(request: NextRequest, { params }: Context) {
  const { kind: rawKind } = await params;
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
    // 사업장을 회사(1행)에 매다는 건 서버가 합니다.
    const created = await orgApi.create(guard.kind, parsed.data);
    invalidateOrgCache();
    return NextResponse.json(created, { status: 201 });
  } catch (cause) {
    return orgWriteError(cause);
  }
}
