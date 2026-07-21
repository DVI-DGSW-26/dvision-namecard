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

export type Session = {
  role: Role;
  /**
   * 로그인한 본인의 Employee.id.
   *
   * 공용 비밀번호는 "우리 회사 사람인지" 만 증명하므로, 신원은 게이트에서 받은
   * 사내 이메일로 따로 확인해 여기 담습니다. 이게 없으면 /edit 이 누구 명함을
   * 열어야 할지 알 수 없습니다.
   *
   * null 인 경우는 하나뿐입니다 — 직원이 한 명도 없는 상태에서 관리자가 처음
   * 들어온 경우. 그래야 첫 직원을 등록할 수 있습니다. (부트스트랩)
   */
  employeeId: string | null;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
  }
  return new TextEncoder().encode(secret);
}

/** 역할과 본인 식별자를 담은 세션 JWT 를 서명해 문자열로 만듭니다. */
export async function signSessionToken(session: Session): Promise<string> {
  return new SignJWT({ role: session.role, employeeId: session.employeeId })
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

    const employeeId = payload.employeeId;
    // 토큰에 담기는 값이라 문자열인지 확인합니다. 예전 형식(employeeId 없음)의
    // 쿠키를 들고 오면 null 로 떨어지고, /edit 이 다시 로그인하도록 안내합니다.
    return { role, employeeId: typeof employeeId === "string" ? employeeId : null };
  } catch {
    return null;
  }
}
