import { NextResponse, type NextRequest } from "next/server";

type Context = {
  params: Promise<{ id: string }>;
};

/**
 * 직원 정보 저장. (스텁)
 *
 * 구현 시: getSession() 으로 세션 확인(middleware 는 /api/* 를 안 탑니다) →
 * zod 검증. member 세션은 slug·email·status 를 못 바꾸게 막고, 그 필드들은
 * admin 세션에서만 허용하세요. 공용 비밀번호라 누구나 아무 id 나 수정할 수 있는
 * 구조이므로, 감사 로그가 필요하면 ProfileView 에 action 으로 남기는 걸 고려할 것.
 */
export async function PATCH(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  return NextResponse.json({ todo: "employees:update", id }, { status: 501 });
}
