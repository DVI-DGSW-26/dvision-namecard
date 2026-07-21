"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 로그아웃.
 *
 * 공용 비밀번호 구조라 회원/관리자를 바꾸려면 세션을 끊는 수밖에 없습니다.
 * 이게 없으면 한 번 회원으로 들어간 사람은 브라우저 쿠키를 직접 지우지 않는 한
 * 관리자 화면을 볼 방법이 없습니다.
 */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch("/api/gate", { method: "DELETE" });
    } finally {
      // 실패해도 게이트로 보냅니다. 쿠키가 남아 있으면 게이트가 다시 판단합니다.
      router.replace("/gate");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="text-caption text-sub-text hover:text-text disabled:text-border"
    >
      로그아웃
    </button>
  );
}
