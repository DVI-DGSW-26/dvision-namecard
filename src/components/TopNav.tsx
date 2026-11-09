"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { CloseIcon, UserIcon } from "./icons";
import { LogoutButton } from "./LogoutButton";

/**
 * 상단 헤더. 메뉴 이동은 사이드바(PC)·하단 탭바(모바일)가 맡고, 여기는 화면 제목과
 * 계정(이메일·로그아웃)만 둡니다.
 *
 * 바탕은 사이드바와 같은 surface 입니다 — 헤더와 사이드바가 한 장의 흰 판처럼 보이고
 * 본문(canvas)만 색이 달라야 합니다. 색 바탕·그림자·하단 테두리를 넣지 마세요.
 *
 * 1024px 미만에서는 사이드바가 없으므로 왼쪽에 서비스 심볼을 둬서 홈으로 돌아갈 수
 * 있게 합니다. 768px 미만에서는 계정 정보를 한 줄에 밀어 넣으면 가로 스크롤이
 * 생기므로 사람 아이콘 하나로 접고, 누르면 헤더 아래로 계정 줄이 펼쳐집니다.
 * 덮개(overlay)가 아니라 밀고 들어오는 방식이라 body 스크롤을 잠글 필요가 없습니다.
 *
 * 드로어 때문에 클라이언트 컴포넌트입니다. props 는 전부 직렬화 가능한 값입니다.
 */

export function TopNav({
  email,
  current,
  title,
}: {
  email?: string | null;
  current: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  // 라우트가 바뀌면 닫습니다. 페이지마다 헤더를 새로 그리지만 React 가 같은
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
    <header className="sidebar-scope sticky top-0 z-30 shrink-0 bg-surface">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6 lg:h-24">
        {/* 사이드바가 없는 폭에서만. PC 에서는 사이드바 맨 위 로고가 같은 일을 합니다. */}
        <Link href="/edit" className="flex shrink-0 items-center lg:hidden" aria-label="dingdong 홈으로">
          <Image
            src={brand.serviceMark}
            alt=""
            width={256}
            height={256}
            priority
            className="size-8"
          />
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-fg lg:text-3xl lg:font-bold">
          {title}
        </h1>

        <div className="hidden items-center gap-1 md:flex">
          {email ? <span className="mr-2 text-sm text-fg-muted">{email}</span> : null}
          {/* 관리자로 다시 들어가려면 세션을 끊는 수밖에 없습니다. 개인 계정이 없어서입니다. */}
          <LogoutButton />
          <span className="ml-1 flex size-9 items-center justify-center rounded-full bg-brand-soft text-brand-fg">
            <UserIcon className="size-5" />
          </span>
        </div>

        {/*
          계정 메뉴. 이동은 하단 탭바가 맡으므로 햄버거가 아니라 사람 아이콘을 씁니다 —
          열어 보면 이메일과 로그아웃뿐인데 햄버거를 두면 메뉴가 더 있는 것처럼 보입니다.
        */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="account-menu"
          aria-label={open ? "계정 메뉴 닫기" : "계정 메뉴 열기"}
          className="-mr-tight flex size-10 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden"
        >
          {open ? <CloseIcon className="size-6" /> : <UserIcon className="size-6" />}
        </button>
      </div>

      {open ? (
        <div
          id="account-menu"
          className="flex min-h-11 items-center justify-between gap-group border-t border-line px-4 py-sibling md:hidden"
        >
          {email ? (
            // 긴 주소가 로그아웃 버튼을 밀어내지 않도록 자릅니다.
            <span className="truncate text-sm text-fg-muted">{email}</span>
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
