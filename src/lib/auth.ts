import { cookies } from "next/headers";
import { defaultPositionId } from "./org-store";
import { hashPassword, verifyPassword } from "./password";
import { prisma } from "./prisma";
import { buildSlug } from "./slug";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SESSION_REMEMBER_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
  type Role,
  type Session,
} from "./session-token";

/**
 * 계정 인증. 직원마다 이메일 + 본인 비밀번호를 갖습니다.
 *
 * 관리자만 개인 비밀번호를 갖고, 나머지 직원은 공용 비밀번호 하나를 함께 씁니다.
 * 사내 메일 도메인이면 등록되지 않은 사람도 그 값으로 들어오면서 본인 명함이
 * 만들어집니다. (COMPANY_EMAIL_DOMAIN · DEFAULT_EMPLOYEE_PASSWORD)
 *
 * 역할(admin/member)은 여전히 사람에게 붙습니다 — 비밀번호로 가르지 않으므로,
 * 공용 값이 새더라도 관리자 권한은 따라 나가지 않습니다.
 *
 * prisma 와 node:crypto 를 쓰므로 이 파일은 Node 런타임 전용입니다.
 * middleware(Edge)에서는 lib/session-token.ts 를 직접 import 하세요.
 */

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, SESSION_REMEMBER_MAX_AGE_SECONDS };
export type { Role, Session };

/** 인증에 성공한 사람. 세션에 담을 값과 초기 비밀번호 여부를 함께 돌려줍니다. */
export type Authenticated = {
  employeeId: string;
  role: Role;
  mustChangePassword: boolean;
};

/**
 * 사내 이메일 도메인.
 *
 * 관리자가 미리 등록해 둔 사람만 들어올 수 있게 했더니, 입사·이동 때마다 등록을
 * 기다려야 해서 "메일은 있는데 왜 못 들어가냐" 가 반복됐습니다. 사내 메일 계정을
 * 가진 것 자체를 재직 증명으로 보고, 이 도메인이면 등록이 없어도 들여보냅니다.
 */
export const COMPANY_EMAIL_DOMAIN = "dvi-ind.com";

/**
 * 관리자를 뺀 전 직원이 함께 쓰는 공용 비밀번호.
 *
 * 관리자 계정에는 적용하지 않습니다 — 임직원·조직을 고칠 수 있는 권한이라,
 * 공용 값으로 열리면 도메인 메일을 가진 누구나 관리자가 됩니다.
 *
 * 트레이드오프(알고 쓰는 것): 사내 메일 주소를 아는 사람은 남의 명함으로도
 * 들어올 수 있습니다. 사칭을 기술적으로 막지 못하는 구조이며, 운영자가 편의를
 * 택한 결과입니다. 개인별로 바꾸려면 임직원 관리의 '비번 재발급' 이 그대로
 * 동작하고, 재발급한 사람은 그 뒤로 새 비밀번호로만 들어옵니다.
 */
export const DEFAULT_EMPLOYEE_PASSWORD = "0706";

