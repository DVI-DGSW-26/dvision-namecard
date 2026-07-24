import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
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
 * 공용 비밀번호 인증. 개인 계정은 없습니다.
 *
 * node:crypto 를 쓰므로 이 파일은 Node 런타임 전용입니다.
 * middleware(Edge)에서는 lib/session-token.ts 를 직접 import 하세요.
 */

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, SESSION_REMEMBER_MAX_AGE_SECONDS };
export type { Role, Session };

/**
 * 길이를 노출하지 않는 상수시간 문자열 비교.
 *
 * timingSafeEqual 은 두 버퍼의 길이가 다르면 예외를 던지고, 길이 자체도 정보를 흘립니다.
 * 그래서 양쪽을 SHA-256 으로 먼저 고정 길이(32바이트)로 만든 뒤 비교합니다.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/**
 * 입력값을 공용 비밀번호와 대조해 역할을 판정합니다. 일치하지 않으면 null.
 *
 * 조기 리턴하지 않고 두 비교를 항상 모두 실행해서, 응답 시간으로 어느 쪽이
 * 틀렸는지 추측할 수 없게 합니다.
 */
export function verifyPassword(input: string): Role | null {
  const memberPassword = process.env.ACCESS_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!memberPassword || !adminPassword) {
    throw new Error(
      "ACCESS_PASSWORD / ADMIN_PASSWORD 환경변수가 설정되지 않았습니다. .env 를 확인하세요.",
    );
  }

  const isAdmin = safeEqual(input, adminPassword);
  const isMember = safeEqual(input, memberPassword);

  if (isAdmin) return "admin";
  if (isMember) return "member";
  return null;
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
