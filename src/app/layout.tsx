import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ding dong 사내 디지털 명함",
  description: "DVISION Co., Ltd. 사내 디지털 명함 · 이메일 서명 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/*
         * Pretendard — 시안 폰트. 서브셋 동적 로드판이라 한글 페이지에서 받는 용량이 작습니다.
         * next/font 를 쓰지 않은 이유: Pretendard 는 구글 폰트가 아니고 npm 패키지 경로가
         * 버전마다 달라져서, CDN 링크가 지금 단계에서 덜 깨집니다.
         */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text">{children}</body>
    </html>
  );
}
