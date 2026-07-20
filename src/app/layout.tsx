import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "(주)디비전 디지털 명함",
  description: "DVISION Inc. 사내 디지털 명함 · 이메일 서명 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
