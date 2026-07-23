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
  /*
   * 로고가 두 벌입니다. 섞어 쓰면 안 됩니다.
   *
   *   DVISION  = 회사. 명함에 찍히는 신원입니다.
   *              공개 프로필·명함 이미지(card.png)·vCard·이메일 서명이 씁니다.
   *   dingdong = 이 서비스. 앱 껍데기(헤더·로그인 화면)에만 씁니다.
   *
   * 받는 사람이 보는 건 DVISION 이고, 직원이 로그인해서 보는 건 dingdong 입니다.
   * 명함 쪽에 dingdong 을 넣으면 거래처가 모르는 이름이 명함에 찍혀 나갑니다.
   */

  /** DVISION 공식 로고(세로형 — 심볼 위, 워드마크 아래). 비율 0.9:1 이라 좁은 가로 공간에는 맞지 않습니다. */
  logo: "/brand/logo.png",

  /** DVISION 로고에서 심볼만 분리한 정사각 버전. */
  symbol: "/brand/symbol.png",

  /**
   * DVISION 가로형 로고(심볼 + 워드마크 잠금). 203x45 (4.51:1).
   * 명함 이미지(card.png) 우상단이 씁니다. 세로형 logo 는 이 자리에 안 맞습니다.
   *
   * 예전엔 symbol.png 옆에 "D"+"VISION" 을 텍스트로 조판해 흉내 냈는데,
   * 자간·굵기가 공식 로고와 미묘하게 달라 이 파일로 대체했습니다.
   */
  logoWordmark: "/brand/logo-wordmark.png",
  logoWordmarkWidth: 203,
  logoWordmarkHeight: 45,

  /**
   * dingdong 서비스 로고. 심볼 + 워드마크 가로형 잠금입니다.
   * 968x256 (3.78:1) — 높이만 지정하고 폭은 w-auto 로 두세요.
   */
  serviceLogo: "/brand/dingdong.png",
  serviceLogoWidth: 968,
  serviceLogoHeight: 256,

  /**
   * dingdong 심볼(웃는 얼굴)만. 256 정사각. 워드마크가 뭉갤 만큼 좁은 자리에 씁니다.
   *
   * 파비콘·홈 화면 아이콘은 여기가 아닙니다. Next.js 규약대로 src/app 의
   * favicon.ico · icon.png · apple-icon.png 가 그 일을 하고, <link> 태그도
   * 자동으로 나갑니다. 아이콘을 바꿀 땐 그 세 파일을 같이 갈아 주세요.
   */
  serviceMark: "/brand/dingdong-mark.png",

  /**
   * 회사 홈페이지. 공개 카드의 CTA(홈페이지 바로가기)가 여기로 갑니다.
   *
   * 정식 출처는 DB 의 Company.homepageUrl 이고(/edit 에서 고칩니다) 이 값은
   * 그게 비어 있을 때만 쓰는 바닥값입니다. 회사가 하나뿐인 서비스라 CTA 가
   * 조용히 사라지는 쪽이 더 나쁩니다.
   */
  homepage: "https://dvi-ind.com/",

  /** compact | standard | wide | minimal */
  signatureTemplate: "compact",

  /** portrait | landscape */
  profileLayout: "portrait",
} as const;

export type Brand = typeof brand;
export type SignatureTemplate = "compact" | "standard" | "wide" | "minimal";
export type ProfileLayout = "portrait" | "landscape";
