import { SignJWT, jwtVerify } from "jose";

/**
 * 세션 토큰의 서명/검증만 담당합니다.
 *
 * 이 파일은 jose 만 import 합니다 — node:crypto 나 next/headers 를 절대 넣지 마세요.
 * middleware(Edge 런타임)가 여기서 import 하기 때문에, Node 전용 모듈이 하나라도
 * 딸려 들어오면 빌드가 깨집니다. 쿠키 조작과 비밀번호 검증은 lib/auth.ts 에 있습니다.
 */

export const SESSION_COOKIE = "dvi_session";

/** 세션 유효기간 12시간. 공용 기기에서 자리를 뜬 사람이 그대로 남지 않을 정도의 길이입니다. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * "로그인 유지" 를 켰을 때의 유효기간 30일.
 *
 * 본인 기기에서 하루에 한 번씩 비밀번호를 다시 치게 하면, 공지에 적힌 공용 비밀번호를
 * 메모장이나 채팅방에 붙여 두게 됩니다. 그게 쿠키가 오래 남는 것보다 위험합니다.
 * 대신 무기한은 두지 않습니다 — 퇴사자의 쿠키가 영원히 살아 있으면 안 되니까요.
 */
export const SESSION_REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

/**
 * 역할과 본인 식별자를 담은 세션 JWT 를 서명해 문자열로 만듭니다.
 *
 * 만료는 인자로 받습니다. 쿠키 maxAge 와 토큰 exp 가 따로 놀면, 쿠키는 살아 있는데
 * 토큰만 만료돼 로그인한 것처럼 보이다가 튕기는 상태가 생깁니다. 부르는 쪽(auth.ts)에서
 * 같은 값을 양쪽에 넣습니다.
 */
export async function signSessionToken(
  session: Session,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({ role: session.role, employeeId: session.employeeId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
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
