import { NextResponse, type NextRequest } from "next/server";
import { SSO_EXP_COOKIE, SSO_REFRESH_PATH } from "@/lib/oidc";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * /edit, /admin 보호. 세션이 없거나 만료됐으면 /gate 로 보냅니다.
 * SSO 세션이면 /api/auth/refresh 로 보내 갱신합니다.
 *
 * Edge 런타임에서 돌기 때문에 lib/auth.ts(node:crypto 의존)를 여기서
 * import 하면 안 됩니다. jose 기반인 lib/session-token.ts 만 사용하세요.
 *
 * /c/[slug] 는 공개 경로라 matcher 에 넣지 않습니다.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    /*
      SSO 로 들어온 세션이면 게이트 대신 갱신 경로로 보냅니다. 갱신은 그 경로 한
      곳에서만 하고(refresh token 은 한 번만 쓸 수 있습니다), 실패하면 거기서
      통합 로그인으로 보냅니다.

      미리 받기(prefetch) 요청은 보내지 않습니다. 링크 여러 개를 한꺼번에 미리 받으면
      갱신이 동시에 여러 번 일어나 세션이 끊깁니다. 실제로 이동할 때 다시 들어옵니다.
    */
    const prefetch =
      request.headers.has("next-router-prefetch") ||
      request.headers.get("purpose") === "prefetch" ||
      request.headers.get("sec-purpose")?.includes("prefetch");
    if (request.cookies.has(SSO_EXP_COOKIE) && !prefetch) {
      const refresh = new URL(SSO_REFRESH_PATH, request.url);
      refresh.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(refresh);
    }

    const gate = new URL("/gate", request.url);
    // 인증 후 원래 가려던 곳으로 되돌려보내기 위해 경로를 남겨둡니다.
    gate.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(gate);
  }

  /*
    초기 비밀번호 강제 변경 게이트는 없앴습니다.

    예전에는 mustChangePassword=true 인 사람을 /edit/password 한 곳에만 가둬
    놓았는데, 그 화면에는 로그아웃도 메뉴도 없어서 옛 쿠키(값이 true 로 박힌)를
    든 사람이 영영 빠져나오지 못했습니다. 강제 변경 자체를 없애기로 했으므로
    이 게이트도 제거합니다 — 이제 어떤 토큰 값이든 여기서 갇히지 않습니다.
  */

  // 관리자 화면은 ADMIN 권한을 가진 계정만 들어갑니다.
  if (request.nextUrl.pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/edit", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/edit/:path*", "/admin/:path*"],
};
