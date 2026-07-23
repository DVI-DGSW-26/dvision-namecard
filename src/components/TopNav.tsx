"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { navItemsFor } from "@/config/nav";
import type { Role } from "@/lib/session-token";
import { CloseIcon, UserIcon } from "./icons";
import { LogoutButton } from "./LogoutButton";

/**
 * 상단 네비게이션. 항목은 config/nav.ts 에 있습니다 — 모바일 하단 탭바와 같은 목록입니다.
 *
 * `이메일 서명` 은 시안에 없던 항목입니다. 이 제품이 최종적으로 만들어 주는 게
 * 서명인데 진입로가 /edit 헤더의 링크 하나뿐이라 찾기 어려웠습니다.
 *
 * md(768px) 미만에서는 가로 메뉴를 숨깁니다. 375px 에 로고와 메뉴 3개와 이메일
 * 주소를 한 줄로 밀어 넣으면 가로 스크롤이 생깁니다. 그 폭에서의 이동은
 * BottomTabBar 가 맡고, 여기 남는 드로어는 계정(이메일·로그아웃) 전용입니다.
 * 예전에는 드로어에 메뉴도 함께 있었는데, 이동할 때마다 열고 고르는 두 번을
 * 거쳐야 해서 탭바로 옮겼습니다.
 *
 * 드로어는 덮개(overlay)가 아니라 헤더 아래로 밀고 들어오는 방식입니다 —
 * body 스크롤을 잠글 필요가 없어 사고가 날 여지가 적습니다.
 *
 * 드로어 때문에 클라이언트 컴포넌트가 됐습니다. props 는 전부 직렬화 가능한
 * 값이라 서버 페이지에서 그대로 넘기면 됩니다.
 */

export function TopNav({
  role,
  email,
  current,
}: {
  role: Role;
  email?: string | null;
  current: string;
}) {
  const items = navItemsFor(role);
  const [open, setOpen] = useState(false);

  // 라우트가 바뀌면 닫습니다. 페이지마다 TopNav 를 새로 그리지만 React 가 같은
  // 자리의 컴포넌트로 보고 state 를 유지할 수 있어서, current 를 기준으로 직접 닫습니다.
  // effect 가 아니라 렌더 중 조정입니다 — effect 로 하면 드로어가 열린 채 한 프레임
  // 깜빡이고, 연쇄 렌더가 생깁니다. (react.dev "prop 이 바뀔 때 state 조정하기")
  const [renderedFor, setRenderedFor] = useState(current);
  if (renderedFor !== current) {
    setRenderedFor(current);
    setOpen(false);
  }

  // Esc 로 닫기. 드로어가 열린 동안만 리스너를 겁니다.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-group px-group md:gap-block md:px-section">
        {/*
          헤더는 앱 껍데기라 서비스 로고(dingdong)를 씁니다. 회사 로고(DVISION)는
          명함 쪽 몫입니다 — config/brand.ts 의 설명을 보세요.

          가로형 잠금(4.16:1)이라 64px 헤더에 그대로 들어갑니다. 예전 DVISION
          세로형 로고는 비율이 0.9:1 이라 넣으면 글자가 8px 이하로 뭉개져서,
          심볼만 쓰고 워드마크를 텍스트로 흉내 내야 했습니다. 이제 필요 없습니다.

          높이만 정하고 폭은 w-auto 로 둡니다. width/height 는 원본 픽셀값이고
          레이아웃 폭이 아니라 종횡비 계산용입니다.
        */}
        <Link href="/edit" className="flex shrink-0 items-center" aria-label="dingdong 홈으로">
          <Image
            src={brand.serviceLogo}
            alt="dingdong"
            width={brand.serviceLogoWidth}
            height={brand.serviceLogoHeight}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-section md:flex">
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

        <div className="ml-auto hidden items-center gap-group md:flex">
          {email ? <span className="text-caption text-sub-text">{email}</span> : null}
          {/* 관리자로 다시 들어가려면 세션을 끊는 수밖에 없습니다. 개인 계정이 없어서입니다. */}
          <LogoutButton />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sub-bg">
            <UserIcon className="h-5 w-5 text-sub-text" />
          </span>
        </div>

        {/*
          계정 메뉴. 이동은 하단 탭바가 맡으므로 햄버거(MenuIcon)가 아니라 사람
          아이콘을 씁니다 — 열어 보면 이메일과 로그아웃뿐인데 햄버거를 두면
          메뉴가 더 있는 것처럼 보입니다.

          손가락으로 눌러야 하므로 아이콘(24px)보다 넉넉한 44px 판을 줍니다.
        */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="account-menu"
          aria-label={open ? "계정 메뉴 닫기" : "계정 메뉴 열기"}
          className="-mr-tight ml-auto flex h-11 w-11 items-center justify-center rounded-card text-text md:hidden"
        >
          {open ? <CloseIcon className="h-6 w-6" /> : <UserIcon className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div
          id="account-menu"
          className="flex min-h-11 items-center justify-between gap-group border-t border-border px-group py-sibling md:hidden"
        >
          {email ? (
            // 긴 주소가 로그아웃 버튼을 밀어내지 않도록 자릅니다.
            <span className="truncate text-caption text-sub-text">{email}</span>
          ) : (
            <span />
          )}
          <span className="shrink-0">
            <LogoutButton />
          </span>
        </div>
      ) : null}
    </header>
  );
}
