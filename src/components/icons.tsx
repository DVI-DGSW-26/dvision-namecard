/**
 * 인라인 SVG 아이콘.
 *
 * 아이콘 라이브러리를 넣지 않은 이유: 지금 필요한 게 5개뿐이고, 서명 HTML 과 달리
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
