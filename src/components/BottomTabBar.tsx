import type { ComponentType } from "react";
import Link from "next/link";
import { navItemsFor, type NavIcon } from "@/config/nav";
import type { Role } from "@/lib/session-token";
import { CompanyIcon, MailIcon, OrgIcon, UserIcon, UsersIcon } from "./icons";

/**
 * 모바일·태블릿 하단 탭바. lg(1024px) 이상에서는 숨고 Sidebar 가 대신합니다.
 *
 * 햄버거를 두 번 눌러야(열기 → 항목 선택) 이동하던 걸 한 번으로 줄이려고 만들었습니다.
 * 그래서 TopNav 의 모바일 드로어에서는 같은 링크를 뺐습니다 — 두 군데에 두면 활성
 * 표시가 둘로 갈리고, 어느 쪽이 진짜 현재 위치인지 헷갈립니다.
 *
 * 상태가 없어 서버 컴포넌트입니다. 현재 경로는 usePathname 대신 페이지가 넘기는
 * current 로 판단합니다 — Sidebar 와 같은 방식이라 두 메뉴의 활성 판정이 어긋나지 않습니다.
 *
 * 고정(fixed) 요소는 문서 흐름에서 빠지므로 같은 높이의 스페이서를 함께 내보냅니다.
 * 이게 없으면 페이지 맨 아래 내용이 탭바에 가려집니다.
 */

const ICONS: Record<NavIcon, ComponentType<{ className?: string }>> = {
  user: UserIcon,
  mail: MailIcon,
  users: UsersIcon,
  org: OrgIcon,
  company: CompanyIcon,
};

export function BottomTabBar({ role, current }: { role: Role; current: string }) {
  const items = navItemsFor(role);

  return (
    <>
      <div aria-hidden className="h-14 shrink-0 lg:hidden" />

      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 border-t border-line bg-surface lg:hidden"
      >
        {items.map((item) => {
          const active = current === item.href;
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // 항목 수가 역할에 따라 2개(회원)·4개(관리자)로 달라져서 폭을 고정하지
              // 않고 flex-1 로 균등 분할합니다.
              className={`flex flex-1 flex-col items-center justify-center gap-tight ${
                // 활성 brand-fg + 굵게, 비활성 fg-subtle (DVISION 공통 기준 8.2).
                active ? "text-xs font-semibold text-brand-fg" : "text-xs font-medium text-fg-subtle hover:text-fg-muted"
              }`}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
