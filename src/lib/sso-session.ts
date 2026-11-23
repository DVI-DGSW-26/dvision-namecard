import { decodeJwt as readJwt } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import type { Authenticated } from "./auth";
import {
  SSO_BACK_COOKIE,
  SSO_BACK_SECONDS,
  SSO_EXP_COOKIE,
  SSO_REFRESH_COOKIE,
  SSO_REFRESH_FALLBACK_SECONDS,
  SSO_REFRESH_PATH,
  SSO_RENEW_BEFORE_SECONDS,
  SSO_SESSION_SECONDS,
  decodeJwt,
  discover,
  type TokenClaims,
} from "./oidc";
import { SESSION_COOKIE, signSessionToken, verifySessionToken, type Session } from "./session-token";
import { findOrLinkEmployee } from "./sso";

/**
 * SSO 세션 발급·갱신·삭제. (규칙은 lib/oidc.ts 의 SSO 로그인 유지 설명)
 *
 * 공용 비밀번호 로그인(lib/auth.ts 의 createSession)은 건드리지 않습니다 — 그쪽은
 * refresh token 이 없으므로 12시간/30일 세션 그대로입니다. 여기는 SSO 로 들어온
 * 세션만 다룹니다.
 *
 * prisma 를 쓰므로 Node 런타임 전용입니다. proxy(Edge)는 lib/oidc.ts 의 쿠키 이름만 씁니다.
 */

/** 토큰 엔드포인트 응답 중 쓰는 것 */
export interface TokenResponse {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  refresh_expires_in?: number;
}

const secure = process.env.NODE_ENV === "production";

/** refresh token 수명(초). Keycloak 이 SSO 세션에 맞춰 내려줍니다. */
function refreshLifetime(token: TokenResponse): number {
  const seconds = Number(token.refresh_expires_in);
  return seconds > 0 ? seconds : SSO_REFRESH_FALLBACK_SECONDS;
}

/**
 * 재직자 확인과 명함 연결. 로그인과 갱신이 같은 기준으로 판단해야 하므로 한 곳에 둡니다.
 * 갱신 때 다시 확인하기 때문에 퇴사·부서 해제가 다음 갱신에서 바로 반영됩니다.
 */
export async function ssoAccount(
  claims: TokenClaims,
  access: TokenClaims | null,
): Promise<{ ok: true; auth: Authenticated } | { ok: false; message: string }> {
  /* 재직자 확인 — 부서가 배정된 계정에만 employee 롤이 붙습니다 */
  const realmRoles = [...(claims.realm_access?.roles ?? []), ...(access?.realm_access?.roles ?? [])];
  if (!realmRoles.includes("employee")) {
    return { ok: false, message: "재직 중이며 부서가 배정된 계정만 이용할 수 있습니다. 관리팀에 문의해주세요." };
  }
  if (!claims.sub) return { ok: false, message: "계정 식별자가 없습니다." };

  /* 명함 연결 — 권한 확인이 끝난 뒤에만 계정을 만듭니다 */
  const auth = await findOrLinkEmployee(
    claims.sub,
    String(claims.email || "").toLowerCase(),
    claims.name || claims.preferred_username || "",
  );
  if (!auth) return { ok: false, message: "명함 계정을 연결하지 못했습니다. 관리자에게 문의해주세요." };
  return { ok: true, auth };
}

/**
 * SSO 세션 쿠키를 심습니다 — 15분 세션 + refresh token + 세션 만료 시각.
 *
 * refresh token 이 없으면(클라이언트 설정에서 꺼진 경우) 세션만 심습니다. 15분 뒤
 * 끝나면 게이트가 화면 없이 통합 로그인을 다시 거쳐 옵니다.
 */
export async function setSsoSession(res: NextResponse, session: Session, token: TokenResponse): Promise<void> {
  const refreshAge = refreshLifetime(token);
  const maxAge = Math.min(SSO_SESSION_SECONDS, refreshAge);
  // 쿠키 maxAge 와 토큰 exp 를 같은 값으로 둡니다 (lib/auth.ts createSession 과 같은 이유)
  res.cookies.set(SESSION_COOKIE, await signSessionToken(session, maxAge), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  if (!token.refresh_token) return;

  res.cookies.set(SSO_REFRESH_COOKIE, token.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: SSO_REFRESH_PATH,
    maxAge: refreshAge,
  });
  // 화면이 갱신할 때를 잡도록 시각만 스크립트에 보입니다. 토큰은 담지 않습니다.
  res.cookies.set(SSO_EXP_COOKIE, String(Math.floor(Date.now() / 1000) + maxAge), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: refreshAge,
  });
}

