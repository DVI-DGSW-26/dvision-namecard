import { NextResponse, type NextRequest } from "next/server";

/**
 * 공용 비밀번호 검증 → 세션 쿠키 발급. (스텁)
 *
 * 구현 시: zod 로 body 검증 → verifyPassword() → null 이면 401,
 * 아니면 createSession(role). 응답에 어느 비밀번호가 맞았는지 힌트를 주지 말 것.
 * verifyPassword 가 node:crypto 를 쓰므로 이 핸들러는 Node 런타임이어야 합니다.
 * (Route Handler 는 기본이 Node 런타임이라 별도 설정은 필요 없습니다.)
 *
 * 무차별 대입을 막으려면 IP 단위 rate limit 을 붙이는 걸 권장합니다.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json({ todo: "gate" }, { status: 501 });
}

/**
 * 로그아웃. (스텁)
 * 구현 시: destroySession() 호출.
 */
export async function DELETE() {
  return NextResponse.json({ todo: "gate:logout" }, { status: 501 });
}
