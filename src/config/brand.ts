import { tokens } from "./tokens";

/**
 * 브랜드 설정.
 *
 * 색상은 tokens.ts 에서 그대로 가져옵니다. 여기에 hex 값을 다시 적으면
 * 토큰과 어긋나는 순간을 아무도 못 잡습니다. 색을 바꿀 땐 tokens.ts 와
 * globals.css 만 고치세요.
 */
export const brand = {
  primary: tokens.color.primary,
  ink: tokens.color.text,
  muted: tokens.color.subText,
  line: tokens.color.border,
  logo: "/brand/logo.png",

  /** compact | standard | wide | minimal */
  signatureTemplate: "compact",

  /** portrait | landscape */
  profileLayout: "portrait",
} as const;

export type Brand = typeof brand;
export type SignatureTemplate = "compact" | "standard" | "wide" | "minimal";
export type ProfileLayout = "portrait" | "landscape";