/** 사내 메일인지. 입력은 소문자로 정규화된 값이 들어온다고 가정하지 않습니다. */
export function isCompanyEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`);
}

/**
 * 이메일과 비밀번호로 직원을 인증합니다. 맞지 않으면 null.
 *
 * 없는 이메일일 때도 해시 검증을 한 번 돌립니다. 곧바로 null 을 돌려주면 응답이
 * 눈에 띄게 빨라서, 그 차이만으로 어떤 이메일이 등록돼 있는지 훑을 수 있습니다.
 *
 * 들어오는 길은 셋입니다.
 *   1. 등록된 직원 + 본인 비밀번호 — 재발급받은 사람은 이 길로만 들어옵니다.
 *   2. 등록은 됐지만 비밀번호를 못 받은 직원 + 공용 비밀번호 — 그 값을 심어 줍니다.
 *   3. 등록이 아예 없는 사내 이메일 + 공용 비밀번호 — 명함을 그 자리에서 만듭니다.
 * 2·3 은 관리자 계정에는 열리지 않습니다.
 *
 * 퇴사자(RESIGNED)는 비밀번호가 맞아도 들이지 않습니다. 사내 메일이 아직 살아
 * 있어도 여기서 막혀야 하므로, 3번 길로 새 명함이 만들어지지 않게 상태를 먼저 봅니다.
 */
export async function authenticate(email: string, password: string): Promise<Authenticated | null> {
  const employee = await prisma.employee.findUnique({
    where: { email },
    select: { id: true, role: true, status: true, passwordHash: true, mustChangePassword: true },
  });

  const ok = await verifyPassword(password, employee?.passwordHash ?? null);
  const sharedPassword = password === DEFAULT_EMPLOYEE_PASSWORD && isCompanyEmail(email);

  if (!employee) {
    return sharedPassword ? provisionCompanyEmployee(email.trim().toLowerCase()) : null;
  }

  if (employee.status === "RESIGNED") return null;

  if (!ok) {
    // 비밀번호를 아직 못 받은 사람만 공용 값으로 열어 줍니다. 해시가 이미 있으면
    // 재발급받은 값이 있다는 뜻이라, 공용 값이 그걸 덮고 들어오면 재발급이 무의미해집니다.
    if (employee.passwordHash || employee.role === "ADMIN" || !sharedPassword) return null;
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        passwordHash: await hashPassword(DEFAULT_EMPLOYEE_PASSWORD),
        mustChangePassword: false,
      },
    });
  }

  return {
    employeeId: employee.id,
    role: employee.role === "ADMIN" ? "admin" : "member",
    mustChangePassword: employee.mustChangePassword,
  };
}

/**
 * 등록이 없는 사내 이메일에게 빈 명함을 만들어 줍니다.
 *
 * 이름·부서는 로그인한 본인이 /edit 에서 채웁니다. 지금은 이메일 앞부분을 임시
 * 이름·슬러그로 씁니다. slug 는 공개 URL 에 그대로 들어가므로 로마자·숫자만
 * 남기고(buildSlug), 충돌하면 숫자를 붙입니다.
 *
 * 회사 정보가 하나도 없으면 명함을 만들 수 없어 로그인도 실패합니다 — 그 상태는
 * 관리자가 회사 정보를 먼저 등록해야 풀립니다.
 */
async function provisionCompanyEmployee(email: string): Promise<Authenticated | null> {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) return null;

  const localPart = email.split("@")[0] || "member";
  const taken = (await prisma.employee.findMany({ select: { slug: true } })).map((row) => row.slug);
  // localPart 가 한글 등이라 로마자로 못 만들면 member2, member3 … 으로 폴백합니다.
  const slug = buildSlug({ familyName: localPart }, taken) ?? `member${taken.length + 1}`;

  try {
    const created = await prisma.employee.create({
      data: {
        email,
        slug,
        nameKo: localPart,
        // familyName/givenName 은 vCard N 필드용입니다. 임시로 이름 자리에만 넣어 두고
        // 정확한 성·이름은 본인이 /edit 에서 바로잡습니다.
        familyName: "",
        givenName: localPart,
        // 직위·부서는 비워 둡니다 — 본인이 고릅니다. 직책만 '팀원' 으로 시작합니다.
        positionId: await defaultPositionId(),
        status: "ACTIVE",
        // 다음 로그인부터는 1번 길(본인 해시)로 들어옵니다. 값은 같은 공용 비밀번호입니다.
        passwordHash: await hashPassword(DEFAULT_EMPLOYEE_PASSWORD),
        mustChangePassword: false,
        companyId: company.id,
      },
      select: { id: true },
    });
    return { employeeId: created.id, role: "member", mustChangePassword: false };
  } catch {
    // 같은 이메일로 동시에 들어오면 unique 제약에 걸립니다. 이미 만들어진 걸 다시 집습니다.
    // (slug 가 겹쳐서 실패한 경우에는 아래 조회도 비어서 그대로 로그인 실패가 됩니다.)
    const existing = await prisma.employee.findFirst({
      where: { email, status: { not: "RESIGNED" } },
      select: { id: true, role: true, mustChangePassword: true },
    });
    if (!existing) return null;
    return {
      employeeId: existing.id,
      role: existing.role === "ADMIN" ? "admin" : "member",
      mustChangePassword: existing.mustChangePassword,
    };
  }
}

/**
 * 인증 성공 시 서명된 httpOnly 세션 쿠키를 심습니다. (Route Handler / Server Action 전용)
 *
 * remember 는 "로그인 유지" 체크박스입니다. 켜면 30일, 아니면 12시간짜리 쿠키를 줍니다.
 * 브라우저를 닫으면 사라지는 세션 쿠키(maxAge 없음)로 만들지 않는 이유는, 모바일에서는
 * 브라우저를 닫는다는 개념이 흐릿해서 체크를 안 해도 사실상 계속 남아 버리기 때문입니다.
 * 유효기간으로 구분해야 두 선택이 실제로 다르게 동작합니다.
 */
export async function createSession(session: Session, remember = false): Promise<void> {
  const maxAge = remember ? SESSION_REMEMBER_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
  // 쿠키가 살아 있는데 토큰만 만료되는 상태를 막으려면 같은 값을 양쪽에 넣어야 합니다.
  const token = await signSessionToken(session, maxAge);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/** 현재 요청의 세션을 읽습니다. 비인증 상태면 null. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** 세션 쿠키를 제거합니다. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
