/**
 * 디자인 토큰 (단일 출처).
 *
 * 여기 색상값은 app/globals.css 의 @theme 블록과 짝을 이룹니다.
 * Tailwind v4 는 CSS 에서 토큰을 읽으므로 색을 바꿀 때는 두 곳을 같이 고쳐야 합니다.
 * - 클래스로 쓸 때(예: bg-brand-primary) → globals.css
 * - 인라인 스타일 문자열이 필요할 때(서명 HTML 등) → 이 파일
 *
 * 서명 HTML 은 외부 CSS 를 못 쓰기 때문에 이 객체의 값을 직접 문자열로 박아 넣습니다.
 */
export const brand = {
  primary: "#6B4EE6",
  ink: "#1A1A1E",
  muted: "#6B6B75",
  line: "#E5E5EA",
  logo: "/brand/logo.png",

  /** compact | standard | wide | minimal */
  signatureTemplate: "standard",

  /** portrait | landscape */
  profileLayout: "portrait",
} as const;

export type Brand = typeof brand;
export type SignatureTemplate = "compact" | "standard" | "wide" | "minimal";
export type ProfileLayout = "portrait" | "landscape";
