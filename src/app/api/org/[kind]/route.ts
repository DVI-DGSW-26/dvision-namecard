import { NextResponse, type NextRequest } from "next/server";
import { guardOrgWrite, orgDelegate, orgWriteError, parseOrgBody } from "@/lib/org-mutate";
import { prisma } from "@/lib/prisma";

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

  // 사업장만 회사에 매답니다. Company 는 1행뿐이라 클라이언트가 보낼 값이 아닙니다.
  let data: object = parsed.data;
  if (guard.kind === "offices") {
    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      return NextResponse.json({ error: "회사 정보가 없습니다." }, { status: 409 });
    }
    data = { ...parsed.data, companyId: company.id };
  }

  try {
    // 델리게이트마다 create 인자 타입이 달라 유니온으로는 좁혀지지 않습니다.
    // parseOrgBody 가 kind 에 맞는 필드만 골라 주므로 여기서는 통과시킵니다.
    const created = await (orgDelegate(guard.kind).create as (args: unknown) => Promise<{ id: string }>)({
      data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (cause) {
    return orgWriteError(cause);
  }
}
