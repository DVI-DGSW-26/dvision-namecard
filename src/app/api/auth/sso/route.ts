import { NextResponse, type NextRequest } from "next/server";
import { SSO_PENDING_COOKIE, discover, pkceChallenge, randomString, signPending } from "@/lib/oidc";
import { safeRedirect } from "@/lib/safe-redirect";

/**
 * GET /api/auth/sso — 사내 통합 로그인(Keycloak) 시작.
 *
 * 게이트의 "DVI 계정으로 로그인" 버튼이 여기로 옵니다. 공용 비밀번호 폼과
 * 병행합니다 — 이 경로가 자리를 잡으면 폼 쪽을 걷어냅니다.
 */
export async function GET(req: NextRequest) {
  const issuer = process.env.OIDC_ISSUER ?? "";
  const clientId = process.env.OIDC_CLIENT_ID ?? "dding-dong";
  if (!issuer || !process.env.SESSION_SECRET) {
    return NextResponse.json(
      { error: "서버 환경변수(OIDC_ISSUER / SESSION_SECRET)가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const meta = await discover(issuer);

  const state = randomString(24);
  const nonce = randomString(24);
  const verifier = randomString(48);
  const next = safeRedirect(req.nextUrl.searchParams.get("next"));

  const pending = await signPending({ state, nonce, verifier, next });

  const auth = new URL(meta.authorization_endpoint);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", `${req.nextUrl.origin}/api/auth/callback`);
  auth.searchParams.set("scope", "openid profile email");
  auth.searchParams.set("state", state);
  auth.searchParams.set("nonce", nonce);
  auth.searchParams.set("code_challenge", await pkceChallenge(verifier));
  auth.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(auth.toString(), 302);
  res.cookies.set(SSO_PENDING_COOKIE, pending, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
