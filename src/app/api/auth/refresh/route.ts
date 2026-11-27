import { NextResponse, type NextRequest } from "next/server";
import { SSO_BACK_COOKIE } from "@/lib/oidc";
import { safeRedirect } from "@/lib/safe-redirect";
import { clearSsoSession, renewSsoSession, setSsoSession } from "@/lib/sso-session";

/**
 * /api/auth/refresh — SSO 세션 갱신. 갱신은 이 경로 한 곳에서만 합니다.
 *
 * refresh token 쿠키(dvi_rt)는 이 경로에만 실려 오므로 다른 경로는 갱신할 수도 없습니다.
 *
 *   GET  ?next=  proxy 가 세션이 끝난 페이지 이동을 이리로 보냅니다. 갱신하고 원래 주소로.
 *   POST         화면(SessionKeeper)이 세션이 끝나기 전에 부릅니다. JSON 으로 답합니다.
 *
 * 갱신이 실패하면 세션을 지우고 버튼 없이 바로 통합 로그인으로 보냅니다. SSO 가
 * 살아 있으면 화면 없이 돌아옵니다. 다녀온 직후(dvi_sso_back) 또 실패하면 다시
 * 보내지 않고 게이트에 안내를 띄웁니다 — 무한 반복 방지.
 *
 * Node 런타임입니다 (Route Handler 기본값).
 */

export async function GET(req: NextRequest) {
  const next = safeRedirect(req.nextUrl.searchParams.get("next"));
  const result = await renewSsoSession(req);

  if (result.kind !== "failed") {
    const res = NextResponse.redirect(new URL(next, req.nextUrl.origin), 302);
    if (result.kind === "renewed") await setSsoSession(res, result.session, result.token);
    return res;
  }

  const stop = !result.clear || req.cookies.has(SSO_BACK_COOKIE);
  const dest = stop
    ? `/gate?next=${encodeURIComponent(next)}&error=${encodeURIComponent(result.message)}`
    : `/api/auth/sso?next=${encodeURIComponent(next)}`;
  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin), 302);
  if (result.clear) clearSsoSession(res);
  return res;
}

export async function POST(req: NextRequest) {
  const result = await renewSsoSession(req);

  if (result.kind !== "failed") {
    const res = NextResponse.json({ ok: true });
    if (result.kind === "renewed") await setSsoSession(res, result.session, result.token);
    return res;
  }

  // 통합 로그인 서버 장애면 세션을 지우지 않고 화면이 잠시 뒤 다시 시도합니다
  const res = NextResponse.json(
    { error: result.message, needsLogin: result.clear },
    { status: result.clear ? 401 : 503 },
  );
  if (result.clear) clearSsoSession(res);
  return res;
}
