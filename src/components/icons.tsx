/**
 * 아이콘.
 *
 * 선 아이콘은 Lucide 하나로 통일합니다(DVISION 공통 기준). 이름은 예전 인라인 SVG
 * 시절 그대로 두어 호출부를 건드리지 않습니다. 크기는 호출부에서 className 으로
 * 16 / 18 / 20 / 24px(size-4 · size-[18px] · size-5 · size-6) 중 하나를 주세요.
 * 색은 currentColor 를 따릅니다.
 */
export {
  ArrowRight as ArrowRightIcon,
  Building2 as CompanyIcon,
  ChevronDown as ChevronDownIcon,
  Download as DownloadIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Globe as GlobeIcon,
  LoaderCircle as SpinnerIcon,
  Mail as MailIcon,
  Menu as MenuIcon,
  MessageSquare as MessageIcon,
  Network as OrgIcon,
  Phone as PhoneIcon,
  Search as SearchIcon,
  User as UserIcon,
  UserPlus as UserPlusIcon,
  Users as UsersIcon,
  X as CloseIcon,
} from "lucide-react";

/*
 * 공개 카드 아래 아이콘 줄 — 링크드인 · 유튜브 · 인스타그램.
 *
 * Lucide 에 브랜드 로고가 없어 직접 그립니다. 홈페이지(GlobeIcon, Lucide)와 나란히
 * 놓이므로 선 굵기·끝 모양을 Lucide 기본값(2px, round)에 맞췄습니다.
 * currentColor 를 물려받아야 hover 색이 따라옵니다.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

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
