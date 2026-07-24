import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticate, createSession, destroySession } from "@/lib/auth";

/**
 * 이메일 + 본인 비밀번호 검증 → 세션 쿠키 발급.
 *
 * 계정은 관리자가 임직원 관리에서 만들고 초기 비밀번호를 발급합니다. 이 라우트는
 * 계정을 만들지 않습니다 — 예전에는 사내 이메일이기만 하면 등록되지 않은 사람도
 * 그 자리에서 직원 레코드를 만들어 들여보냈는데, 공용 비밀번호 하나만 새면 아무
 * 문자열로나 명함이 생기고 오타로 들어가도 유령 직원이 남았습니다.
 *
 * authenticate 가 prisma·node:crypto 를 쓰므로 Node 런타임이어야 합니다.
 * (Route Handler 는 기본이 Node 런타임이라 별도 설정은 필요 없습니다.)
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().max(200),
  // 상한이 없으면 거대한 문자열로 해시 연산을 반복시킬 수 있습니다.
  password: z.string().min(1).max(200),
  // "로그인 유지" — 없으면 꺼진 것으로 봅니다. 세션이 길어지는 건 명시적으로 켠 경우만.
  remember: z.boolean().optional().default(false),
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

/**
 * 로컬 개발에서는 한도를 적용하지 않습니다.
 *
 * 프록시가 없어 x-forwarded-for 가 비고, clientIp 가 전부 "unknown" 을 돌려주기 때문에
 * 개발자 한 명의 오타가 곧바로 한도를 채웁니다. 막아야 할 무차별 대입은 배포 환경에서
 * 오는 것이므로 여기서 끄더라도 잃는 방어가 없습니다.
 */
const RATE_LIMIT_ENABLED = process.env.NODE_ENV === "production";

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
  if (RATE_LIMIT_ENABLED && !rateLimit(ip)) {
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
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const auth = await authenticate(parsed.data.email, parsed.data.password);
  if (!auth) {
    // 이메일이 틀렸는지 비밀번호가 틀렸는지 구분해 주지 않습니다. 구분해 주면
    // 어떤 이메일이 등록되어 있는지 확인하는 도구가 됩니다.
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await createSession(
    {
      role: auth.role,
      employeeId: auth.employeeId,
      mustChangePassword: auth.mustChangePassword,
    },
    parsed.data.remember,
  );
  // 정상 사용자가 오타 몇 번 뒤에 한도에 걸리지 않도록 성공 시 기록을 지웁니다.
  attempts.delete(ip);

  /*
    관리자가 발급한 초기 비밀번호로 들어온 경우입니다.

    화면이 비밀번호 변경으로 보내야 하므로 이 사실만 알려 줍니다. 여기서 막지
    않는 이유: 세션은 이미 본인이 맞다는 증명이고, 못 바꾸게 하면 바꿀 화면에도
    못 들어갑니다. 강제는 화면(/edit/password)과 middleware 가 맡습니다.
  */
  return NextResponse.json({ ok: true, mustChangePassword: auth.mustChangePassword });
}

/** 로그아웃 — 세션 쿠키를 제거합니다. */
export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
