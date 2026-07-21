import Link from "next/link";
import { UserIcon } from "./icons";

/**
 * 상단 네비게이션.
 *
 * `임직원 관리`·`템플릿` 은 관리자 세션에만 보입니다. 두 경로 모두 /admin 아래라
 * middleware 가 이미 막고 있지만, 회원에게 보여주고 눌렀을 때 튕기는 것보다
 * 아예 안 보이는 편이 낫습니다.
 */

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/edit", label: "내 명함" },
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
        <Link href="/edit" className="text-title" aria-label="디비전 디지털 명함 홈">
          <span className="text-primary">D</span>
          <span className="text-text">VISION</span>
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
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sub-bg">
            <UserIcon className="h-5 w-5 text-sub-text" />
          </span>
        </div>
      </div>
    </header>
  );
}
