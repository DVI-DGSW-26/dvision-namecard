import { NextResponse, type NextRequest } from "next/server";

/**
 * 직원 목록. (스텁)
 * 구현 시: /edit 의 직원 선택용. RESIGNED 는 제외하고,
 * email·telMobile 같은 민감 필드는 목록 응답에서 빼는 편이 안전합니다.
 */
export async function GET() {
  return NextResponse.json({ todo: "employees:list" }, { status: 501 });
}

/**
 * 직원 추가. (스텁)
 * 구현 시: admin 세션인지 getSession() 으로 확인 → zod 검증 → buildSlug() 로 slug 생성.
 * middleware 는 /api/* 를 지나가지 않으므로 여기서 직접 권한을 확인해야 합니다.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json({ todo: "employees:create" }, { status: 501 });
}
