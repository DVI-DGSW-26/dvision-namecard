"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/form";

/**
 * 공용 비밀번호 입력 폼.
 *
 * next 는 page.tsx 에서 safeRedirect 로 이미 걸러진 값만 받습니다. 여기서 다시
 * 검증하지 않는 건 그래서입니다 — 검증 지점을 둘로 두면 한쪽만 고쳐 놓고
 * 안전하다고 믿게 됩니다.
 */
export function GateForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "로그인하지 못했습니다.");
        return;
      }

      // 세션 쿠키가 생겼으니 서버 컴포넌트를 다시 그려야 합니다.
      router.replace(next);
      router.refresh();
    } catch {
      setError("네트워크 오류로 로그인하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-section">
      <Field label="비밀번호" htmlFor="password" error={error ?? undefined}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          invalid={Boolean(error)}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <button
        type="submit"
        disabled={!password || submitting}
        className="h-12 w-full rounded-card bg-primary text-body-bold text-white transition-colors hover:bg-primary-hover disabled:bg-sub-bg disabled:text-sub-text"
      >
        {submitting ? "확인 중…" : "들어가기"}
      </button>
    </form>
  );
}
