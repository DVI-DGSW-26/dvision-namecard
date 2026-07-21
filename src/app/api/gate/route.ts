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
 */

const bodySchema = z.object({
  // 상한이 없으면 거대한 문자열로 해시 연산을 반복시킬 수 있습니다.
  password: z.string().min(1).max(200),
});

/**
 * IP 당 시도 횟수 제한.
 *
 * 프로세스 메모리라 인스턴스가 여러 개면 그만큼 한도가 늘어나고 재배포하면 초기화됩니다.
 * 그래도 단일 IP 에서의 단순 반복 대입은 막습니다. 사내 도구라 이 정도로 두되,
 * 외부에 열게 되면 Upstash 같은 공유 저장소로 옮겨야 합니다.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

function clientIp(request: NextRequest): string {
  // 프록시 뒤에 있으면 x-forwarded-for 의 첫 항목이 원 클라이언트입니다.
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

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
  // 정상 사용자가 오타 몇 번 뒤에 한도에 걸리지 않도록 성공 시 기록을 지웁니다.
  attempts.delete(ip);
  return NextResponse.json({ ok: true });
}

/** 로그아웃 — 세션 쿠키를 제거합니다. */
export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
