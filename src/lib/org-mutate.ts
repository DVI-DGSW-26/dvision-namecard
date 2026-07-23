import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOrgKind, orgItemSchema, type OrgKind } from "@/lib/org";
import { fieldErrors } from "@/lib/validation";

/**
 * 조직 목록 쓰기(추가 · 수정 · 삭제)의 공통 처리.
 *
 * 다섯 목록이 같은 규칙을 쓰므로 라우트마다 권한 확인과 검증을 반복하지 않도록
 * 여기 모읍니다. 목록별로 다른 건 "어떤 컬럼을 쓰는가" 하나뿐입니다.
 */

/** kind 별로 실제 저장할 필드를 고릅니다. 목록에 없는 컬럼을 넘기면 Prisma 가 거부합니다. */
function dataFor(kind: OrgKind, values: ReturnType<typeof orgItemSchema.parse>) {
  // 사업장은 nameEn 이 없고 우편번호·주소를 갖습니다. 회사는 1행뿐이라 companyId 는
  // 여기서 정하지 않고 라우트가 채웁니다.
  if (kind === "offices") {
    return {
      name: values.name,
      postalCode: values.postalCode,
      address: values.address,
      sortOrder: values.sortOrder,
    };
  }

  const base = { name: values.name, nameEn: values.nameEn, sortOrder: values.sortOrder };
  if (kind === "executiveTitles") return { ...base, nameEnFull: values.nameEnFull };
  if (kind === "parts") return { ...base, teamId: values.teamId };
  return base;
}

/** Prisma 클라이언트에서 kind 에 해당하는 델리게이트를 꺼냅니다. */
function delegate(kind: OrgKind) {
  switch (kind) {
    case "ranks":
      return prisma.rank;
    case "executiveTitles":
      return prisma.executiveTitle;
    case "positions":
      return prisma.position;
    case "teams":
      return prisma.team;
    case "parts":
      return prisma.part;
    case "offices":
      return prisma.office;
  }
}

type Guard = { ok: true; kind: OrgKind } | { ok: false; response: NextResponse };

/** 관리자 세션 + 올바른 kind 인지 확인합니다. */
export async function guardOrgWrite(rawKind: string): Promise<Guard> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  if (session.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  if (!isOrgKind(rawKind)) {
    return { ok: false, response: NextResponse.json({ error: "없는 목록입니다." }, { status: 404 }) };
  }
  return { ok: true, kind: rawKind };
}

/**
 * 본문을 검증하고 저장할 데이터로 바꿉니다.
 *
 * 파트는 소속 팀이 반드시 있어야 합니다 — 팀 없는 파트는 어느 부서인지 알 수 없어
 * 명함에 찍을 수 없습니다.
 */
export function parseOrgBody(kind: OrgKind, body: unknown) {
  const parsed = orgItemSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false as const, response: NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 }) };
  }
  if (kind === "parts" && !parsed.data.teamId) {
    return {
      ok: false as const,
      response: NextResponse.json({ errors: { teamId: "소속 팀을 선택해 주세요." } }, { status: 422 }),
    };
  }
  // 주소 없는 사업장은 명함에 찍을 게 없습니다. 이름만 있는 빈 줄이 생기지 않게 막습니다.
  if (kind === "offices" && !parsed.data.address) {
    return {
      ok: false as const,
      response: NextResponse.json({ errors: { address: "주소를 입력해 주세요." } }, { status: 422 }),
    };
  }
  return { ok: true as const, data: dataFor(kind, parsed.data) };
}

/**
 * 저장 중 터지는 Prisma 오류를 사용자에게 보여 줄 응답으로 바꿉니다.
 *
 * P2002 unique — 같은 이름이 이미 있습니다. 파트는 (팀, 이름) 조합이 유일합니다.
 * P2003 외래키 — 없는 팀 id 를 넘겼습니다.
 * P2025 없는 행 — 다른 창에서 이미 지운 항목입니다.
 */
export function orgWriteError(cause: unknown): NextResponse {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : null;
  if (code === "P2002") {
    return NextResponse.json({ errors: { name: "같은 이름이 이미 있습니다." } }, { status: 409 });
  }
  if (code === "P2003") {
    return NextResponse.json({ errors: { teamId: "없는 팀입니다." } }, { status: 422 });
  }
  if (code === "P2025") {
    return NextResponse.json({ error: "이미 삭제된 항목입니다." }, { status: 404 });
  }
  return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
}

export { delegate as orgDelegate };
