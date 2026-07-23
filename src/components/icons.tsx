/**
 * 인라인 SVG 아이콘.
 *
 * 아이콘 라이브러리를 넣지 않은 이유: 필요한 게 몇 개뿐이고, 서명 HTML 과 달리
 * 여기서는 stroke 색을 currentColor 로 상속받는 게 중요해서입니다.
 * 크기는 호출부에서 className 으로 지정합니다.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20c0-3.6 3.36-6 7.5-6s7.5 2.4 7.5 6" />
    </svg>
  );
}

/** 여러 명 — 임직원 관리 탭. UserIcon 과 달리 뒤에 한 명이 더 서 있습니다. */
export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9.5" cy="8.5" r="3.25" />
      <path d="M3 19.5c0-3.15 2.9-5.25 6.5-5.25s6.5 2.1 6.5 5.25" />
      <path d="M16.25 5.6a3.25 3.25 0 0 1 0 5.8" />
      <path d="M18 14.6c1.9.7 3 2.35 3 4.9" />
    </svg>
  );
}

/** 조직도 — 조직 관리 탭. 위 상자 하나에서 아래 상자 둘로 갈라지는 계통도입니다. */
export function OrgIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="3" width="6" height="4.5" rx="1" />
      <rect x="3" y="16.5" width="6" height="4.5" rx="1" />
      <rect x="15" y="16.5" width="6" height="4.5" rx="1" />
      <path d="M12 7.5v4.5M6 16.5V12h12v4.5" />
    </svg>
  );
}

/*
 * 공개 카드 아래 아이콘 줄 — 링크드인 · 유튜브 · 인스타그램 · 홈페이지.
 *
 * 브랜드 공식 로고(면으로 채운 글리프)를 쓰지 않고 이 파일의 선 스타일에 맞췄습니다.
 * 넷이 나란히 놓이는데 셋만 면이고 하나만 선이면 줄이 들쭉날쭉해 보입니다.
 * currentColor 를 물려받아야 hover 색이 따라오는 것도 같은 이유입니다.
 */

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" />
      {/* i 의 점만 면으로 채웁니다. 이 크기에서 선으로 그리면 뭉개집니다. */}
      <circle cx="7.5" cy="7.4" r="0.9" fill="currentColor" stroke="none" />
      <path d="M7.5 10.6V17" />
      <path d="M11.6 17v-6.4M11.6 13.4c0-1.6 1.1-2.8 2.6-2.8s2.3 1.2 2.3 2.8V17" />
    </svg>
  );
}

export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
      <path d="M10.6 9.6 15.8 12l-5.2 2.4V9.6Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 홈페이지. 지구본이라 "회사 사이트" 로 읽힙니다 — 집 아이콘은 이 앱의 홈으로 오해됩니다. */
export function GlobeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.5 3.7 5.6 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.6-3.7-9S9.6 5.5 12 3Z" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.6 3.5h3l1.5 3.75-2.1 1.35a11.5 11.5 0 0 0 5.4 5.4l1.35-2.1L19.5 13.4v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.8 7 7.2 5.2a1.7 1.7 0 0 0 2 0L20.2 7" />
    </svg>
  );
}

export function MessageIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M20.5 12c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20l1.5-3.3A6.5 6.5 0 0 1 3.5 12c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z" />
    </svg>
  );
}

/** 아래로 내려받기 — 공개 카드의 "명함 이미지 저장" 안내에 씁니다. */
export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v10.5M8 11l4 4 4-4" />
      <path d="M4.5 17.5v1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
