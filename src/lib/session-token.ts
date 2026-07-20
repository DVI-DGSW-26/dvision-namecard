import { SignJWT, jwtVerify } from "jose";

/**
 * 세션 토큰의 서명/검증만 담당합니다.
 *
 * 이 파일은 jose 만 import 합니다 — node:crypto 나 next/headers 를 절대 넣지 마세요.
 * middleware(Edge 런타임)가 여기서 import 하기 때문에, Node 전용 모듈이 하나라도
 * 딸려 들어오면 빌드가 깨집니다. 쿠키 조작과 비밀번호 검증은 lib/auth.ts 에 있습니다.
 */

export const SESSION_COOKIE = "dvi_session";

/** 세션 유효기간 12시간. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type Role = "member" | "admin";
export type Session = { role: Role };

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
  }
  return new TextEncoder().encode(secret);
}

/** 역할을 담은 세션 JWT 를 서명해 문자열로 만듭니다. */
export async function signSessionToken(role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** 토큰을 검증합니다. 만료·위조·역할 불명이면 null. */
export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (role !== "member" && role !== "admin") return null;
    return { role };
  } catch {
    return null;
  }
}
