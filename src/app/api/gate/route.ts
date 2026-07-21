import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

/**
 * 공용 비밀번호 검증 → 세션 쿠키 발급.
 *
 * verifyPassword 가 node:crypto 를 쓰므로 Node 런타임이어야 합니다.
 * (Route Handler 는 기본이 Node 런타임이라 별도 설정은 필요 없습니다.)
 *
 * 실패 응답에 어느 비밀번호가 틀렸는지 힌트를 주지 않습니다. 성공 시에도 role 은
 * 쿠키 안에만 있고 본문으로 내보내지 않습니다.
 *
 * TODO: 무차별 대입 방어가 없습니다. 사내 배포라 당장은 열어 두지만, 외부에
 * 노출되는 순간 IP 단위 rate limit 이 필요합니다.
 */

const bodySchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const role = verifyPassword(parsed.data.password);
  if (!role) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await createSession(role);
  return NextResponse.json({ ok: true });
}

/** 로그아웃 — 세션 쿠키를 제거합니다. */
export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