/** 통합 로그인에서 방금 돌아왔다는 표시를 남깁니다 (무한 반복 방지) */
export function markSsoReturn(res: NextResponse): void {
  res.cookies.set(SSO_BACK_COOKIE, "1", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: SSO_BACK_SECONDS });
}

/** 세션과 SSO 쿠키를 모두 지웁니다. 쿠키는 심을 때의 Path 로 지워야 지워집니다. */
export function clearSsoSession(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(SSO_REFRESH_COOKIE, "", { path: SSO_REFRESH_PATH, maxAge: 0 });
  res.cookies.set(SSO_EXP_COOKIE, "", { path: "/", maxAge: 0 });
}

export type RenewResult =
  | { kind: "fresh" }
  | { kind: "renewed"; session: Session; token: TokenResponse }
  /** clear: 세션을 지우고 다시 로그인해야 하는지. 통합 로그인 서버 장애면 지우지 않습니다. */
  | { kind: "failed"; clear: boolean; message: string };

/**
 * 갱신. /api/auth/refresh 만 부릅니다 — refresh token 은 한 번만 쓸 수 있습니다.
 *
 * 세션이 아직 넉넉히 남았으면 Keycloak 에 묻지 않습니다. 여러 탭이 거의 같은 때에
 * 부르더라도 먼저 갱신한 쪽이 새 세션을 심고 나면 나머지는 여기서 끝납니다.
 */
export async function renewSsoSession(req: NextRequest): Promise<RenewResult> {
  const current = req.cookies.get(SESSION_COOKIE)?.value;
  if (current && (await verifySessionToken(current))) {
    const exp = Number(readJwt(current).exp) || 0;
    if (exp - Date.now() / 1000 > SSO_RENEW_BEFORE_SECONDS) return { kind: "fresh" };
  }

  const refreshToken = req.cookies.get(SSO_REFRESH_COOKIE)?.value;
  if (!refreshToken) return { kind: "failed", clear: true, message: "로그인이 만료되었습니다." };

  const issuer = process.env.OIDC_ISSUER ?? "";
  const clientId = process.env.OIDC_CLIENT_ID ?? "dding-dong";
  const clientSecret = process.env.OIDC_CLIENT_SECRET ?? "";
  if (!issuer || !process.env.SESSION_SECRET) {
    return { kind: "failed", clear: false, message: "서버 환경변수가 설정되지 않았습니다. 관리자에게 문의해주세요." };
  }

  let res: Response;
  try {
    const meta = await discover(issuer);
    const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId });
    if (clientSecret) form.set("client_secret", clientSecret);
    res = await fetch(meta.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: form,
    });
  } catch {
    return { kind: "failed", clear: false, message: "통합 로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
  // 퇴사·SSO 세션 만료·재사용 탐지 → 다시 로그인해야 합니다
  if (!res.ok) return { kind: "failed", clear: true, message: "로그인이 만료되었습니다." };

  const token = (await res.json().catch(() => ({}))) as TokenResponse;
  let claims: TokenClaims;
  let access: TokenClaims | null = null;
  try {
    // 갱신 응답에는 보통 id_token 도 옵니다. 없으면 access token 으로 판단합니다.
    access = token.access_token ? decodeJwt(token.access_token) : null;
    claims = token.id_token ? decodeJwt(token.id_token) : (access ?? {});
  } catch {
    return { kind: "failed", clear: true, message: "계정 정보를 해석하지 못했습니다." };
  }

  const account = await ssoAccount(claims, access);
  if (!account.ok) return { kind: "failed", clear: true, message: account.message };

  return {
    kind: "renewed",
    session: { role: account.auth.role, employeeId: account.auth.employeeId, mustChangePassword: false },
    token,
  };
}
