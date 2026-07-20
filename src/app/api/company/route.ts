import { NextResponse, type NextRequest } from "next/server";

/**
 * 회사 정보 수정. (스텁)
 * 구현 시: admin 세션 확인 → zod 검증 → Company 는 1행만 존재하므로
 * findFirst 로 찾아 update 하거나 고정 id 를 쓰세요.
 */
export async function PATCH(_request: NextRequest) {
  return NextResponse.json({ todo: "company:update" }, { status: 501 });
}
