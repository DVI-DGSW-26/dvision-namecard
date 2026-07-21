import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * /edit, /admin 보호. 세션이 없거나 만료됐으면 /gate 로 보냅니다.
 *
 * Edge 런타임에서 돌기 때문에 prisma 나 lib/auth.ts(node:crypto 의존)를 여기서
 * import 하면 안 됩니다. jose 기반인 lib/session-token.ts 만 사용하세요.
 *
 * /c/[slug] 는 공개 경로라 matcher 에 넣지 않습니다.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const gate = new URL("/gate", request.url);
    // 인증 후 원래 가려던 곳으로 되돌려보내기 위해 경로를 남겨둡니다.
    gate.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(gate);
  }

  // 회사 정보 수정은 관리자 비밀번호로 들어온 세션만 허용합니다.
  if (request.nextUrl.pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/edit", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/edit/:path*", "/admin/:path*"],
};
