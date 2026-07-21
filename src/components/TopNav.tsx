import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { UserIcon } from "./icons";
import { LogoutButton } from "./LogoutButton";

/**
 * 상단 네비게이션.
 *
 * `임직원 관리`·`템플릿` 은 관리자 세션에만 보입니다. 두 경로 모두 /admin 아래라
 * middleware 가 이미 막고 있지만, 회원에게 보여주고 눌렀을 때 튕기는 것보다
 * 아예 안 보이는 편이 낫습니다.
 *
 * `이메일 서명` 은 시안에 없던 항목입니다. 이 제품이 최종적으로 만들어 주는 게
 * 서명인데 진입로가 /edit 헤더의 링크 하나뿐이라 찾기 어려웠습니다.
 */

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/edit", label: "내 명함" },
  { href: "/edit/signature", label: "이메일 서명" },
  { href: "/admin/employees", label: "임직원 관리", adminOnly: true },
  { href: "/admin/templates", label: "템플릿", adminOnly: true },
];

export function TopNav({
  role,
  email,
  current,
}: {
  role: "member" | "admin";
  email?: string | null;
  current: string;
}) {
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-block px-section">
        {/*
          공식 로고는 심볼 위에 워드마크가 놓인 세로형(0.9:1)이라 64px 헤더에 그대로
          넣으면 글자가 8px 이하로 뭉갭니다. 심볼만 쓰고 워드마크는 텍스트로 잇습니다.
        */}
        <Link
          href="/edit"
          className="flex shrink-0 items-center gap-sibling text-title"
          aria-label="디비전 디지털 명함 홈"
        >
          <Image src={brand.symbol} alt="" width={256} height={256} priority className="h-7 w-7" />
          <span>
            <span className="text-primary">D</span>
            <span className="text-text">VISION</span>
          </span>
        </Link>

        <nav className="flex items-center gap-section">
          {items.map((item) => {
            const active = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                // 활성 표시는 색이 아니라 굵기로 합니다. primary 예산은 CTA·링크에 씁니다.
                className={
                  active ? "text-caption-bold text-text" : "text-caption text-sub-text hover:text-text"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-group">
          {email ? <span className="text-caption text-sub-text">{email}</span> : null}
          {/* 관리자로 다시 들어가려면 세션을 끊는 수밖에 없습니다. 개인 계정이 없어서입니다. */}
          <LogoutButton />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sub-bg">
            <UserIcon className="h-5 w-5 text-sub-text" />
          </span>
        </div>
      </div>
    </header>
  );
}
