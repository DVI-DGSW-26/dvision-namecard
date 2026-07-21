/**
 * 로그인 후 되돌아갈 경로 검증.
 *
 * middleware 가 /gate?next=<경로> 로 보내는데, next 는 주소창에서 누구나 고칠 수
 * 있는 값입니다. 그대로 이동에 쓰면 `/gate?next=https://evil.example` 같은 링크로
 * 오픈 리다이렉트가 됩니다. 피싱에 그대로 쓰이는 취약점입니다.
 *
 * 허용 조건을 좁게 잡고, 하나라도 어긋나면 기본 경로로 되돌립니다.
 */

/** 검증에 실패했을 때 보낼 곳. */
export const DEFAULT_REDIRECT = "/edit";

export function safeRedirect(next: string | null | undefined): string {
  if (!next) return DEFAULT_REDIRECT;

  // 반드시 내부 절대경로여야 합니다.
  if (!next.startsWith("/")) return DEFAULT_REDIRECT;

  // `//evil.com` 은 프로토콜 상대 URL 이라 외부로 나갑니다.
  // `/\evil.com` 도 일부 브라우저가 같은 의미로 해석합니다.
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_REDIRECT;

  // 개행·탭·제어문자가 섞이면 헤더 조작이나 우회에 쓰일 수 있습니다.
  if (/[\u0000-\u001F\u007F]/.test(next)) return DEFAULT_REDIRECT;

  // `/gate` 로 되돌리면 로그인 직후 다시 로그인 화면이 뜨는 고리가 생깁니다.
  if (next === "/gate" || next.startsWith("/gate?") || next.startsWith("/gate/")) {
    return DEFAULT_REDIRECT;
  }

  return next;
}
