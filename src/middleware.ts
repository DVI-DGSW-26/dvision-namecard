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

  /*
    관리자가 발급한 초기 비밀번호로 들어온 사람은 비밀번호부터 바꿉니다.

    관리자도 아는 비밀번호를 계속 쓰면 그 사람으로 남긴 흔적과 본인의 흔적을
    구분할 수 없습니다. 바꾸는 화면 자체는 막지 않아야 하므로 그 경로만 통과시킵니다.
  */
  const { pathname } = request.nextUrl;
  if (session.mustChangePassword && pathname !== "/edit/password") {
    return NextResponse.redirect(new URL("/edit/password", request.url));
  }

  // 관리자 화면은 ADMIN 권한을 가진 계정만 들어갑니다.
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/edit", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/edit/:path*", "/admin/:path*"],
};
