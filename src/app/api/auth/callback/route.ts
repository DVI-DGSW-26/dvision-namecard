import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import {
  SSO_PENDING_COOKIE,
  decodeJwt,
  discover,
  verifyPending,
  type TokenClaims,
} from "@/lib/oidc";
import { safeRedirect } from "@/lib/safe-redirect";
import { findOrLinkEmployee } from "@/lib/sso";

/**
 * GET /api/auth/callback — 사내 통합 로그인 결과 처리.
 *
 * 검증(state · iss · aud · nonce · exp · employee 롤)을 통과하면 기존 세션
 * 체계(dvi_session)를 그대로 발급합니다 — 이후 화면·권한 검사 코드는 SSO 를
 * 모릅니다. 명함 연결은 lib/sso.ts 가 합니다 (sub → 이메일 → 생성).
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
  if (params.get("error")) {
    return fail(
      req,
      `통합 로그인에서 거절되었습니다. (${params.get("error_description") || params.get("error")})`,
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  const pending = await verifyPending(req.cookies.get(SSO_PENDING_COOKIE)?.value);
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

  const token = (await tokenRes.json()) as { id_token?: string; access_token?: string };
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

  /* 재직자 확인 — 부서가 배정된 계정에만 employee 롤이 붙습니다 */
  const realmRoles = [
    ...(claims.realm_access?.roles ?? []),
    ...(access?.realm_access?.roles ?? []),
  ];
  if (!realmRoles.includes("employee")) {
    return fail(req, "재직 중이며 부서가 배정된 계정만 이용할 수 있습니다. 관리팀에 문의해주세요.");
  }

  /* 명함 연결 — 권한 확인이 끝난 뒤에만 계정을 만듭니다 */
  const auth = await findOrLinkEmployee(
    claims.sub,
    String(claims.email || "").toLowerCase(),
    claims.name || claims.preferred_username || "",
  );
  if (!auth) {
    return fail(req, "명함 계정을 연결하지 못했습니다. 관리자에게 문의해주세요.");
  }

  /* 기존 세션 체계를 그대로 사용 — remember 없이 12시간 */
  await createSession(
    { role: auth.role, employeeId: auth.employeeId, mustChangePassword: false },
    false,
  );

  const res = NextResponse.redirect(new URL(safeRedirect(pending.next), req.nextUrl.origin), 302);
  res.cookies.set(SSO_PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
