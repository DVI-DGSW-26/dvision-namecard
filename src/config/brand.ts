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
  /** 공식 로고(세로형 — 심볼 위, 워드마크 아래). 비율 0.9:1 이라 좁은 가로 공간에는 맞지 않습니다. */
  logo: "/brand/logo.png",

  /** 로고에서 심볼만 분리한 정사각 버전. 헤더처럼 높이가 좁은 자리에 씁니다. */
  symbol: "/brand/symbol.png",

  /** compact | standard | wide | minimal */
  signatureTemplate: "compact",

  /** portrait | landscape */
  profileLayout: "portrait",
} as const;

export type Brand = typeof brand;
export type SignatureTemplate = "compact" | "standard" | "wide" | "minimal";
export type ProfileLayout = "portrait" | "landscape";
