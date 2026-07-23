import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readOrgLists } from "@/lib/org-store";

/**
 * 조직 목록 조회 — 직위 · 임원 직책 · 직책 · 부서(팀+파트).
 *
 * middleware 는 /api/* 를 지나가지 않으므로 여기서 직접 세션을 확인합니다.
 * 쓰기는 관리자 전용이지만 읽기는 로그인한 사람이면 됩니다 — /edit 의 선택
 * 상자를 채우는 데 필요합니다.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    return NextResponse.json(await readOrgLists());
  } catch {
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
