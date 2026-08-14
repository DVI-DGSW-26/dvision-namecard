"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  isSignatureStale,
  readSignatureCopiedAt,
  SIGNATURE_COPIED_EVENT,
} from "@/lib/signature-freshness";

/**
 * "서명이 낡았습니다 — 다시 복사하세요" 안내 띠.
 *
 * 이게 없으면 서명을 고칠 때마다 사람이 전 직원에게 공지를 돌려야 하고, 공지를 놓친
 * 사람은 옛 서명을 계속 내보냅니다. 판정 규칙은 lib/signature-freshness.ts 에 있습니다.
 *
 * 서버에서는 아무것도 그리지 않습니다(초기 stale=false). 판정 근거가 브라우저
 * localStorage 에 있어서, 서버가 미리 그려 두면 hydration 이 어긋납니다. 대신 마운트
 * 직후 한 프레임 뒤에 나타납니다 — 안내 띠라 그 정도 지연은 문제가 없습니다.
 *
 * 자리: /edit(로그인 후 첫 화면)과 /edit/signature 두 곳입니다. 관리자 화면에는 안
 * 답니다 — 거기에는 "내 서명" 이라는 개념이 없습니다.
 */
export function SignatureStaleBanner({
  employeeId,
  /** employee.updatedAt 의 ISO 문자열. 서버 컴포넌트에서 Date 를 그대로 넘길 수 없습니다. */
  profileUpdatedAt,
  /**
   * 복사 버튼이 있는 화면(/edit/signature)에서는 false. 지금 보고 있는 화면으로
   * 다시 보내는 링크는 "눌러도 아무 일이 없는" 링크라 신뢰를 깎습니다.
   */
  linkToSignature = true,
}: {
  employeeId: string;
  profileUpdatedAt: string;
  linkToSignature?: boolean;
}) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const check = () =>
      setStale(
        isSignatureStale({
          copiedAt: readSignatureCopiedAt(employeeId),
          profileUpdatedAt: new Date(profileUpdatedAt),
        }),
      );

    check();

    // 같은 화면에서 복사하면 배너가 그 자리에서 사라져야 합니다. 안 그러면 방금
    // 시킨 대로 했는데도 계속 시키는 화면이 됩니다.
    window.addEventListener(SIGNATURE_COPIED_EVENT, check);
    return () => window.removeEventListener(SIGNATURE_COPIED_EVENT, check);
  }, [employeeId, profileUpdatedAt]);

  if (!stale) return null;

  return (
    // 배경·테두리는 /edit 의 "다른 임직원의 명함을 보고 있습니다" 띠와 같은 규칙입니다.
    // 강조는 색이 아니라 자리(화면 맨 위)와 굵기로 냅니다 — primary 예산은 링크 몫입니다.
    <div className="border-b border-border bg-sub-bg">
      {/* 좁은 화면에서 문구가 길어 링크가 밀려나므로 줄을 나눕니다. */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-group gap-y-tight px-group py-sibling sm:px-section">
        <p className="text-caption text-sub-text">
          {linkToSignature
            ? "메일 프로그램에 넣어 둔 서명이 최신이 아닙니다. 다시 복사해 교체해 주세요."
            : "메일 프로그램에 넣어 둔 서명이 최신이 아닙니다. 아래 서명 복사 를 눌러 교체해 주세요."}
        </p>
        {linkToSignature ? (
          <Link href="/edit/signature" className="text-caption-bold text-primary">
            서명 복사하러 가기
          </Link>
        ) : null}
      </div>
    </div>
  );
}
