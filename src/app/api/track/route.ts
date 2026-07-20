import { NextResponse, type NextRequest } from "next/server";

/**
 * 프로필 조회/액션 기록. (스텁, 선택 기능)
 *
 * 구현 시: 공개 프로필에서 호출되므로 인증 없이 접근 가능합니다.
 * employeeId 와 action 만 받고, 저장 실패해도 사용자 경험을 막지 않도록
 * 조용히 넘어가게 만드세요. 봇 트래픽으로 부풀 수 있으니 rate limit 권장.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json({ todo: "track" }, { status: 501 });
}
