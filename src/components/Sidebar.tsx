import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { navItemsFor, type NavIcon } from "@/config/nav";
import type { Role } from "@/lib/session-token";
import { CompanyIcon, MailIcon, OrgIcon, UserIcon, UsersIcon } from "./icons";

/**
 * 왼쪽 사이드바 — PC(1024px 이상) 전용. 그보다 좁으면 BottomTabBar 가 이동을 맡습니다.
 *
 * 항목은 config/nav.ts 한 곳에서 옵니다(하단 탭바와 같은 목록). 메뉴가 1단이라
 * DVISION 공통 기준의 "단독 메뉴" 모양만 씁니다: 선택한 메뉴 하나만 brand 로 채우고,
 * 나머지는 바탕 없이 회색 글자입니다. 화면에 brand 채움 박스는 늘 1개입니다.
 *
 * 활성 판정은 usePathname 대신 페이지가 넘기는 current 로 합니다 — 헤더·하단 탭바와
 * 같은 방식이라 세 곳의 활성 표시가 어긋나지 않고, 상태가 없어 서버 컴포넌트로 둡니다.
 */

const ICONS: Record<NavIcon, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  user: UserIcon,
  mail: MailIcon,
  users: UsersIcon,
  org: OrgIcon,
  company: CompanyIcon,
};

export function Sidebar({ role, current }: { role: Role; current: string }) {
  const items = navItemsFor(role);

  return (
    <aside className="sidebar-scope hidden h-full w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      {/*
        헤더 높이(96px)와 맞춘 로고 자리. 앱 껍데기라 서비스 로고(dingdong)를 씁니다 —
        회사 로고(DVISION)는 명함 쪽 몫입니다(config/brand.ts).
      */}
      <div className="flex h-24 shrink-0 items-center pl-6 pr-4">
        <Link href="/edit" className="flex items-center" aria-label="dingdong 홈으로">
          <Image
            src={brand.serviceLogo}
            alt="dingdong"
            width={brand.serviceLogoWidth}
            height={brand.serviceLogoHeight}
            priority
            className="h-10 w-auto"
          />
        </Link>
      </div>

      <nav aria-label="주요 메뉴" className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 pb-4">
        {items.map((item) => {
          const active = current === item.href;
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-lg px-3 text-[0.9375rem] ${
                active
                  ? "bg-brand font-bold text-on-brand shadow-md"
                  : "font-semibold text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
