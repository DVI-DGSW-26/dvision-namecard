import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSlug } from "@/lib/slug";

/**
 * 사내 이메일 도메인. 이 도메인 + 올바른 공용 비밀번호이면, 아직 등록되지 않은
 * 이메일이라도 본인 명함을 즉석에서 만들어 들여보냅니다. (아래 createSelfServeEmployee)
 */
const COMPANY_DOMAIN = "dvi-ind.com";

/**
 * 사내 이메일 + 공용 비밀번호 검증 → 세션 쿠키 발급.
 *
 * 비밀번호는 "우리 회사 사람인지" 만 증명합니다. 누구인지는 이메일로 확인해서
 * 세션에 employeeId 로 담습니다. 이게 없으면 /edit 이 누구 명함을 열어야 할지
 * 알 수 없어서, 로그인한 모든 사람이 같은(첫 번째) 직원 명함을 보게 됩니다.
 *
 * 한계: 공용 비밀번호를 아는 사람은 남의 이메일로도 들어올 수 있습니다. 이 구조로는
 * 사칭을 기술적으로 막을 수 없습니다. 사내 도구라 신뢰 기반으로 두되, 필요해지면
 * 수정 이력(ProfileView.action)을 남기는 걸 검토하세요.
 *
 * verifyPassword 가 node:crypto 를 쓰므로 Node 런타임이어야 합니다.
 * (Route Handler 는 기본이 Node 런타임이라 별도 설정은 필요 없습니다.)
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().max(200),
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

/**
 * 사내 이메일로 처음 들어온 사람에게 빈 명함을 만들어 줍니다.
 *
 * 비밀번호가 사실상 유일한 관문이라, 이름·연락처는 로그인 후 본인이 /edit 에서 채웁니다.
 * 지금은 이메일 앞부분을 임시 이름·슬러그로 씁니다. slug 는 공개 URL 에 그대로 들어가므로
 * 로마자·숫자만 남기고(buildSlug), 충돌하면 숫자를 붙입니다.
 */
async function createSelfServeEmployee(email: string, companyId: string) {
  const localPart = email.split("@")[0] || "member";
  const takenSlugs = (await prisma.employee.findMany({ select: { slug: true } })).map((e) => e.slug);
  // localPart 가 한글 등이라 로마자로 못 만들면 member2, member3 … 으로 폴백합니다.
  const slug = buildSlug({ familyName: localPart }, takenSlugs) ?? `member${takenSlugs.length + 1}`;

  return prisma.employee.create({
    data: {
      email,
      slug,
      nameKo: localPart,
      // familyName/givenName 은 vCard N 필드용입니다. 임시로 이름 자리에만 넣어 두고
      // 정확한 성·이름은 관리자 화면에서 바로잡습니다.
      familyName: "",
      givenName: localPart,
      rank: "사원",
      status: "ACTIVE",
      companyId,
    },
    select: { id: true },
  });
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
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const role = verifyPassword(parsed.data.password);
  if (!role) {
    // 이메일이 틀렸는지 비밀번호가 틀렸는지 구분해 주지 않습니다. 구분해 주면
    // 어떤 이메일이 등록되어 있는지 확인하는 도구가 됩니다.
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  let employee: { id: string } | null = null;
  let employeeCount = 0;
  try {
    employee = await prisma.employee.findFirst({
      // 퇴사자는 링크를 알아도 들어올 수 없어야 합니다.
      where: { email: parsed.data.email, status: { not: "RESIGNED" } },
      select: { id: true },
    });
    employeeCount = await prisma.employee.count();
  } catch {
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  if (!employee) {
    // 사내 이메일이면, 등록이 없어도 그 자리에 본인 명함을 만들어 들여보냅니다.
    // (명함을 만들려면 회사가 하나는 있어야 하므로, 회사가 없으면 아래 부트스트랩으로 넘어갑니다.)
    const emailIsCompany = parsed.data.email.endsWith(`@${COMPANY_DOMAIN}`);
    const company = emailIsCompany
      ? await prisma.company.findFirst({ select: { id: true } })
      : null;

    if (company) {
      try {
        employee = await createSelfServeEmployee(parsed.data.email, company.id);
      } catch {
        // 같은 이메일로 동시에 들어오면 unique 제약에 걸립니다. 이미 만들어진 걸 다시 집습니다.
        employee = await prisma.employee.findFirst({
          where: { email: parsed.data.email, status: { not: "RESIGNED" } },
          select: { id: true },
        });
        if (!employee) {
          return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
        }
      }
    } else if (role === "admin" && employeeCount === 0) {
      /*
       * 부트스트랩: 회사·직원이 아직 없는 새 환경의 관리자는 이메일 확인 없이 들여보냅니다.
       * 그러지 않으면 아무도 못 들어가고, 못 들어가니 첫 직원을 등록할 수도 없습니다.
       * 이 세션은 employeeId 가 null 이라 "내 명함" 이 없고 임직원 관리만 쓸 수 있습니다.
       */
      await createSession({ role, employeeId: null });
      attempts.delete(ip);
      return NextResponse.json({ ok: true, bootstrap: true });
    } else {
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
  }

  await createSession({ role, employeeId: employee.id });
  // 정상 사용자가 오타 몇 번 뒤에 한도에 걸리지 않도록 성공 시 기록을 지웁니다.
  attempts.delete(ip);
  return NextResponse.json({ ok: true });
}

/** 로그아웃 — 세션 쿠키를 제거합니다. */
export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
