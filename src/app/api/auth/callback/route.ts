import { NextResponse, type NextRequest } from "next/server";
import {
  SSO_PENDING_COOKIE,
  decodeJwt,
  discover,
  verifyPending,
  type TokenClaims,
} from "@/lib/oidc";
import { safeRedirect } from "@/lib/safe-redirect";
import { markSsoReturn, setSsoSession, ssoAccount, type TokenResponse } from "@/lib/sso-session";

/**
 * GET /api/auth/callback — 사내 통합 로그인 결과 처리.
 *
 * 검증(state · iss · aud · nonce · exp · employee 롤)을 통과하면 기존 세션
 * 쿠키(dvi_session)를 발급합니다 — 이후 화면·권한 검사 코드는 SSO 를 모릅니다.
 * 명함 연결은 lib/sso.ts 가 합니다 (sub → 이메일 → 생성).
 *
 * 세션은 15분짜리이고 refresh token 으로 연장합니다 (lib/sso-session.ts).
 *
 * prisma 를 쓰므로 Node 런타임입니다 (Route Handler 기본값).
 */

function fail(req: NextRequest, message: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = `?error=${encodeURIComponent(message)}`;
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const issuer = process.env.OIDC_ISSUER ?? "";
  const clientId = process.env.OIDC_CLIENT_ID ?? "dding-dong";
  const clientSecret = process.env.OIDC_CLIENT_SECRET ?? "";
  if (!issuer || !process.env.SESSION_SECRET) {
    return fail(req, "서버 환경변수가 설정되지 않았습니다. 관리자에게 문의해주세요.");
  }

  const params = req.nextUrl.searchParams;
  const pending = await verifyPending(req.cookies.get(SSO_PENDING_COOKIE)?.value);
  if (params.get("error")) {
    /*
      로그인 탭을 여러 개 열어 둔 상태에서 생기는 오류입니다. 다시 시도하면 바로
      들어가지므로 오류 화면 대신 로그인을 한 번만 다시 시작합니다.
    */
    if (params.get("error_description") === "authentication_expired" && !pending?.retried) {
      const retry = new URL("/api/auth/sso", req.nextUrl.origin);
      retry.searchParams.set("next", safeRedirect(pending?.next));
      retry.searchParams.set("retried", "1");
      return NextResponse.redirect(retry, 302);
    }
    return fail(
      req,
      `통합 로그인에서 거절되었습니다. (${params.get("error_description") || params.get("error")})`,
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !pending || pending.state !== state) {
    return fail(req, "로그인 정보가 없거나 만료되었습니다. 다시 시도해주세요.");
  }

  const meta = await discover(issuer);

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: `${req.nextUrl.origin}/api/auth/callback`,
    code_verifier: pending.verifier,
  });
  if (clientSecret) form.set("client_secret", clientSecret);

  const tokenRes = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form,
  });
  if (!tokenRes.ok) {
    // 미리보기 배포는 주소가 매번 달라 redirect_uri 를 등록할 수 없습니다.
    return fail(req, `통합 로그인 서버가 토큰 발급을 거절했습니다 (${tokenRes.status}). 운영 주소에서 시도해주세요.`);
  }

  const token = (await tokenRes.json()) as TokenResponse;
  if (!token.id_token) return fail(req, "계정 정보를 받지 못했습니다.");

  let claims: TokenClaims;
  let access: TokenClaims | null = null;
  try {
    claims = decodeJwt(token.id_token);
  } catch {
    return fail(req, "계정 정보를 해석하지 못했습니다.");
  }
  try {
    access = token.access_token ? decodeJwt(token.access_token) : null;
  } catch {
    access = null;
  }

  /* 토큰 검증 */
  const audOk = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
  if (!audOk) return fail(req, "이 서비스를 위해 발급된 계정 정보가 아닙니다.");
  if (claims.iss !== meta.issuer) return fail(req, "발급처가 올바르지 않습니다.");
  if (claims.nonce !== pending.nonce) return fail(req, "로그인 응답이 요청과 맞지 않습니다.");
  if (!claims.exp || claims.exp * 1000 < Date.now()) return fail(req, "계정 정보가 만료되었습니다.");
  if (!claims.sub) return fail(req, "계정 식별자가 없습니다.");

  /* 재직자 확인과 명함 연결 — 갱신 때도 같은 기준으로 다시 봅니다 */
  const account = await ssoAccount(claims, access);
  if (!account.ok) return fail(req, account.message);

  /*
    30일 "로그인 유지" 쿠키는 쓰지 않습니다. 갱신 없이 오래 남으면 퇴사·권한 변경이
    그동안 반영되지 않습니다. 15분 세션을 refresh token 으로 이어 갑니다.
  */
  const res = NextResponse.redirect(new URL(safeRedirect(pending.next), req.nextUrl.origin), 302);
  await setSsoSession(
    res,
    { role: account.auth.role, employeeId: account.auth.employeeId, mustChangePassword: false },
    token,
  );
  markSsoReturn(res);
  res.cookies.set(SSO_PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
