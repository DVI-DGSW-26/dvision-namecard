import { cookies } from "next/headers";
import { verifyPassword } from "./password";
import { prisma } from "./prisma";
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
 * 예전에는 공용 비밀번호 두 개(직원용·관리자용)였습니다. 그 구조에서는 비밀번호를
 * 아는 사람이 남의 이메일로도 들어올 수 있어 사칭을 기술적으로 막을 수 없었고,
 * 한 사람에게서 권한을 회수하려면 전원이 새 비밀번호를 외워야 했습니다.
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
 * 이메일과 비밀번호로 직원을 인증합니다. 맞지 않으면 null.
 *
 * 없는 이메일일 때도 해시 검증을 한 번 돌립니다. 곧바로 null 을 돌려주면 응답이
 * 눈에 띄게 빨라서, 그 차이만으로 어떤 이메일이 등록돼 있는지 훑을 수 있습니다.
 *
 * 퇴사자(RESIGNED)는 비밀번호가 맞아도 들이지 않습니다. 비밀번호를 지우는 것과
 * 별개로, 상태 하나만 바꿔도 즉시 막히는 길이 있어야 합니다.
 */
export async function authenticate(email: string, password: string): Promise<Authenticated | null> {
  const employee = await prisma.employee.findFirst({
    where: { email, status: { not: "RESIGNED" } },
    select: { id: true, role: true, passwordHash: true, mustChangePassword: true },
  });

  const ok = await verifyPassword(password, employee?.passwordHash ?? null);
  if (!employee || !ok) return null;

  return {
    employeeId: employee.id,
    role: employee.role === "ADMIN" ? "admin" : "member",
    mustChangePassword: employee.mustChangePassword,
  };
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
