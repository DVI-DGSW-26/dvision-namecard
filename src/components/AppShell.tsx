import Script from "next/script";
import type { Role } from "@/lib/session-token";
import { BottomTabBar } from "./BottomTabBar";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

/**
 * 로그인 후 화면의 껍데기 — 왼쪽 사이드바(전체 높이) + 오른쪽 열(헤더 + 본문).
 *
 * PC(lg 이상)에서는 페이지(body)는 스크롤하지 않고 main 만 스크롤합니다. 그래야
 * 사이드바와 헤더가 늘 제자리에 있습니다. lg 미만에서는 문서 전체가 스크롤하고
 * 헤더만 sticky 로 붙입니다 — main 만 스크롤시키면 모바일 브라우저의 당겨서
 * 새로고침과 주소창 자동 숨김이 동작하지 않습니다. 헤더와 사이드바는 같은 surface(흰색), 본문은 canvas(연회색)라
 * 테두리 없이 바탕 차이로 나뉩니다.
 *
 * 1024px 미만에서는 사이드바를 숨기고 BottomTabBar 가 이동을 맡습니다. 탭바는 fixed
 * 라 화면 위에 뜨고, 같이 내보내는 스페이서만 스크롤 영역 끝에 남아 마지막 내용이
 * 가려지지 않게 합니다.
 */
export function AppShell({
  role,
  email,
  current,
  title,
  children,
}: {
  role: Role;
  email?: string | null;
  current: string;
  /** 헤더 h1. 본문에 같은 제목을 다시 쓰지 마세요. */
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-canvas lg:h-dvh lg:overflow-hidden">
      <Sidebar role={role} current={current} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav email={email} current={current} title={title} />
        <main className="flex flex-1 flex-col lg:overflow-y-auto">
          {children}
          <BottomTabBar role={role} current={current} />
        </main>
      </div>
      {/*
        사내 공통 "서비스 이동" 버튼(왼쪽 아래). 목록은 서비스 허브가 관리합니다.
        루트 layout 이 아니라 여기에 두는 이유: 공개 명함(/c/[slug])은 외부인이 보는
        화면이라 사내 메뉴가 나오면 안 됩니다. 로그인 후 화면에만 붙입니다.
        버튼 높이(모바일 하단 탭바 위로 올림)는 허브의 services.ts 에서 정합니다.
      */}
      <Script src="https://dvi-service-hub.vercel.app/switcher.js" strategy="afterInteractive" />
    </div>
  );
}
