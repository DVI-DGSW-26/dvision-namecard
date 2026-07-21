/**
 * 디자인 토큰 — 단일 출처.
 *
 * 이 파일과 app/globals.css 의 @theme 블록은 같은 값을 두 표현으로 담고 있습니다.
 * Tailwind v4 는 CSS 에서 토큰을 읽으므로 화면 스타일은 globals.css 가,
 * 인라인 style 문자열(서명 HTML 등)은 이 파일이 담당합니다. 값을 바꿀 땐 둘 다 고치세요.
 *
 * 핵심 제약: Primary 는 화면의 5% 이내.
 * 위계는 색이 아니라 크기·굵기·여백으로 만듭니다. Primary 를 쓸 수 있는 곳은
 * 섹션 번호(01/02/03), CTA 버튼, 링크, 서명 좌측 세로선뿐입니다.
 * 그 외 강조는 전부 무채색(text/subText)과 여백으로 해결하세요.
 */

export const tokens = {
  color: {
    /** 로고 심볼 상단 자주. CTA·링크·서명 세로선에만. 화면 5% 이내. */
    primary: "#931B82",
    primaryHover: "#6A0F5D",
    /** 거의 쓰지 않음. 선택 상태 배경 정도로만. */
    primarySoft: "#F3E8F7",
    /** 본문, 이름, 숫자, 라벨 */
    text: "#212121",
    /** 보조 정보. 직급, 캡션, 힌트 */
    subText: "#6B6B6B",
    /** 구분선, 인풋 테두리, 배지 테두리 */
    border: "#E5E7EB",
    /** 프로필 사진 placeholder, 아바타 */
    subBg: "#F5F5F5",
    /** 기본 배경. 절대 바꾸지 않음 */
    bg: "#FFFFFF",
  },

  /**
   * 크기 4단계 · 굵기 2단계. 이 6개 조합 외에는 쓰지 마세요.
   * 14 / 16 / 20px 같은 중간 크기는 금지입니다.
   */
  font: {
    display: { size: 28, weight: 600 },
    title: { size: 18, weight: 600 },
    body: { size: 15, weight: 400 },
    bodyBold: { size: 15, weight: 600 },
    caption: { size: 13, weight: 400 },
    captionBold: { size: 13, weight: 600 },
  },
  letterSpacing: "-0.01em",
  lineHeight: 1.6,

  /** 4 / 8 / 16 / 24 / 40 다섯 값만. 12·20·32 같은 중간값 금지. */
  space: {
    /** 같은 덩어리 내부 — 이름↔직급, 라벨↔값 */
    tight: 4,
    /** 형제 요소 사이 — 버튼↔버튼, 배지↔배지 */
    sibling: 8,
    /** 연관 그룹 사이 — 이름 블록↔CTA */
    group: 16,
    /** 섹션 내부 여백 — 섹션 헤더↔첫 행 */
    section: 24,
    /** 서로 다른 그룹 — 연락처 블록↔회사 블록 */
    block: 40,
  },

  /**
   * TODO: 토큰 정의서 이미지 하단(Shape · Effect)이 잘려 있어 임시값입니다.
   * 실제 값을 받으면 여기와 globals.css 의 대응 토큰만 고치면 됩니다.
   * 카드 경계는 그림자가 아니라 1px border 로 처리하고 있습니다.
   */
  shape: {
    radius: 8,
    shadow: "none",
    borderWidth: 1,
  },
} as const;

export type Tokens = typeof tokens;
